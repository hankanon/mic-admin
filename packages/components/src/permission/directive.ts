import type { Directive, DirectiveBinding, App } from 'vue'
import { hasButtonPermission, getUserInfo } from '@mic/utils'

/**
 * 读取当前登录用户的权限集合。
 * 统一取自持久化的用户信息：基座登录后、子应用接收基座下发后都会写入，
 * 因此指令在基座与各子应用中行为一致，无需分别接入 store。
 */
function currentPermissions(): { buttons?: string[]; permissions?: string[] } {
  const info = getUserInfo()
  return { buttons: info?.buttons, permissions: info?.permissions }
}

/** 权限值类型：单个权限点或多个权限点（需全部具备） */
export type PermissionValue = string | string[]

type PermissionBinding = DirectiveBinding<PermissionValue>

function apply(el: HTMLElement, binding: PermissionBinding): void {
  const { buttons, permissions } = currentPermissions()
  const ok = hasButtonPermission(buttons, binding.value ?? [], { permissions })
  if (ok) return

  if (binding.modifiers.disabled) {
    // 无权限但需保留占位：置灰禁用并阻断点击
    el.setAttribute('disabled', 'disabled')
    el.classList.add('is-disabled')
    el.style.pointerEvents = 'none'
    el.style.opacity = '0.5'
  } else {
    // 默认彻底移除，避免隐藏元素仍可被脚本触发
    el.parentNode?.removeChild(el)
  }
}

/**
 * 按钮级权限指令。
 *
 * 用法：
 * - `v-permission="'sys:user:create'"` 无权限时移除元素
 * - `v-permission="['sys:user:edit','sys:user:delete']"` 需全部具备
 * - `v-permission.disabled="'sys:user:remove'"` 无权限时置灰而非移除
 *
 * 说明：指令在 mounted 时判定一次。权限变更（切换角色）会触发页面重新渲染，
 * 如需动态响应可改用 `usePermission()` 的 `can()` 配合 `v-if`。
 */
export const permissionDirective: Directive<HTMLElement, PermissionValue> = {
  mounted: apply,
  updated: apply,
}

/** 全局注册 v-permission 指令 */
export function installPermission(app: App): void {
  app.directive('permission', permissionDirective)
}
