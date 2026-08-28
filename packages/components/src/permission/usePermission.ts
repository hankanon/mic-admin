import { computed, type ComputedRef } from 'vue'
import { hasButtonPermission, getUserInfo } from '@mic/utils'
import type { PermissionValue } from './directive'

/**
 * 按钮级权限组合式 API。
 *
 * 用于指令无法覆盖的场景：
 * - 动态渲染（表格行内按钮需配合 `v-if`）；
 * - 需要响应式（切换角色后立即刷新，无需重新挂载）。
 *
 * 用法：
 * ```ts
 * const { can } = usePermission()
 * // 模板：<el-button v-if="can('sys:user:delete')">删除</el-button>
 * ```
 *
 * 各应用若持有自己的 userStore，可传入 getter 以使用应用内的响应式用户态；
 * 不传时回退到持久化用户信息（基座/子应用集成场景行为一致）。
 */
export function usePermission(getUserInfoFn?: () => {
  buttons?: string[]
  permissions?: string[]
} | null): {
  can: (required: PermissionValue) => boolean
  can$: (required: PermissionValue) => ComputedRef<boolean>
} {
  const read = (): { buttons?: string[]; permissions?: string[] } => {
    const custom = getUserInfoFn?.()
    if (custom) return custom
    const info = getUserInfo()
    return { buttons: info?.buttons, permissions: info?.permissions }
  }

  function can(required: PermissionValue): boolean {
    const { buttons, permissions } = read()
    return hasButtonPermission(buttons, required, { permissions })
  }

  function can$(required: PermissionValue): ComputedRef<boolean> {
    return computed(() => can(required))
  }

  return { can, can$ }
}
