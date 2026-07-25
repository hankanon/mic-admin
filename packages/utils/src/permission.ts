/**
 * 账号与权限预设（演示用）。
 *
 * 权限采用「应用级」划分：每个账号拥有一组应用权限标识（doc / sys），'*' 表示全部。
 * - admin：拥有全部权限（doc + sys）
 * - user1：仅文档发布（doc）
 * - user2：仅系统管理（sys）
 */

export interface AccountPreset {
  username: string
  password: string
  name: string
  roles: string[]
  permissions: string[]
}

/** 演示账号统一密码 */
export const DEMO_PASSWORD = '12345'

export const ACCOUNT_PRESETS: Record<string, AccountPreset> = {
  admin: {
    username: 'admin',
    password: DEMO_PASSWORD,
    name: '超级管理员',
    roles: ['admin'],
    permissions: ['*'],
  },
  user1: {
    username: 'user1',
    password: DEMO_PASSWORD,
    name: '文档发布员',
    roles: ['doc'],
    permissions: ['doc'],
  },
  user2: {
    username: 'user2',
    password: DEMO_PASSWORD,
    name: '系统管理员',
    roles: ['sys'],
    permissions: ['sys'],
  },
}

/** 可供切换的账号下拉项（不含密码，供 UI 展示与切换） */
export const SWITCHABLE_ACCOUNTS = Object.values(ACCOUNT_PRESETS).map((a) => ({
  username: a.username,
  name: a.name,
}))

/** 判断权限列表是否包含某应用的访问权限 */
export function hasAppPermission(permissions: string[] | undefined, appKey: string): boolean {
  if (!permissions || permissions.length === 0) return false
  if (permissions.includes('*')) return true
  return permissions.includes(appKey)
}

/** 校验账号（用户名 + 密码），成功返回预设账号，失败返回 null */
export function findAccount(username: string, password: string): AccountPreset | null {
  const acc = ACCOUNT_PRESETS[username]
  if (!acc) return null
  if (acc.password !== password) return null
  return acc
}
