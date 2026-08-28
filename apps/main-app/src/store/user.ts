import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getToken,
  getRefreshToken,
  getUserInfo,
  setTokens,
  setUserInfo,
  scheduleRefresh,
  logout as clearAuth,
  request,
  silentRefresh,
  type UserInfo,
} from '@mic/utils'
import type { MenuItem } from '@mic/types'

/** 后端登录返回结构（真实 JWT：access/refresh 令牌对） */
interface LoginResponse {
  accessToken: string
  refreshToken: string
  /** access token 有效期（秒），用于主动预刷新调度 */
  expiresIn: number
  user: {
    id: number
    username: string
    name: string
    roles: { id: number; name: string; code: string }[]
    currentRoleId: number | null
    permissions: string[]
    menus: MenuItem[]
    /** 按钮级权限点集合 */
    buttons: string[]
  }
}

/** 角色权限数据（切换角色接口返回，另附重签的 access token） */
interface RoleDataResponse {
  permissions: string[]
  menus: MenuItem[]
  /** 按钮级权限点集合 */
  buttons: string[]
  accessToken: string
  expiresIn: number
}

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(getToken() || '')
  const userInfo = ref<UserInfo | null>(getUserInfo())

  function init() {
    token.value = getToken() || ''
    userInfo.value = getUserInfo()
  }

  /**
   * 登录：调用后端 /users/login 校验账号密码，成功保存 JWT 令牌对与用户信息
   * （含角色列表、当前角色权限与菜单树），并调度 access token 主动预刷新。
   */
  async function login(payload: { username: string; password: string }) {
    const res = await request.post<LoginResponse>('/users/login', {
      username: payload.username.trim(),
      password: payload.password,
    })
    const { accessToken, refreshToken, expiresIn, user } = res.data
    const info: UserInfo = {
      id: user.id,
      username: user.username,
      name: user.name,
      roleList: user.roles,
      currentRoleId: user.currentRoleId,
      permissions: user.permissions,
      menus: user.menus,
      buttons: user.buttons ?? [],
    }
    setTokens(accessToken, refreshToken)
    setUserInfo(info)
    token.value = accessToken
    userInfo.value = info
    scheduleRefresh(expiresIn, silentRefresh)
    return info
  }

  /**
   * 切换角色：调用后端 /users/role-data 拉取目标角色的权限与菜单，
   * 后端会重签 access token（含新 roleId），refresh 保持不旋转。
   * 失败时抛错（保持原角色不变）。
   */
  async function switchRole(roleId: number) {
    if (!userInfo.value) throw new Error('尚未登录')
    const res = await request.get<RoleDataResponse>('/users/role-data', {
      params: { roleId },
    })
    const next: UserInfo = {
      ...userInfo.value,
      currentRoleId: roleId,
      permissions: res.data.permissions,
      menus: res.data.menus,
      buttons: res.data.buttons ?? [],
    }
    setUserInfo(next)
    userInfo.value = next
    setTokens(res.data.accessToken, getRefreshToken() ?? '')
    token.value = res.data.accessToken
    scheduleRefresh(res.data.expiresIn, silentRefresh)
    return next
  }

  /**
   * 登出：同步清理本地登录态（含刷新定时器），并尽力通知后端吊销 refresh
   * （上报失败不阻塞本地清理，access 会自然过期兜底）。
   */
  function logout() {
    clearAuth()
    token.value = ''
    userInfo.value = null
    request.post('/auth/logout').catch(() => {})
  }

  return { token, userInfo, init, login, switchRole, logout }
})
