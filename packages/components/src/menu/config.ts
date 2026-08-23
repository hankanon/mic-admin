import { hasAppPermission } from '@mic/utils'

export type AppKey = 'dashboard' | 'doc' | 'profile' | 'qa' | 'sys'

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
  {
    key: 'dashboard',
    title: '首页大盘',
    icon: 'HomeFilled',
    appKey: 'dashboard',
    children: [
      { key: 'dashboard-overview', title: '数据总览', path: '/' },
      { key: 'dashboard-analytics', title: '访问分析', path: '/dashboard/analytics' },
      { key: 'dashboard-docs', title: '文档统计', path: '/dashboard/docs-stat' },
      { key: 'dashboard-users', title: '用户统计', path: '/dashboard/users-stat' },
      { key: 'dashboard-notice', title: '系统公告', path: '/dashboard/notice' },
    ],
  },
  {
    key: 'doc',
    title: '文档管理',
    icon: 'Document',
    appKey: 'doc',
      children: [
        { key: 'doc-list', title: '文档列表', path: '/doc/list' },
        { key: 'doc-publish', title: '发布管理', path: '/doc/publish' },
        { key: 'doc-edit', title: '新增文档', path: '/doc/edit' },
        { key: 'doc-preview', title: '文档预览', path: '/doc/preview' },
        {
          key: 'doc-demo',
          title: '示例展示',
          path: '/doc/protable',
          children: [
            { key: 'doc-demo-index', title: '示例总览', path: '/doc/protable' },
            { key: 'doc-demo-multi-header', title: '多表头示例', path: '/doc/protable/multi-header' },
            { key: 'doc-demo-slot', title: '自定义插槽示例', path: '/doc/protable/slot' },
            { key: 'doc-demo-single', title: '单选模式示例', path: '/doc/protable/single' },
            { key: 'doc-demo-multi', title: '多选模式示例', path: '/doc/protable/multi' },
            { key: 'doc-demo-span', title: '单元格合并示例', path: '/doc/protable/span' },
          ],
        },
      ],
  },
  {
    key: 'qa',
    title: '智能问答',
    icon: 'ChatDotRound',
    appKey: 'qa',
    children: [
      { key: 'qa-new', title: '新建会话', path: '/qa/new' },
      { key: 'qa-history', title: '历史会话', path: '/qa/history' },
      { key: 'qa-config', title: '模型配置', path: '/qa/config' },
    ],
  },
  {
    key: 'profile',
    title: '个人中心',
    icon: 'User',
    appKey: 'profile',
    children: [
      { key: 'profile-view', title: '个人视图', path: '/profile/view' },
      { key: 'profile-todo', title: '待办事项', path: '/profile/todo' },
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

/** 去掉子应用前缀：/doc/list → /list，/dashboard/analytics → /analytics，/profile/view → /view，/qa/new → /new，/ 保持不变 */
export function stripAppPrefix(path: string): string {
  const matched = path.match(/^\/(dashboard|doc|profile|qa|sys)(\/.*)?$/)
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
 * 按权限过滤菜单：无应用归属的项始终保留；首页大盘（dashboard）、个人中心（profile）、智能问答（qa）作为公共入口始终保留；
 * 无应用访问权限的顶级分组（及其全部子项）将被移除。
 */
export function filterMenusByPermissions(
  menus: MenuItem[],
  permissions: string[] | undefined,
): MenuItem[] {
  const publicApps = ['dashboard', 'profile', 'qa']
  return menus
    .filter((m) => (!m.appKey || publicApps.includes(m.appKey)) ? true : hasAppPermission(permissions, m.appKey))
    .map((m) => ({ ...m, children: m.children ? m.children.map((c) => ({ ...c })) : undefined }))
}
