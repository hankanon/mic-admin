/**
 * 演示账号预设（与数据库 users 表初始数据保持一致）。
 *
 * 真实登录走后端 `/users/login` 接口（用户名 + 密码比对）；
 * 此预设仅用于登录页「演示账号」快捷标签展示。
 */

export interface AccountPreset {
  username: string
  password: string
  name: string
  roles: string[]
  permissions: string[]
}

/** 演示账号统一密码 */
export const DEMO_PASSWORD = '123456'

export const ACCOUNT_PRESETS: Record<string, AccountPreset> = {
  admin: {
    username: 'admin',
    password: DEMO_PASSWORD,
    name: '超级管理员改',
    roles: ['super-admin', 'doc-editor', 'sys-admin'],
    permissions: ['*'],
  },
  editor: {
    username: 'editor',
    password: DEMO_PASSWORD,
    name: '编辑小李',
    roles: ['doc-editor'],
    permissions: ['doc'],
  },
  sysop: {
    username: 'sysop',
    password: DEMO_PASSWORD,
    name: '系统运维',
    roles: ['sys-admin'],
    permissions: ['sys'],
  },
  guest: {
    username: 'guest',
    password: DEMO_PASSWORD,
    name: '访客',
    roles: ['user'],
    permissions: ['profile'],
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
  if (permissions.includes(appKey)) return true
  // 兼容细粒度权限格式（如 doc:view / sys:menu:view），前缀匹配到应用 key 即视为拥有该应用权限
  return permissions.some((p) => p.startsWith(`${appKey}:`))
}

/** 校验账号（用户名 + 密码），成功返回预设账号，失败返回 null */
export function findAccount(username: string, password: string): AccountPreset | null {
  const acc = ACCOUNT_PRESETS[username]
  if (!acc) return null
  if (acc.password !== password) return null
  return acc
}
