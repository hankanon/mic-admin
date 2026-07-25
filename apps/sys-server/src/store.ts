import type { Menu, Role, User } from './types'

/**
 * 内存数据存储（演示用，重启即恢复初始种子数据）。
 * 生产环境可替换为数据库实现，service 层无需改动。
 */
const now = () => new Date().toISOString()

const seedMenus: Menu[] = [
  { id: 1, appKey: 'doc', parentId: 0, title: '文档列表', path: '/doc/list', type: 'menu', order: 1, visible: true, createdAt: now(), updatedAt: now() },
  { id: 2, appKey: 'doc', parentId: 0, title: '发布管理', path: '/doc/publish', type: 'menu', order: 2, visible: true, createdAt: now(), updatedAt: now() },
  { id: 5, appKey: 'sys', parentId: 0, title: '菜单管理', path: '/sys/menu', type: 'menu', order: 1, visible: true, createdAt: now(), updatedAt: now() },
  { id: 6, appKey: 'sys', parentId: 0, title: '角色管理', path: '/sys/role', type: 'menu', order: 2, visible: true, createdAt: now(), updatedAt: now() },
  { id: 7, appKey: 'sys', parentId: 0, title: '人员管理', path: '/sys/user', type: 'menu', order: 3, visible: true, createdAt: now(), updatedAt: now() },
  { id: 8, appKey: 'sys', parentId: 0, title: '系统配置', type: 'catalog', order: 0, visible: true, createdAt: now(), updatedAt: now() },
  { id: 9, appKey: 'sys', parentId: 8, title: '基础设置', path: '/sys/setting', type: 'menu', order: 1, visible: true, createdAt: now(), updatedAt: now() },
]

const seedRoles: Role[] = [
  { id: 1, name: '超级管理员', code: 'super-admin', appKeys: ['doc', 'sys'], menuIds: [1, 2, 5, 6, 7, 8, 9], description: '拥有全部子应用与菜单权限', createdAt: now(), updatedAt: now() },
  { id: 2, name: '文档编辑', code: 'doc-editor', appKeys: ['doc'], menuIds: [1, 2], description: '仅可访问文档发布应用', createdAt: now(), updatedAt: now() },
  { id: 3, name: '系统管理员', code: 'sys-admin', appKeys: ['sys'], menuIds: [5, 6, 7, 8, 9], description: '管理菜单/角色/人员', createdAt: now(), updatedAt: now() },
]

const seedUsers: User[] = [
  { id: 1, username: 'admin', name: '管理员', email: 'admin@example.com', phone: '13800000000', status: 'active', roleIds: [1], createdAt: now(), updatedAt: now() },
  { id: 2, username: 'editor', name: '编辑小李', email: 'editor@example.com', phone: '13800000001', status: 'active', roleIds: [2], createdAt: now(), updatedAt: now() },
  { id: 3, username: 'sysop', name: '系统运维', email: 'sysop@example.com', phone: '13800000002', status: 'active', roleIds: [3], createdAt: now(), updatedAt: now() },
  { id: 4, username: 'guest', name: '访客', email: 'guest@example.com', status: 'disabled', roleIds: [3], createdAt: now(), updatedAt: now() },
]

export const db = {
  menus: seedMenus,
  roles: seedRoles,
  users: seedUsers,
}

const counters: Record<'menu' | 'role' | 'user', number> = {
  menu: 9,
  role: 3,
  user: 4,
}

/** 自增主键 */
export function nextId(type: 'menu' | 'role' | 'user'): number {
  return (counters[type] += 1)
}
