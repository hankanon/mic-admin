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
export type AppKey = 'doc' | 'sys'

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
} as const

/** storage / 环境通用常量 */
export const STORAGE_PREFIX = 'mic_admin_'
