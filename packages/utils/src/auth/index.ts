import { getStorage, setStorage, removeStorage, clearStorage } from '../storage'

const TOKEN_KEY = 'token'
const USER_KEY = 'user_info'

export interface UserInfo {
  id: string | number
  name: string
  avatar?: string
  roles?: string[]
  permissions?: string[]
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
