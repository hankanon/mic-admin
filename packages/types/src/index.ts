/**
 * 跨包共享类型定义。
 *
 * 菜单节点类型在此统一收敛（基座后端 user-server、基座 main-app、子应用公共包
 * @mic/components 三处共用同一结构），避免 AuthMenuItem 与 MenuItem 重复定义
 * 与 `as unknown as` 类型断言漂移。
 */

/** 子应用标识（与前端路由 / 菜单顶级 appKey 对齐） */
export type AppKey = 'dashboard' | 'doc' | 'qa' | 'profile' | 'sys'

/**
 * 菜单树节点。
 * - 顶级项：key = appKey，appKey 有值，path 通常缺省（catalog 分组型）
 * - 叶子项：key = `menu-{id}`，path 为完整路由（含子应用前缀）
 */
export interface MenuItem {
  key: string
  title: string
  icon?: string
  /** 完整路径（含子应用前缀）；分组型菜单无 path */
  path?: string
  appKey?: AppKey
  children?: MenuItem[]
}
