import { ApiError } from '../errors'
import { db, nextId } from '../store'
import type { AppKey, Menu, MenuNode } from '../types'
import type { MenuCreateInput, MenuUpdateInput } from '../schemas'

function findMenu(id: number): Menu | undefined {
  return db.menus.find((m) => m.id === id)
}

/** 判断 candidateId 是否为 menuId 的后代（用于循环引用检测） */
function isDescendant(menuId: number, candidateId: number): boolean {
  let current = findMenu(candidateId)
  while (current && current.parentId !== 0) {
    if (current.parentId === menuId) return true
    current = findMenu(current.parentId)
  }
  return false
}

/** 扁平列表：可按 appKey 过滤，按 parentId/order 排序 */
export function list(appKey?: string): Menu[] {
  const items = appKey ? db.menus.filter((m) => m.appKey === appKey) : db.menus
  return [...items].sort((a, b) =>
    a.parentId === b.parentId ? a.order - b.order : a.parentId - b.parentId,
  )
}

/** 树形结构：可按 appKey 过滤 */
export function tree(appKey?: string): MenuNode[] {
  const items = list(appKey)
  const map = new Map<number, MenuNode>()
  items.forEach((m) => map.set(m.id, { ...m, children: [] }))
  const roots: MenuNode[] = []
  map.forEach((node) => {
    if (node.parentId === 0) {
      roots.push(node)
    } else {
      const parent = map.get(node.parentId)
      if (parent) parent.children!.push(node)
      else roots.push(node) // 父级不存在时兜底为根
    }
  })
  return roots
}

export function get(id: number): Menu {
  const menu = findMenu(id)
  if (!menu) throw new ApiError('菜单不存在', 40400)
  return menu
}

export function create(input: MenuCreateInput): Menu {
  if (input.parentId !== 0) {
    const parent = findMenu(input.parentId)
    if (!parent) throw new ApiError('父菜单不存在', 40400)
    if (parent.appKey !== input.appKey) {
      throw new ApiError('父菜单与目标菜单所属子应用不一致', 40000)
    }
  }
  const now = new Date().toISOString()
  const menu: Menu = {
    id: nextId('menu'),
    appKey: input.appKey,
    parentId: input.parentId,
    title: input.title,
    icon: input.icon,
    path: input.path,
    type: input.type,
    order: input.order,
    visible: input.visible,
    permission: input.permission,
    createdAt: now,
    updatedAt: now,
  }
  db.menus.push(menu)
  return menu
}

export function update(id: number, input: MenuUpdateInput): Menu {
  const menu = get(id)
  if (input.parentId !== undefined) {
    if (input.parentId === id) throw new ApiError('不能将菜单设为自身的父级', 40000)
    if (isDescendant(id, input.parentId)) {
      throw new ApiError('不能将菜单移动到其自身的子级下', 40000)
    }
    if (input.parentId !== 0) {
      const parent = findMenu(input.parentId)
      if (!parent) throw new ApiError('父菜单不存在', 40400)
      const targetApp = input.appKey ?? menu.appKey
      if (parent.appKey !== targetApp) {
        throw new ApiError('父菜单与目标菜单所属子应用不一致', 40000)
      }
    }
  }
  const now = new Date().toISOString()
  Object.assign(menu, input, { updatedAt: now })
  return menu
}

export function remove(id: number): void {
  const menu = get(id)
  const hasChildren = db.menus.some((m) => m.parentId === id)
  if (hasChildren) {
    throw new ApiError('该菜单下存在子菜单，请先删除子菜单', 40000)
  }
  const usedBy = db.roles
    .filter((r) => r.menuIds.includes(id))
    .map((r) => r.name)
  if (usedBy.length) {
    throw new ApiError(`菜单已被角色【${usedBy.join('、')}】使用，无法删除`, 40000)
  }
  db.menus = db.menus.filter((m) => m.id !== id)
}

export type { AppKey }
