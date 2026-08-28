export type AppKey = 'dashboard' | 'doc' | 'qa' | 'profile' | 'sys'
export type MenuType = 'catalog' | 'menu'
export type UserStatus = 'active' | 'disabled'

/** 菜单树节点（tree 接口返回，含 children） */
export interface MenuNode {
  id: number
  appKey: AppKey
  parentId: number
  title: string
  icon?: string
  path?: string
  type: MenuType
  order: number
  visible: boolean
  permission?: string
  createdAt?: string
  updatedAt?: string
  children?: MenuNode[]
}

export type MenuPayload = Omit<MenuNode, 'id' | 'createdAt' | 'updatedAt' | 'children'>

/** 菜单 id（字符串键，JSON 序列化后为字符串）→ 该菜单下已授权的按钮权限点 */
export type MenuPermissionMap = Record<string | number, string[]>

/** 单个按钮权限点选项 */
export interface PermissionOption {
  code: string
  label: string
}

export interface RoleView {
  id: number
  name: string
  code: string
  appKeys: AppKey[]
  menuIds: number[]
  description?: string
  /** 关联菜单标题（后端视图附带） */
  menuTitles: string[]
  /** 关联菜单节点（含层级信息，便于按子应用树形展示） */
  menus: { id: number; title: string; parentId: number; appKey: AppKey }[]
  /** 菜单 id → 该菜单下已授权的按钮权限点（按钮级授权回显） */
  menuPermissions?: MenuPermissionMap
  createdAt?: string
  updatedAt?: string
}

export type RolePayload = Omit<RoleView, 'id' | 'menuTitles' | 'menus' | 'createdAt' | 'updatedAt'> &
  /** 提交时必带：未授权任何按钮时传空对象以清空 */
  { menuPermissions?: MenuPermissionMap }

export interface UserView {
  id: number
  username: string
  name: string
  email: string
  phone?: string
  status: UserStatus
  roleIds: number[]
  /** 关联角色名称（后端视图附带） */
  roleNames: string[]
  /** 登录密码（创建必填，编辑可选；列表不返回明文） */
  password?: string
  createdAt?: string
  updatedAt?: string
}

export type UserPayload = Omit<UserView, 'id' | 'roleNames' | 'createdAt' | 'updatedAt'>
