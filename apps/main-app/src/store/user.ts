import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getToken,
  getUserInfo,
  setToken,
  setUserInfo,
  removeToken,
  removeUserInfo,
  type UserInfo,
} from '@mic/utils'
import { ACCOUNT_PRESETS, findAccount } from '@mic/utils'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(getToken() || '')
  const userInfo = ref<UserInfo | null>(getUserInfo())

  function init() {
    token.value = getToken() || ''
    userInfo.value = getUserInfo()
  }

  /** 从预设账号构造 UserInfo */
  function buildUserInfo(acc: { username: string; name: string; roles: string[]; permissions: string[] }): UserInfo {
    return { id: acc.username, name: acc.name, roles: acc.roles, permissions: acc.permissions }
  }

  /** 登录：校验预设账号（admin / user1 / user2，密码 12345）；失败抛错 */
  async function login(payload: { username: string; password: string }) {
    const acc = findAccount(payload.username.trim(), payload.password)
    if (!acc) {
      throw new Error('账号或密码错误（可用账号：admin / user1 / user2，密码 12345）')
    }
    const user = buildUserInfo(acc)
    setToken(`mock-token-${acc.username}`)
    setUserInfo(user)
    token.value = getToken() || ''
    userInfo.value = user
    return user
  }

  /** 便捷切换账号（无需密码，仅限预设账号）；返回 userInfo 或抛错 */
  function switchAccount(username: string) {
    const acc = ACCOUNT_PRESETS[username]
    if (!acc) throw new Error('未知账号')
    const user = buildUserInfo(acc)
    setToken(`mock-token-${acc.username}`)
    setUserInfo(user)
    token.value = getToken() || ''
    userInfo.value = user
    return user
  }

  function logout() {
    removeToken()
    removeUserInfo()
    token.value = ''
    userInfo.value = null
  }

  return { token, userInfo, init, login, switchAccount, logout }
})
