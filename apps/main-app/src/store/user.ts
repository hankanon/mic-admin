import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getToken,
  getUserInfo,
  setToken,
  setUserInfo,
  removeToken,
  removeUserInfo,
  request,
  type AuthMenuItem,
  type UserInfo,
} from '@mic/utils'

/** 后端登录返回结构 */
interface LoginResponse {
  token: string
  user: {
    id: number
    username: string
    name: string
    roles: { id: number; name: string; code: string }[]
    currentRoleId: number | null
    permissions: string[]
    menus: AuthMenuItem[]
  }
}

/** 角色权限数据（切换角色接口返回） */
interface RoleDataResponse {
  permissions: string[]
  menus: AuthMenuItem[]
}

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(getToken() || '')
  const userInfo = ref<UserInfo | null>(getUserInfo())

  function init() {
    token.value = getToken() || ''
    userInfo.value = getUserInfo()
  }

  /**
   * 登录：调用后端 /users/login 校验账号密码，
   * 成功后保存 token 与用户信息（含角色列表、当前角色权限与菜单树）。
   */
  async function login(payload: { username: string; password: string }) {
    const res = await request.post<LoginResponse>('/users/login', {
      username: payload.username.trim(),
      password: payload.password,
    })
    const { token: nextToken, user } = res.data
    const info: UserInfo = {
      id: user.id,
      username: user.username,
      name: user.name,
      roleList: user.roles,
      currentRoleId: user.currentRoleId,
      permissions: user.permissions,
      menus: user.menus,
    }
    setToken(nextToken)
    setUserInfo(info)
    token.value = nextToken
    userInfo.value = info
    return info
  }

  /**
   * 切换角色：调用后端 /users/role-data 拉取目标角色的权限与菜单，
   * 更新本地用户态并持久化；失败时抛错（保持原角色不变）。
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
    }
    setUserInfo(next)
    userInfo.value = next
    return next
  }

  function logout() {
    removeToken()
    removeUserInfo()
    token.value = ''
    userInfo.value = null
  }

  return { token, userInfo, init, login, switchRole, logout }
})
