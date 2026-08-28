/**
 * 按钮级权限点常量（与后端 server/src/common/permissions.ts 保持一致）。
 *
 * 前端 `v-permission` 指令 / `usePermission` 消费的标识，
 * 必须与后端 `@RequirePermission` 声明的值同源，否则前后端鉴权会不一致。
 */

/** 系统管理 - 菜单管理 */
export const MENU_PERMISSIONS = {
  create: 'sys:menu:create',
  update: 'sys:menu:update',
  remove: 'sys:menu:remove',
} as const

/** 系统管理 - 角色管理 */
export const ROLE_PERMISSIONS = {
  create: 'sys:role:create',
  update: 'sys:role:update',
  remove: 'sys:role:remove',
} as const

/** 系统管理 - 人员管理 */
export const USER_PERMISSIONS = {
  create: 'sys:user:create',
  update: 'sys:user:update',
  remove: 'sys:user:remove',
} as const
