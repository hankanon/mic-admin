import { hasAppPermission } from '@mic/utils'

export type AppKey = 'doc' | 'sys'

export interface MenuItem {
  key: string
  title: string
  icon?: string
  /** 集成运行时的完整路径（含子应用前缀）；含子菜单的分组项无需 path */
  path?: string
  appKey?: AppKey
  children?: MenuItem[]
}

export const menuConfig: MenuItem[] = [
  { key: 'home', title: '首页大盘', icon: 'HomeFilled', path: '/' },
  {
    key: 'doc',
    title: '文档管理',
    icon: 'Document',
    appKey: 'doc',
      children: [
        { key: 'doc-list', title: '文档列表', path: '/doc/list' },
        { key: 'doc-publish', title: '发布管理', path: '/doc/publish' },
        { key: 'doc-edit', title: '新增文档', path: '/doc/edit' },
      ],
  },
  {
    key: 'sys',
    title: '系统管理',
    icon: 'Setting',
    appKey: 'sys',
    children: [
      { key: 'sys-menu', title: '菜单管理', path: '/sys/menu' },
      { key: 'sys-role', title: '角色管理', path: '/sys/role' },
      { key: 'sys-user', title: '人员管理', path: '/sys/user' },
    ],
  },
]

/** 按应用过滤菜单：子应用独立运行时只展示公共菜单 + 本应用菜单 */
export function getMenusByApp(appKey?: AppKey): MenuItem[] {
  if (!appKey) return menuConfig
  return menuConfig.filter((m) => !m.appKey || m.appKey === appKey)
}

/** 去掉子应用前缀：/doc/list → /list，/ 保持不变 */
export function stripAppPrefix(path: string): string {
  const matched = path.match(/^\/(doc|sys)(\/.*)?$/)
  if (matched) return matched[2] || '/'
  return path
}

/**
 * 根据当前路径匹配菜单激活 key。
 * 统一按剥离前缀后的路径比较，host（完整路径）与子应用独立运行（剥离前缀）两种形态通用。
 */
export function matchMenuKey(menus: MenuItem[], fullPath: string): string {
  let active = ''
  const norm = (p: string) => stripAppPrefix(p)
  const walk = (list: MenuItem[], parentPath: string) => {
    for (const item of list) {
      if (item.children?.length) {
        walk(item.children, item.path ? parentPath + item.path : parentPath)
      } else if (item.path) {
        const target = norm(parentPath + item.path)
        const cur = norm(fullPath)
        if (cur === target || cur.startsWith(target + '/')) {
          active = item.key
        }
      }
    }
  }
  walk(menus, '')
  return active
}

/**
 * 按权限过滤菜单：无应用归属的项（如首页）始终保留；
 * 无应用访问权限的顶级分组（及其全部子项）将被移除。
 */
export function filterMenusByPermissions(
  menus: MenuItem[],
  permissions: string[] | undefined,
): MenuItem[] {
  return menus
    .filter((m) => (m.appKey ? hasAppPermission(permissions, m.appKey) : true))
    .map((m) => ({ ...m, children: m.children ? m.children.map((c) => ({ ...c })) : undefined }))
}
