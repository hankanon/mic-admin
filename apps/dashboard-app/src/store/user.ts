import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getToken,
  getUserInfo,
  setToken,
  setUserInfo,
  removeToken,
  removeUserInfo,
  isMicroEnv,
  getGlobalData,
  emitToMain,
  MicroMsgType,
  type UserInfo,
} from '@mic/utils'

export const useUserStore = defineStore('dashboard-user', () => {
  const token = ref<string>('')
  const userInfo = ref<UserInfo | null>(null)

  function init() {
    if (isMicroEnv()) {
      const global = getGlobalData<{ token?: string; userInfo?: UserInfo }>()
      if (global?.token) {
        setToken(global.token)
        token.value = global.token
      }
      if (global?.userInfo) {
        setUserInfo(global.userInfo)
        userInfo.value = global.userInfo
      }
    } else {
      token.value = getToken() || ''
      userInfo.value = getUserInfo()
    }
  }

  async function login(payload: { username: string; password: string }) {
    const mockUser: UserInfo = {
      id: 1,
      name: payload.username,
      roles: ['dashboard-viewer'],
      permissions: ['dashboard:view'],
    }
    setToken(`mock-token-${payload.username}`)
    setUserInfo(mockUser)
    token.value = getToken() || ''
    userInfo.value = mockUser
    return mockUser
  }

  function logout() {
    removeToken()
    removeUserInfo()
    token.value = ''
    userInfo.value = null
    emitToMain({ type: MicroMsgType.Logout })
  }

  return { token, userInfo, init, login, logout }
})
