import { getStorage, setStorage, removeStorage, clearStorage } from '../storage'

const TOKEN_KEY = 'token'
const REFRESH_KEY = 'refresh_token'
const USER_KEY = 'user_info'
/** refresh token 有效期（与后端保持一致，7d） */
const REFRESH_EXPIRES = 7 * 24 * 60 * 60 * 1000

/** 角色摘要（后端登录返回） */
export interface RoleBrief {
  id: number
  name: string
  code?: string
}

/** 登录态菜单节点：直接复用 @mic/types 的 MenuItem（消除 AuthMenuItem 重复定义） */
import type { MenuItem } from '@mic/types'
export type { MenuItem }

export interface UserInfo {
  id: string | number
  /** 登录账号名（后端登录返回；独立运行 mock 场景可能没有） */
  username?: string
  name: string
  avatar?: string
  /** 角色标识列表（兼容子应用独立运行的 mock 登录） */
  roles?: string[]
  /** 角色对象列表（后端登录返回，用于切换角色） */
  roleList?: RoleBrief[]
  /** 当前生效角色 id（后端登录返回） */
  currentRoleId?: number | null
  /** 应用级权限列表（如 doc / sys） */
  permissions?: string[]
  /** 当前角色的菜单树（后端登录/切换角色返回） */
  menus?: MenuItem[]
  /** 按钮级权限点集合（后端登录/切换角色返回，供 v-permission 消费） */
  buttons?: string[]
}

/** 写入 access token（默认 7 天过期） */
export function setToken(token: string, expires = 7 * 24 * 60 * 60 * 1000): void {
  setStorage(TOKEN_KEY, token, { expires })
}

export function getToken(): string | null {
  return getStorage<string>(TOKEN_KEY)
}

export function removeToken(): void {
  removeStorage(TOKEN_KEY)
}

/**
 * 写入令牌对：access token（沿用原 token key）+ refresh token（独立 key）。
 * refresh token 永不随请求头发送，仅用于 /auth/refresh 静默续期。
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  setToken(accessToken)
  setStorage(REFRESH_KEY, refreshToken, { expires: REFRESH_EXPIRES })
}

export function getRefreshToken(): string | null {
  return getStorage<string>(REFRESH_KEY)
}

export function removeRefreshToken(): void {
  removeStorage(REFRESH_KEY)
}

export function setUserInfo(user: UserInfo): void {
  setStorage(USER_KEY, user)
}

export function getUserInfo(): UserInfo | null {
  return getStorage<UserInfo>(USER_KEY)
}

export function removeUserInfo(): void {
  removeStorage(USER_KEY)
}

/** 是否处于登录态 */
export function hasToken(): boolean {
  return !!getToken()
}

// ---- 主动预刷新（与请求层 401 被动刷新互补，把"无感"做在前面） ----

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let pendingRefreshFn: (() => Promise<string>) | null = null

/**
 * 调度主动预刷新：access token 到期前 60s 静默换新（由调用方注入刷新函数，
 * 一般为请求层的 silentRefresh）。刷新失败静默忽略，交由 401 被动刷新兜底。
 */
export function scheduleRefresh(expiresInSec: number, refreshFn: () => Promise<string>): void {
  pendingRefreshFn = refreshFn
  clearRefreshTimer()
  const ahead = Math.max((expiresInSec - 60) * 1000, 5_000)
  refreshTimer = setTimeout(() => {
    refreshFn().catch(() => {
      /* 静默失败：401 兜底 */
    })
  }, ahead)
}

export function clearRefreshTimer(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

/** 解析 access token 的过期时间（毫秒时间戳）；解析失败返回 null */
function getAccessExpiresAt(): number | null {
  const token = getToken()
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(
      decodeURIComponent(escape(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))),
    )
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

// 页面从后台切回时兜底检查：剩余有效期不足 2min 则主动刷新
// （浏览器节流可能延迟定时器，如休眠/切 tab 期间）
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !pendingRefreshFn) return
    const exp = getAccessExpiresAt()
    if (exp == null || exp - Date.now() < 120_000) {
      pendingRefreshFn().catch(() => {})
    }
  })
}

/** 登出清理：主动刷新定时器 + token + refresh + 用户信息 */
export function logout(): void {
  clearRefreshTimer()
  pendingRefreshFn = null
  removeToken()
  removeRefreshToken()
  removeUserInfo()
  clearStorage()
}
