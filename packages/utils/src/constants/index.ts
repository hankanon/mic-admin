/** 菜单 key 枚举（与 menuConfig 保持一致，避免拼写漂移） */
export enum MenuKey {
  Home = 'home',
  Doc = 'doc',
  DocList = 'doc-list',
  DocPublish = 'doc-publish',
  Sys = 'sys',
  SysMenu = 'sys-menu',
  SysRole = 'sys-role',
  SysUser = 'sys-user',
}

/** 子应用 key 枚举 */
export type AppKey = 'dashboard' | 'doc' | 'profile' | 'qa' | 'sys'

/** 各子应用集成运行时基座分配的 baseroute（与 main-app micro/apps.ts 保持一致） */
export const APP_BASEROUTES: Record<AppKey, string> = {
  dashboard: '/dashboard',
  doc: '/doc',
  profile: '/profile',
  qa: '/qa',
  sys: '/sys',
}

/** 默认访问端口（便于各应用对齐，实际以各自 vite 配置为准） */
export const APP_PORTS = {
  main: 3000,
  doc: 3001,
  sys: 3003,
} as const

/** 通信消息类型 */
export const MicroMsgType = {
  RouteChange: 'route-change',
  Unauthorized: 'unauthorized',
  Logout: 'logout',
  RefreshUser: 'refresh-user',
  /** 子应用请求基座切换到指定应用路由（跨应用跳转） */
  Navigate: 'navigate',
} as const

/** storage / 环境通用常量 */
export const STORAGE_PREFIX = 'mic_admin_'
