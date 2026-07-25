export type AppKey = 'doc' | 'sys'

export type MenuType = 'catalog' | 'menu'

export interface Menu {
  id: number
  appKey: AppKey
  /** 父菜单 id，0 表示根级 */
  parentId: number
  title: string
  icon?: string
  /** 叶子菜单的前端路由 path（目录类型可留空） */
  path?: string
  type: MenuType
  /** 同级排序，数值越小越靠前 */
  order: number
  visible: boolean
  /** 权限标识，可选 */
  permission?: string
  createdAt: string
  updatedAt: string
}

export interface Role {
  id: number
  name: string
  /** 角色唯一标识（字母/数字/下划线） */
  code: string
  /** 可访问的子应用 */
  appKeys: AppKey[]
  /** 可访问的菜单 id 集合 */
  menuIds: number[]
  description?: string
  createdAt: string
  updatedAt: string
}

export type UserStatus = 'active' | 'disabled'

export interface User {
  id: number
  /** 登录用户名，唯一 */
  username: string
  name: string
  email: string
  phone?: string
  status: UserStatus
  /** 关联的角色 id 集合 */
  roleIds: number[]
  createdAt: string
  updatedAt: string
}

/** 菜单树节点（列表/树接口返回，含 children） */
export interface MenuNode extends Menu {
  children?: MenuNode[]
}
