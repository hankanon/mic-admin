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

export const useUserStore = defineStore('doc-user', () => {
  const token = ref<string>('')
  const userInfo = ref<UserInfo | null>(null)

  function init() {
    if (isMicroEnv()) {
      // 集成运行：从主应用下发的全局数据获取登录态
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
      id: 2,
      name: payload.username,
      roles: ['doc-editor'],
      permissions: ['doc:view', 'doc:edit'],
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
    // 集成运行通知主应用统一登出；独立运行由路由守卫跳转 /login
    emitToMain({ type: MicroMsgType.Logout })
  }

  return { token, userInfo, init, login, logout }
})
