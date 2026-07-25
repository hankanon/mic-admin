export type AppKey = 'doc' | 'sys'
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

export interface RoleView {
  id: number
  name: string
  code: string
  appKeys: AppKey[]
  menuIds: number[]
  description?: string
  /** 关联菜单标题（后端视图附带） */
  menuTitles: string[]
  createdAt?: string
  updatedAt?: string
}

export type RolePayload = Omit<RoleView, 'id' | 'menuTitles' | 'createdAt' | 'updatedAt'>

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
  createdAt?: string
  updatedAt?: string
}

export type UserPayload = Omit<UserView, 'id' | 'roleNames' | 'createdAt' | 'updatedAt'>
