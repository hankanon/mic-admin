# 真实 JWT 认证实现方案

> 版本：1.0 ｜ 更新日期：2026-08-28
> 对应：`docs/SYSTEM-DESIGN.md` §9.1 安全加固 · 第 2 条「真实 JWT」
> **实施状态：已实施**（阶段 A-D 已完成并回归验证：登录签发双令牌、全局 AuthGuard、刷新旋转单次使用、登出吊销、按钮权限、alg=none 防护等）

---

## 目录

1. [问题与现状](#1-问题与现状)
2. [目标与范围](#2-目标与范围)
3. [总体设计](#3-总体设计)
4. [详细设计](#4-详细设计)
5. [安全加固清单](#5-安全加固清单)
6. [关键设计决策与权衡](#6-关键设计决策与权衡)
7. [实施步骤（分阶段）](#7-实施步骤分阶段)
8. [风险与回滚](#8-风险与回滚)
9. [验收清单](#9-验收清单)

---

## 1. 问题与现状

### 1.1 现状

| 环节 | 现状 | 风险 |
|------|------|------|
| 令牌 | 登录返回 `mock-token-{userId}-{timestamp}`（见 `user.service.ts`），`common/auth-token.ts` 用正则 `^mock-token-(\d+)-\d+$` 提取 userId | **无签名、无过期、无撤销**。知道 userId 即可伪造任意身份（如 `mock-token-1-...` 冒充超级管理员），任何人可绕过前端直调管理接口 |
| 鉴权 | 仅 `PermissionGuard` 拦截声明了 `@RequirePermission` 的写接口；其余接口（含登录）靠 `parseTokenUserId` 就地解析 | 接口无统一认证入口，登录接口本身无保护；token 解析逻辑散落在 controller |
| 续期 | 前端 `auth/index.ts` 用 localStorage 包装 7 天过期，401 时**直接登出**（见 `packages/utils/src/request`） | 体验差：工作期间 token 一过即被踢出 |
| 密码 | `users.password` 明文（第 1 条另行处理） | 与 JWT 无直接耦合，但登录校验改动需同步 |

### 1.2 本节改进目标

在**不推翻现有按钮级权限体系**（`role_apps`/`role_menus`/`PermissionGuard`）的前提下：

1. `mock-token` → **签名 JWT**（HS256，含 `exp/iat/sub/jti/roleId`），不可伪造、有过期时间；
2. 后端加**全局 `AuthGuard`**（白名单：`login`、`health`）+ `@Public()` 注解，统一认证入口；
3. **access(15min) / refresh(7d) 双令牌**：refresh 旋转（单次使用）+ 服务端吊销（登出/改密/禁用立即失效）；
4. 前端 **401 单飞静默刷新并重放原请求**，替代直接登出；
5. 与既有 `PermissionGuard`、按钮级权限（`loadUserPermissions`）**无缝衔接**，鉴权粒度不变。

---

## 2. 目标与范围

### 2.1 目标

- **认证（你是谁）**：全局 JWT 校验，所有受保护接口必须携带有效 access token；
- **授权（你能做什么）**：保持现有 RBAC——应用级 `role_apps`、菜单级 `role_menus`、按钮级 `@RequirePermission`，本次**不改变授权模型**；
- **会话管理**：登录/登出/切换角色/改密/禁用均能控制令牌生命周期；
- **前端体验**：token 过期无感续期，会话期间不被迫登出。

### 2.2 范围

- **含**：后端签发/校验/刷新/吊销、全局守卫、前端存储与拦截器、SQL 迁移、密钥配置；
- **不含**：密码哈希改造（§9.1 第 1 条，独立任务，但登录接口改造时一并预留）、SSO/OAuth 第三方登录、多端（设备）管理、行级数据权限（ABAC）。

---

## 3. 总体设计

```
┌────────────┐  login(账号+密码)   ┌──────────────────────────────┐
│  前端      │ ──────────────────▶ │  AuthService                 │
│  (sys-app) │ ◀────────────────── │  校验密码 → 签发 access+refresh│
└────────────┘   返回{accessToken, │  写入 refresh_tokens(哈希)     │
   │  ▲                            └──────────────┬───────────────┘
   │  │ Bearer accessToken                          │ 校验
   │  │ (15min)                                    ▼
   │  │                     ┌────────────────────────────────────┐
   │  │ 401(access过期)     │  全局 AuthGuard(jwt)                │
   │  └────────────────────▶│  验签→查用户状态→token_version比对    │
   │     refresh 单飞刷新    │  →req.user → 放行/401               │
   │  ◀─────────────────────│  再进 PermissionGuard(按钮级授权)    │
   │  新 access + 旋转 refresh└────────────────────────────────────┘
   │                                ▲
   │      refresh 校验: sha256 比对 ──┘
   │      refresh_tokens 表(MySQL)
```

- **双层守卫**：`AuthGuard`（认证，全局）→ `PermissionGuard`（授权，局部）。
- **令牌分层**：access 短命无状态（15min，验签即可），refresh 长命有状态（7d，落库存哈希，可吊销、可旋转）。
- **无 Redis 依赖**：refresh 状态存 MySQL（部署为 nginx + server + mysql，不引入新组件）；若未来引入 Redis，`refresh_tokens` 表逻辑可平移到 Redis（见 §6.4）。

---

## 4. 详细设计

### 4.1 依赖引入

```bash
pnpm --filter server add @nestjs/jwt jsonwebtoken bcryptjs
pnpm --filter server add -D @types/jsonwebtoken @types/bcryptjs
```

- `@nestjs/jwt`：签发/校验封装（内置 HS256 支持）；
- `jsonwebtoken`：底层库（`@nestjs/jwt` 依赖即可，显式引入以便独立工具函数使用）；
- `bcryptjs`：密码哈希（纯 JS 实现，无原生编译，Docker 构建友好）——供第 1 条密码改造共用，登录校验在此一并接入。

### 4.2 配置（环境变量）

`server/.env.development` 新增：

```ini
# JWT —— 生产用 `openssl rand -base64 48` 生成，勿提交仓库
JWT_SECRET=dev-only-secret-change-me-0123456789abcdef0123456789abcdef
JWT_ISSUER=mic-admin
JWT_AUDIENCE=mic-admin-web
JWT_ACCESS_TTL=900          # 15min（秒）
JWT_REFRESH_TTL=604800      # 7d（秒）
```

`JWT_SECRET` **长度 ≥ 32 字节**；`server/.env.production` 同样配置且值不同，由部署环境注入（Docker Compose `environment:` 或 secret 挂载）。校验：启动时若 `JWT_SECRET` 缺失或 < 32 字符则直接 `throw`，避免弱密钥上线。

### 4.3 数据模型

SQL 迁移（`server/sql/xxx-jwt.sql`，沿用现有手工增量脚本风格）：

```sql
-- 1) users 增加令牌版本号：改密/禁用时自增，令该用户全部已签发 access token 立即失效
ALTER TABLE users
  ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0
  COMMENT '令牌版本号，改密/禁用后自增以吊销存量 access token';

-- 2) 刷新令牌表（服务端吊销 + 旋转单次使用的载体）
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED NOT NULL COMMENT '所属用户',
  jti            CHAR(36)     NOT NULL COMMENT 'refresh token 唯一标识(jwt id)',
  token_hash     CHAR(64)     NOT NULL COMMENT 'sha256(refreshToken) 十六进制，拖库不可逆用',
  expires_at     DATETIME     NOT NULL COMMENT '过期时间',
  revoked_at     DATETIME     NULL     COMMENT '吊销时间(登出/改密/禁用/被旋转顶替)',
  replaced_by    CHAR(36)     NULL     COMMENT '旋转链路：被哪个新 jti 顶替，审计用',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_jti (jti),
  KEY idx_user (user_id),
  KEY idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='刷新令牌（哈希存储，支持吊销与旋转）';
```

> 设计取舍：refresh 不落明文只落 `sha256` 哈希——即使库被拖，攻击者无法用哈希重放换取新令牌；校验时对请求携带的 token 做同样哈希后比对（常量时间比较）。

### 4.4 Token 结构

**Access Token**（15min，无状态）：

```jsonc
// header: { "alg": "HS256", "typ": "JWT" }
// payload:
{
  "iss": "mic-admin",        // 签发方
  "aud": "mic-admin-web",    // 受众（防止 token 被他系统冒用）
  "sub": "1",                // userId
  "username": "admin",       // 展示/审计用快照
  "roleId": 2,               // 当前生效角色（切换角色后重新签发）
  "typ": "access",
  "jti": "uuid-v4",          // 防重放、审计关联
  "iat": 1724800000,
  "exp": 1724800900
}
```

**Refresh Token**（7d，有状态）：

```jsonc
{
  "iss": "mic-admin",
  "aud": "mic-admin-web",
  "sub": "1",
  "typ": "refresh",
  "jti": "uuid-v4",          // 与 refresh_tokens.jti 对应，库中存 sha256(token) 以便按 jti 定位
  "iat": 1724800000,
  "exp": 1725404800
}
```

> **注意**：`roleId` 仅是登录/切换时的快照，**授权判断不依赖它**——`PermissionGuard` 始终经 `PermissionService.loadUserPermissions(userId)` 实时聚合（60s 缓存），角色授权变更即时生效，与现有行为一致。

### 4.5 后端核心实现

#### 4.5.1 新增 `common/jwt/` 基础设施

新建 `server/src/common/jwt/auth.service.ts`（或并入 `modules/auth/`，建议独立 `AuthModule` 更内聚）：

```ts
// auth.service.ts（关键逻辑示意）
@Injectable()
export class AuthService {
  constructor(@Inject('MYSQL_POOL') private readonly pool: Pool) {}

  /** 签发令牌对 */
  async issueTokenPair(userId: number, username: string, roleId?: number) {
    const accessToken = await this.signToken({ typ: 'access', roleId }, ACCESS_TTL)
    const refreshToken = await this.signToken({ typ: 'refresh' }, REFRESH_TTL)
    const jti = decodeJwt(refreshToken).jti
    await this.pool.execute(
      `INSERT INTO refresh_tokens (user_id, jti, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
      [userId, jti, sha256Hex(refreshToken), toMySqlDatetime(Date.now() + REFRESH_TTL * 1000)],
    )
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL }
  }

  private signToken(payload: object, ttlSec: number) {
    return this.jwtService.signAsync(payload, {
      secret: config.jwt.secret,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      subject: String(payload.sub ?? this.currentUser.id), // sub 在调用处注入
      jwtid: randomUUID(),
      expiresIn: ttlSec,
      algorithm: 'HS256',
    })
  }

  /** 刷新：校验旧 refresh → 吊销 → 签发新对（旋转） */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyToken(refreshToken, 'refresh')
    const tokenHash = sha256Hex(refreshToken)
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, user_id, revoked_at FROM refresh_tokens
        WHERE jti = ? AND token_hash = ?`, [payload.jti, tokenHash])
    const row = rows[0]
    if (!row || row.revoked_at) throw new ApiError('刷新令牌无效或已吊销', 40102, 401)
    if (row.user_id !== Number(payload.sub)) throw new ApiError('刷新令牌不匹配', 40102, 401)

    // 旋转：先吊销旧（原子），再签发新。若同时并发两枚旧 token 来换，
    // 第二次会因 revoked_at 已被置位而失败——单次使用由此保证。
    await this.pool.execute(
      `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = ?
        WHERE id = ? AND revoked_at IS NULL`, [payload.jti, row.id])
    const pair = await this.issueTokenPair(row.user_id, ..., payload.roleId)
    return pair
  }

  /** 登出：吊销该用户当前 refresh（可选携带 jti 精确吊销） */
  async revoke(userId: number, jti?: string) { /* UPDATE ... SET revoked_at = NOW() ... */ }
}
```

关键点：

- **verifyToken 显式指定算法白名单**：`verifyAsync(token, { algorithms: ['HS256'], issuer, audience, clockTolerance: 30 })`——杜绝 `alg: none`/算法混淆；
- **refresh 旋转的并发安全**：`UPDATE ... WHERE id = ? AND revoked_at IS NULL` 的原子条件 + `uk_jti` 唯一约束兜底（见 §4.6.1）；
- **吊销语义**：
  - 登出 → 吊销该用户全部 refresh（`revoked_at = NOW()`），access 等自然过期（≤15min）；
  - 改密/禁用 → `users.token_version++` + 吊销全部 refresh，access 立即失效（§4.5.3）；
  - 换角色 → 重新签发 access（新 `roleId`），refresh 不变（会话延续）。

#### 4.5.2 全局 AuthGuard + @Public

```ts
// common/jwt/auth.guard.ts
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector,
              private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest()
    const token = parseBearer(req.headers.authorization)
    if (!token) throw new ApiError('未登录', 40100, 401)

    const payload = await this.authService.verifyToken(token, 'access')
    // 用户状态实时校验：禁用/删除即拒绝（users.status / token_version）
    const user = await this.authService.loadUserById(payload.sub)
    if (!user || user.status !== 1) throw new ApiError('账号已禁用或不存在', 40103, 401)
    if (user.token_version !== payload.tv) throw new ApiError('登录状态已失效，请重新登录', 40100, 401)
    req.user = { userId: user.id, username: user.username, roleId: payload.roleId }
    return true
  }
}
```

```ts
// 全局注册：main.ts
app.useGlobalGuards(new AuthGuard(reflector, authService))
// 或通过 APP_GUARD provider 注册（推荐，可注入依赖）
{
  provide: APP_GUARD,
  useClass: AuthGuard,
}
```

白名单用 `@Public()` 装饰器标注，替代硬编码路由列表（更声明式，且天然支持未来新增公开接口）：

```ts
@Public()
@Post('login')          // POST /api/users/login
login(...) { ... }

// health 不走 Nest 路由（main.ts 原生注册），直接在 AuthGuard 里放行 GET /health
```

> `PermissionGuard` 改造：从 `req.user.userId` 取用户（不再自行 `parseTokenUserId`），逻辑其余不变。`parseTokenUserId`/mock 解析代码删除。

#### 4.5.3 登录/切换角色/登出改造

`user.service.ts` 调整：

```ts
async login(body: { username: string; password: string }) {
  const user = await this.findByUsername(body.username)
  if (!user || !(await bcrypt.compare(body.password, user.password)))
    throw new ApiError('账号或密码错误', 40101, 401)  // 提示不区分账号/密码错，防枚举
  // ... status 校验
  const pair = await this.authService.issueTokenPair(user.id, user.username)
  const roleData = await this.buildRoleData(user.id)   // 现有聚合逻辑不变
  return { ...pair, user: { ...roleData, currentRoleId: roleData.currentRoleId } }
}

async getRoleData(userId: number, roleId: number) {
  // 校验 userId 确实拥有该角色（防越权切换）——现有逻辑保持
  const roleData = await this.buildRoleData(userId, roleId)
  const accessToken = await this.authService.issueAccess(userId, roleId) // 重新签发含新 roleId
  return { accessToken, ...roleData }
}

async logout(userId: number) {
  await this.authService.revokeAll(userId)   // 吊销全部 refresh
  return null
}
```

前端契约：`login` 返回体新增 `{ accessToken, refreshToken, expiresIn }`，`role-data` 返回 `{ accessToken }`；既有 `user`/`permissions`/`menus`/`buttons` 字段不变（后端兼容增量，前端无需大改 UI 层）。

### 4.6 前端改造

#### 4.6.1 存储分层（`packages/utils/src/auth/`）

| 存储 | 内容 | 位置 | 说明 |
|------|------|------|------|
| access token | 内存变量 + localStorage 镜像 | `auth/index.ts` | 页面刷新后从镜像恢复；内存优先防 XSS 直接偷取 |
| refresh token | localStorage | 独立 key `refresh_token` | 不与 access 同 key，7d 有效 |
| user info | localStorage | `user_info`（不变） | — |

```ts
let accessTokenCache: string | null = null
export function setTokens(access: string, refresh: string) {
  accessTokenCache = access
  setStorage(TOKEN_KEY, access)          // 兼容现有读取点
  setStorage(REFRESH_KEY, refresh, { expires: 7 * 24 * 3600 * 1000 })
}
```

现有 `getToken()` 改为返回内存缓存（无则读 localStorage），业务代码零改动。

#### 4.6.2 请求层 401 单飞刷新（`packages/utils/src/request/index.ts`）

在既有响应拦截器 `401 → logout()` 分支处改造：

```ts
// 单飞：并发多个 401 只发一次 refresh，其余等待同一 Promise
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await http.post('/auth/refresh', { refreshToken: getRefreshToken() })
      setTokens(res.data.accessToken, res.data.refreshToken)
      return res.data.accessToken
    })().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

// 拦截器 error 分支：
if (error.response?.status === 401 && !config._retried) {
  config._retried = true
  try {
    const token = await refreshAccessToken()
    config.headers.Authorization = `Bearer ${token}`
    return instance(config)              // 重放原请求
  } catch {
    logout()                              // 刷新失败：清态跳登录
    return Promise.reject(error)
  }
}
```

- **防循环**：`config._retried` 标记，刷新后重放仍 401（如权限被收回）则不再重试；
- **防并发**：`refreshPromise` 单飞，多 tab 场景由后端旋转单次使用兜底（只一个成功，其余拿到 401 走登出——可接受，登录页重进即恢复）。

**主动预刷新（与 401 兜底互补，建议一并实现）**：不等到过期被 401 打回来，而是提前在到期前静默换新令牌，把"无感"做在前面——`refreshAccessToken()` 已具单飞能力，主动与被动路径天然复用同一逻辑：

```ts
// 登录/切换角色成功后：根据 expiresIn 设定时器，到期前 60s 静默刷新
let refreshTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleRefresh(expiresInSec: number) {
  clearRefreshTimer()
  const ahead = Math.max((expiresInSec - 60) * 1000, 5_000) // 提前 60s，至少 5s
  refreshTimer = setTimeout(async () => {
    try {
      const token = await refreshAccessToken()
      setTokens(token, getRefreshToken()) // 旋转后 access 已更新，续排下一轮
    } catch { /* 静默失败，交给 401 兜底 */ }
  }, ahead)
}

// 页面从后台切回时兜底检查（休眠/切 tab 期间定时器可能被浏览器节流）
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isAccessExpiredSoon()) refreshAccessToken().catch(() => {})
})

export function clearRefreshTimer() {
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null }
}
// logout() / 登录态失效时调用 clearRefreshTimer()
```

主被动配合的时序：**主动预刷新失败（如网络抖动）→ 请求带过期 access → 401 → 被动路径单飞刷新重放成功**，用户全程无感；仅当 refresh 本身失效（7d 到期 / 被吊销）才落到登出。

#### 4.6.3 路由/登出

- 路由守卫沿用 `hasToken()`（内部改为读 refresh/access 有效性）；
- `logout()` 增加调用 `POST /auth/logout` 通知后端吊销 refresh（失败不阻塞本地清理）。

---

## 5. 安全加固清单

| # | 措施 | 实现位置 |
|---|------|----------|
| 1 | 固定 `algorithms: ['HS256']` 验签，防 `alg=none`/算法混淆 | `AuthService.verifyToken` |
| 2 | `iss`/`aud` 双向校验 + `clockTolerance: 30s` 时钟偏移容差 | 同上 |
| 3 | access 短时（15min），泄漏窗口最小化 | 配置 `JWT_ACCESS_TTL` |
| 4 | refresh 单次使用（旋转 + 原子吊销 + `uk_jti` 兜底），重放即失效 | `AuthService.refresh` / 迁移 |
| 5 | refresh 落库只存 `sha256` 哈希，拖库不可直接用 | `refresh_tokens.token_hash` |
| 6 | 改密/禁用 → `token_version++` 即时吊销全部会话 | `AuthGuard` + 迁移 |
| 7 | 登出主动吊销 refresh，access 自然过期（≤15min） | `POST /auth/logout` |
| 8 | 登录失败不区分「账号不存在/密码错误」，防用户枚举 | `user.service.login` |
| 9 | `JWT_SECRET` ≥ 32 字节、启动强校验、生产经环境注入不入库 | 配置/`main.ts` |
| 10 | 全站 HTTPS：生产 nginx 终止 TLS；管理接口仅允许 HTTPS（`trust proxy` 后校验 `x-forwarded-proto`） | 部署层（§6.5） |
| 11 | 登录接口限流/失败锁定（与 §9.1 第 5 条联动实施） | `AuthModule` 内拦截器 |
| 12 | 不打印/不落日志完整 token（仅记录 jti/uid/事件） | 审计日志约定 |

---

## 6. 关键设计决策与权衡

### 6.1 HS256 vs RS256

- **选 HS256**：单实例/同进程部署（当前 nginx + 1×server），密钥共享无问题；实现与运维最简单。
- **何时升级 RS256**：多实例、多服务（各服务独立验签）或第三方需验签时，改公私钥对并保留 `JWT_SECRET_OLD` 双验签灰度轮换。

### 6.2 无状态 access + 有状态 refresh

- access 无状态（验签即信）→ 性能好、水平扩展友好；代价是吊销不即时 → 用 `token_version` + 15min 短时收敛窗口。
- refresh 有状态（落库）→ 可精确吊销、可旋转审计；代价是每次刷新一次 DB 读（频率低，可接受）。

### 6.3 Cookie vs Authorization Header

- **选 Header（Bearer）**：与现有前端 axios 拦截器、mock-token 携带方式一致，改动最小；天然规避 CSRF。
- 代价：token 进 JS 环境，受 XSS 威胁 → 配合：access 内存优先 + refresh localStorage 分 key、CSP 收紧、`v-html` 治理（工程清单外另列）。

### 6.4 MySQL 承载 refresh 状态（暂不引入 Redis）

- 现状部署无 Redis；`refresh_tokens` 表高频量级低（每人一条活跃 + 旋转历史），MySQL 完全够用，且随库备份天然容灾。
- 预留升级点：`AuthService` 的「查/写/吊销」收敛为单一 Repository 接口，未来可无痛替换 Redis（`SETEX` + `DEL`），接口与行为不变。

### 6.5 与部署架构的衔接（nginx 同源方案）

- nginx 终止 TLS，`/api/` 反代到 server 容器；`JWT_SECRET` 经 compose `environment`/`.env` 注入容器；
- WS（`/ws`）鉴权：连接握手时由前端携带 `?accessToken=` 或首条消息携带，服务端验签后绑定连接用户（与现有 `@nestjs/platform-ws` 网关集成，属后续增强，本期可先保持现状）。

---

## 7. 实施步骤（分阶段）

### 阶段 A：底座（1 天）
1. `pnpm --filter server add @nestjs/jwt jsonwebtoken bcryptjs`（+ 类型）；
2. `.env.development` 增加 JWT 配置；`config` 模块新增 `jwt` 段并做强校验；
3. SQL 迁移：`users.token_version` + `refresh_tokens` 表；`server/sql/` 新增脚本并在目标库执行。

### 阶段 B：后端认证（2 天）
4. 新建 `AuthModule`：`AuthService`（签发/校验/刷新/吊销）+ `JwtStrategy`（`@nestjs/passport` 或守卫直连均可）；
5. 全局注册 `AuthGuard`（`APP_GUARD`）+ `@Public()` 装饰器；
6. 登录接口改真实校验（bcrypt 比对 + 签发双令牌）；新增 `POST /api/auth/refresh`、`POST /api/auth/logout`；
7. 改密/禁用用户时 `token_version++` + 吊销 refresh；
8. `PermissionGuard` 改读 `req.user`；删除 `parseTokenUserId` 及 mock 逻辑。

### 阶段 C：前端（2 天）
9. `auth/index.ts` 双令牌存储；`role-data` 后刷新 access；
10. 请求层 401 单飞刷新重放；`logout()` 上报吊销；
11. 登录/切换角色/登出全流程联调（含多 tab 并发、刷新页恢复会话）。

### 阶段 D：收尾（1 天）
12. 登录限流（§5 #11）、HTTPS 强校验、密钥轮换预案；
13. 全量回归：三管理模块 CRUD（含 `@RequirePermission` 拦截）、WS 通知、子应用独立运行不受影响；
14. 清理文档/注释中的 mock-token 表述。

---

## 8. 风险与回滚

| 风险 | 影响 | 缓解 |
|------|------|------|
| 旧会话全量失效 | 升级瞬间在线的用户被登出 | 部署窗口内接受；或保留 mock-token 兼容解析 1 个版本（`parseTokenUserId` 先判 JWT 再判 mock），灰度切换 |
| 多 tab 并发刷新 | 旋转竞争，后者 401 | 单飞 + 前端刷新失败仅登出当前 tab，重登即恢复；后端原子吊销兜底 |
| 时钟偏移（误判过期） | 临近过期请求被 401 | `clockTolerance: 30s`；前端在 `expiresIn - 60s` 主动预刷新 |
| `JWT_SECRET` 泄露 | 任意伪造 token | 环境变量注入 + 启动强校验 + 轮换预案（支持 `JWT_SECRET_OLD` 双验签灰度） |
| bcrypt 兼容问题（明文存量） | 存量用户无法登录 | 登录时若命中明文则先比对再即时升级为 bcrypt 哈希（`password` 字段渐进迁移），迁移脚本不一次性批量改写 |

**回滚**：代码层面保留 `mock-token` 解析分支（配置开关 `AUTH_MODE=jwt|mock`，默认 jwt，出问题切回 mock），数据库迁移为增量（`ADD COLUMN`/`CREATE TABLE` 可安全回退或忽略）。

---

## 9. 验收清单

- [ ] 无 `JWT_SECRET` 或弱密钥时服务启动失败；
- [ ] 未带/伪造/过期 token 访问受保护接口 → `40100/40101` 统一 JSON 错误，不带异常堆栈；
- [ ] `alg=none` 篡改 token 被拒；改 `iss`/`aud` 被拒；
- [ ] 登录返回 `accessToken`(15min) + `refreshToken`(7d)，7 天内刷新成功且旧 refresh 复用报 `40102`；
- [ ] 登出后 refresh 刷新失败；改密/禁用后旧 access 立即失效（≤1 次请求内）；
- [ ] 前端：access 过期时 401 自动刷新重放，用户无感知；刷新失败跳登录页；多 tab 并发仅一次刷新请求；
- [ ] 按钮级权限回归：无权限用户调 `sys:user:create` 等接口仍被 `40300` 拒绝（`PermissionGuard` 行为不变）；
- [ ] WS 通知、角色切换、菜单树回显、子应用独立运行（mock 模式）均不回归；
- [ ] 日志无完整 token 明文；库中 `refresh_tokens.token_hash` 无法反推 token。

---

## 附录：改动文件清单

| 关注点 | 文件 |
|--------|------|
| SQL 迁移 | `server/sql/*-jwt.sql`（新增） |
| 配置 | `server/.env.development` / `.env.production`、`server/src/config.ts`（或 config 模块） |
| 认证服务 | `server/src/modules/auth/auth.module.ts` / `auth.service.ts` / `auth.controller.ts`（新增） |
| 守卫 | `server/src/common/jwt/auth.guard.ts`、`common/permission.guard.ts`（改）、`common/auth-token.ts`（删） |
| 业务服务 | `server/src/modules/user/user.service.ts` / `user.controller.ts`（登录/切换/登出改造） |
| 前端存储 | `packages/utils/src/auth/index.ts` |
| 前端请求 | `packages/utils/src/request/index.ts`（401 单飞刷新） |
| 文档 | `docs/SYSTEM-DESIGN.md` §9.1-2（本方案落地后置「已完成」） |
