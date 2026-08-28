import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isCancel } from '@mic/utils'
import { roleApi } from '../api/role'
import { menuApi } from '../api/menu'
import type { AppKey, MenuNode, RolePayload, RoleView } from '../types'

/**
 * 角色管理状态（sys-app）。
 * 集中维护角色列表、菜单树、加载/提交状态，CRUD 与菜单树加载在此收敛，
 * 视图层只负责渲染与交互，不直接触碰 API。
 */
export const useRoleStore = defineStore('sys-role', () => {
  /** 角色列表 */
  const roles = ref<RoleView[]>([])
  /** 列表加载中 */
  const loading = ref(false)
  /** 新增/编辑提交中 */
  const saving = ref(false)
  /** 删除中（按行 id 标记，避免整表禁用） */
  const removingId = ref<number | null>(null)

  /** 当前可选菜单树（按所选子应用过滤后的合并结果） */
  const menuTree = ref<MenuNode[]>([])
  /** 菜单树加载中 */
  const menuTreeLoading = ref(false)

  /** 拉取角色列表 */
  async function fetchRoles(): Promise<void> {
    loading.value = true
    try {
      roles.value = await roleApi.list()
    } finally {
      loading.value = false
    }
  }

  /**
   * 按所选子应用加载菜单树（多应用时合并，父子结构保留）。
   * 空数组时清空。
   *
   * 注意：同一 key 的并发请求会被请求层去重 abort（openEdit 显式加载与
   * appKeys watch 触发加载会同时发生），被取消的请求属预期行为，数据由
   * 后发请求接管，这里静默忽略，避免向上抛出 CanceledError 造成未处理异常。
   */
  async function fetchMenuTree(appKeys: AppKey[]): Promise<void> {
    if (!appKeys.length) {
      menuTree.value = []
      return
    }
    menuTreeLoading.value = true
    try {
      const trees = await Promise.all(appKeys.map((k) => menuApi.tree(k)))
      menuTree.value = trees.flat()
    } catch (e) {
      if (isCancel(e)) return
      throw e
    } finally {
      menuTreeLoading.value = false
    }
  }

  /** 新增角色，返回创建结果 */
  async function createRole(payload: RolePayload): Promise<RoleView> {
    saving.value = true
    try {
      const created = await roleApi.create(payload)
      await fetchRoles()
      return created
    } finally {
      saving.value = false
    }
  }

  /** 更新角色 */
  async function updateRole(id: number, payload: RolePayload): Promise<RoleView> {
    saving.value = true
    try {
      const updated = await roleApi.update(id, payload)
      await fetchRoles()
      return updated
    } finally {
      saving.value = false
    }
  }

  /** 删除角色 */
  async function removeRole(id: number): Promise<void> {
    removingId.value = id
    try {
      await roleApi.remove(id)
      await fetchRoles()
    } finally {
      removingId.value = null
    }
  }

  return {
    roles,
    loading,
    saving,
    removingId,
    menuTree,
    menuTreeLoading,
    fetchRoles,
    fetchMenuTree,
    createRole,
    updateRole,
    removeRole,
  }
})
