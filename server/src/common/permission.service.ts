import { Inject, Injectable } from '@nestjs/common'
import type { Pool } from 'mysql2/promise'
import type { RowDataPacket } from 'mysql2'
import { buildInClause } from './db.util'

interface CacheEntry {
  buttons: string[]
  permissions: string[]
  expireAt: number
}

/**
 * 权限查询服务：解析 token 中的用户 id → 聚合其所有角色拥有的按钮权限点。
 *
 * 采用进程内缓存（TTL，默认 60s）避免每次请求查库；
 * 角色授权变更通过 `invalidate` 主动失效（管理端写角色后调用）。
 */
@Injectable()
export class PermissionService {
  constructor(@Inject('MYSQL_POOL') private readonly pool: Pool) {}

  private readonly cache = new Map<number, CacheEntry>()
  private readonly ttl = 60_000

  /** 角色授权变更后调用，清除相关用户缓存（不传 userId 则全清） */
  invalidate(userId?: number): void {
    if (userId === undefined) this.cache.clear()
    else this.cache.delete(userId)
  }

  /**
   * 聚合用户所有角色的权限数据。
   * - permissions：应用级（各角色 role_apps 的 appKey 并集）
   * - buttons：按钮级（各角色 role_menus.permissions 并集）
   */
  async loadUserPermissions(userId: number): Promise<{
    permissions: string[]
    buttons: string[]
  }> {
    const hit = this.cache.get(userId)
    if (hit && hit.expireAt > Date.now()) {
      return { permissions: hit.permissions, buttons: hit.buttons }
    }

    const [roleRows] = await this.pool.query<RowDataPacket[]>(
      'SELECT `role_id` FROM `user_roles` WHERE `user_id` = ?',
      [userId],
    )
    const roleIds = roleRows.map((r) => r.role_id as number)
    if (!roleIds.length) {
      const empty = { permissions: [], buttons: [] }
      this.cache.set(userId, { ...empty, expireAt: Date.now() + this.ttl })
      return empty
    }

    const { clause, params } = buildInClause(roleIds)

    const [appRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT DISTINCT \`app_key\` FROM \`role_apps\` WHERE \`role_id\` IN (${clause})`,
      params,
    )
    const permissions = appRows.map((r) => r.app_key as string)

    const [menuRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT rm.\`permissions\` FROM \`role_menus\` rm
         JOIN \`menus\` m ON m.\`id\` = rm.\`menu_id\`
        WHERE rm.\`role_id\` IN (${clause}) AND m.\`visible\` = 1`,
      params,
    )
    const buttons = new Set<string>()
    menuRows.forEach((r) => {
      const raw = r.permissions as string | null
      if (!raw) return
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((p) => buttons.add(p))
    })

    const result = { permissions, buttons: [...buttons] }
    this.cache.set(userId, { ...result, expireAt: Date.now() + this.ttl })
    return result
  }
}
