/**
 * 按钮级权限点常量（前后端同源）。
 *
 * 前端 `v-permission` / `usePermission` 消费的标识、后端 `@RequirePermission`
 * 声明的守卫标识，均取自本文件，避免两侧硬编码字符串不一致导致鉴权失效。
 *
 * 命名规范：`{appKey}:{resource}:{action}`
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

/**
 * 菜单 id → 该菜单下可授权的按钮权限点选项。
 * 角色管理页据此渲染「勾选菜单 → 展开勾选按钮」的授权 UI；
 * 前端各管理页的按钮标识与此处一一对应。
 */
export const MENU_PERMISSION_OPTIONS: Record<
  number,
  { code: string; label: string }[]
> = {
  // sys 菜单 id 见 seed.sql：5010100=菜单管理、5010200=角色管理、5010300=人员管理
  5010100: [
    { code: MENU_PERMISSIONS.create, label: '新增菜单' },
    { code: MENU_PERMISSIONS.update, label: '编辑菜单' },
    { code: MENU_PERMISSIONS.remove, label: '删除菜单' },
  ],
  5010200: [
    { code: ROLE_PERMISSIONS.create, label: '新增角色' },
    { code: ROLE_PERMISSIONS.update, label: '编辑角色' },
    { code: ROLE_PERMISSIONS.remove, label: '删除角色' },
  ],
  5010300: [
    { code: USER_PERMISSIONS.create, label: '新增人员' },
    { code: USER_PERMISSIONS.update, label: '编辑人员' },
    { code: USER_PERMISSIONS.remove, label: '删除人员' },
  ],
}

/** 全部合法权限点集合（用于入参校验与兜底过滤） */
export const ALL_PERMISSION_CODES: string[] = Array.from(
  new Set(
    Object.values(MENU_PERMISSION_OPTIONS).flatMap((list) =>
      list.map((o) => o.code),
    ),
  ),
)
