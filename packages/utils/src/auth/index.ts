import { getStorage, setStorage, removeStorage, clearStorage } from '../storage'

const TOKEN_KEY = 'token'
const USER_KEY = 'user_info'

/** 角色摘要（后端登录返回） */
export interface RoleBrief {
  id: number
  name: string
  code?: string
}

/** 登录态菜单节点（与 @mic/components 的 MenuItem 结构对齐，避免循环依赖单独定义） */
export interface AuthMenuItem {
  key: string
  title: string
  icon?: string
  /** 完整路径（含子应用前缀）；分组型菜单无 path */
  path?: string
  appKey?: string
  children?: AuthMenuItem[]
}

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
  menus?: AuthMenuItem[]
  /** 按钮级权限点集合（后端登录/切换角色返回，供 v-permission 消费） */
  buttons?: string[]
}

/** 写入 token（默认 7 天过期） */
export function setToken(token: string, expires = 7 * 24 * 60 * 60 * 1000): void {
  setStorage(TOKEN_KEY, token, { expires })
}

export function getToken(): string | null {
  return getStorage<string>(TOKEN_KEY)
}

export function removeToken(): void {
  removeStorage(TOKEN_KEY)
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

/** 登出清理：token + 用户信息 */
export function logout(): void {
  removeToken()
  removeUserInfo()
  clearStorage()
}
