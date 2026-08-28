import { Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomUUID } from 'node:crypto'
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { ApiError } from '../../common/errors'

/** access token 有效期（秒），默认 15min */
const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL || 900)
/** refresh token 有效期（秒），默认 7d */
const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL || 604800)

export interface TokenPayload {
  /** 用户 id */
  sub: number
  /** 展示/审计用快照 */
  username?: string
  /** 当前生效角色（切换角色后重签） */
  roleId?: number | null
  /** token 类型 */
  typ: 'access' | 'refresh'
  /** 签发时的 token_version，AuthGuard 用其做即时吊销比对 */
  tv?: number
  /** 唯一标识（防重放、refresh 落库关联） */
  jti: string
  iat: number
  exp: number
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  /** access 有效期（秒），供前端预刷新调度 */
  expiresIn: number
}

export interface AuthUser {
  id: number
  username: string
  /** 账号状态：'active' | 'disabled'（与 users 表一致） */
  status: string
  tokenVersion: number
}

/**
 * 真实 JWT 认证服务：
 * - HS256 签名，access(15min) / refresh(7d) 双令牌；
 * - refresh 哈希落库（refresh_tokens），支持旋转单次使用与服务端吊销；
 * - verify 固定算法白名单 + iss/aud 校验 + 时钟偏移容差。
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject('MYSQL_POOL') private readonly pool: Pool,
    private readonly jwt: JwtService,
  ) {}

  private get secret(): string {
    const s = process.env.JWT_SECRET
    if (!s || s.length < 32) {
      // 启动期强校验兜底：缺密钥直接拒绝（main.ts 同样校验，这里双保险）
      throw new Error('JWT_SECRET 未配置或长度不足 32 字符')
    }
    return s
  }

  private get issuer(): string {
    return process.env.JWT_ISSUER || 'mic-admin'
  }

  private get audience(): string {
    return process.env.JWT_AUDIENCE || 'mic-admin-web'
  }

  /** 校验 access/refresh token，返回 payload（含 jti） */
  async verifyToken(token: string, typ: 'access' | 'refresh'): Promise<TokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<TokenPayload>(token, {
        secret: this.secret,
        algorithms: ['HS256'], // 固定算法白名单，防 alg=none / 算法混淆
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: 30, // 容忍 30s 时钟偏移
      })
      if (payload.typ !== typ) throw new Error('token 类型不匹配')
      return payload
    } catch {
      throw new ApiError('登录已过期，请重新登录', 40100, 401)
    }
  }

  private async sign(payload: Record<string, unknown>, ttlSec: number): Promise<{ token: string; jti: string }> {
    const jti = randomUUID()
    const token = await this.jwt.signAsync(
      { ...payload, jti },
      {
        secret: this.secret,
        issuer: this.issuer,
        audience: this.audience,
        algorithm: 'HS256',
        expiresIn: ttlSec,
      },
    )
    return { token, jti }
  }

  /** 签发 access + refresh 并落库 refresh 哈希（登录） */
  async issueTokenPair(userId: number, username: string, roleId?: number | null): Promise<TokenPair> {
    const tv = await this.loadTokenVersion(userId)
    const access = await this.sign({ sub: userId, username, roleId, typ: 'access', tv }, ACCESS_TTL)
    const refresh = await this.sign({ sub: userId, typ: 'refresh' }, REFRESH_TTL)
    const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')
    await this.pool.execute(
      'INSERT INTO refresh_tokens (user_id, jti, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [userId, refresh.jti, this.sha256(refresh.token), expiresAt],
    )
    return { accessToken: access.token, refreshToken: refresh.token, expiresIn: ACCESS_TTL }
  }

  /** 仅重签 access（切换角色时复用原 refresh，不旋转） */
  async issueAccessToken(
    userId: number,
    username: string,
    roleId?: number | null,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const tv = await this.loadTokenVersion(userId)
    const access = await this.sign({ sub: userId, username, roleId, typ: 'access', tv }, ACCESS_TTL)
    return { accessToken: access.token, expiresIn: ACCESS_TTL }
  }

  /**
   * 刷新：校验旧 refresh → 原子吊销（旋转单次使用）→ 签发新对。
   * 并发用同一枚 refresh 换新时，仅第一个成功，其余 401。
   */
  async refresh(refreshToken: string, roleId?: number | null): Promise<TokenPair> {
    const payload = await this.verifyToken(refreshToken, 'refresh')
    const hash = this.sha256(refreshToken)
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT id, user_id, revoked_at FROM refresh_tokens WHERE jti = ? AND token_hash = ?',
      [payload.jti, hash],
    )
    const row = rows[0]
    if (!row || row.revoked_at) throw new ApiError('刷新令牌无效或已吊销', 40102, 401)
    if (Number(row.user_id) !== Number(payload.sub)) throw new ApiError('刷新令牌不匹配', 40102, 401)

    const [res] = await this.pool.execute<ResultSetHeader>(
      'UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = ? WHERE id = ? AND revoked_at IS NULL',
      [payload.jti, row.id],
    )
    if (!res.affectedRows) throw new ApiError('刷新令牌已被使用，请重新登录', 40102, 401)

    const user = await this.loadAuthUser(Number(payload.sub))
    if (!user || user.status !== 'active') throw new ApiError('账号不存在或已禁用', 40103, 401)
    const roleIds = await this.loadRoleIds(user.id)
    let activeRoleId: number | null = roleId ?? null
    if (activeRoleId != null && !roleIds.includes(activeRoleId)) {
      throw new ApiError('无权使用该角色', 40300, 403)
    }
    if (activeRoleId == null) activeRoleId = roleIds[0] ?? null
    return this.issueTokenPair(user.id, user.username, activeRoleId)
  }

  /** 吊销用户全部 refresh（登出/改密/禁用） */
  async revokeAll(userId: number): Promise<void> {
    await this.pool.execute(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [userId],
    )
  }

  /** 加载当前用户（AuthGuard 用），不存在返回 null */
  async loadAuthUser(userId: number): Promise<AuthUser | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT id, username, status, token_version AS tokenVersion FROM users WHERE id = ?',
      [userId],
    )
    const row = rows[0] as AuthUser | undefined
    return row ? { id: row.id, username: row.username, status: row.status, tokenVersion: row.tokenVersion } : null
  }

  private async loadTokenVersion(userId: number): Promise<number> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT token_version AS tv FROM users WHERE id = ?',
      [userId],
    )
    return Number(rows[0]?.tv ?? 0)
  }

  private async loadRoleIds(userId: number): Promise<number[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT role_id FROM user_roles WHERE user_id = ?',
      [userId],
    )
    return rows.map((r) => Number(r.role_id))
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
}
