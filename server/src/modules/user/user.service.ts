import { Inject, Injectable } from '@nestjs/common'
import type { Pool } from 'mysql2/promise'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { ApiError } from '../../common/errors'
import type { User } from '../../common/types'
import type { UserCreateInput, UserUpdateInput, LoginInput } from '../../common/schemas'

interface UserRow extends RowDataPacket {
  id: number
  username: string
  name: string
  email: string
  phone: string | null
  status: string
  password: string | null
  created_at: Date | string
  updated_at: Date | string
}

export interface UserView extends User {
  /** 关联角色名称，便于前端展示 */
  roleNames: string[]
}

/** 角色摘要（登录态返回给前端） */
export interface RoleBrief {
  id: number
  name: string
  code: string
}

/** 登录态菜单节点（与前端 MenuItem 结构对齐） */
export interface AuthMenuItem {
  key: string
  title: string
  icon?: string
  /** 完整路径（含子应用前缀）；分组型菜单无 path */
  path?: string
  appKey?: string
  children?: AuthMenuItem[]
}

/** 角色权限数据：应用权限 + 菜单树 + 按钮权限点 */
export interface RoleData {
  permissions: string[]
  menus: AuthMenuItem[]
  /** 按钮级权限点集合（聚合自 role_menus.permissions） */
  buttons: string[]
}

/** 登录返回：token + 用户信息（含当前角色权限、菜单与按钮权限点） */
export interface LoginResult {
  token: string
  user: {
    id: number
    username: string
    name: string
    roles: RoleBrief[]
    currentRoleId: number | null
    permissions: string[]
    menus: AuthMenuItem[]
    /** 按钮级权限点集合 */
    buttons: string[]
  }
}

function mapUser(r: UserRow): User {
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    email: r.email,
    phone: r.phone ?? undefined,
    status: r.status as User['status'],
    roleIds: [],
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

@Injectable()
export class UserService {
  constructor(@Inject('MYSQL_POOL') private readonly pool: Pool) {}

  private async findRow(id: number): Promise<UserRow | undefined> {
    const [rows] = await this.pool.query<UserRow[]>(
      'SELECT * FROM `users` WHERE `id` = ?',
      [id],
    )
    return rows[0]
  }

  private async loadRoleIds(userId: number): Promise<number[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT `role_id` FROM `user_roles` WHERE `user_id` = ?',
      [userId],
    )
    return rows.map((r) => r.role_id as number)
  }

  private async loadRoleNames(roleIds: number[]): Promise<string[]> {
    if (!roleIds.length) return []
    const placeholders = roleIds.map(() => '?').join(',')
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT `name` FROM `roles` WHERE `id` IN (' + placeholders + ')',
      roleIds,
    )
    return rows.map((r) => r.name as string)
  }

  /** 查询用户绑定的角色摘要列表 */
  private async loadRoles(userId: number): Promise<RoleBrief[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT r.`id`, r.`name`, r.`code` FROM `roles` r ' +
        'JOIN `user_roles` ur ON ur.`role_id` = r.`id` WHERE ur.`user_id` = ? ORDER BY r.`id`',
      [userId],
    )
    return rows.map((r) => ({ id: r.id as number, name: r.name as string, code: r.code as string }))
  }

  /**
   * 登录：校验用户名/密码（明文比对）与账号状态，返回 token 及当前角色（首个绑定角色）的权限与菜单。
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const [rows] = await this.pool.query<UserRow[]>(
      'SELECT * FROM `users` WHERE `username` = ?',
      [input.username],
    )
    const row = rows[0]
    if (!row || row.password !== input.password) {
      throw new ApiError('账号或密码错误', 40100)
    }
    if (row.status !== 'active') {
      throw new ApiError('账号已停用，请联系管理员', 40300)
    }
    const roles = await this.loadRoles(row.id)
    if (!roles.length) {
      throw new ApiError('该账号未绑定角色，请联系管理员', 40300)
    }
    const currentRoleId = roles[0].id
    const { permissions, menus, buttons } = await this.buildRoleData(currentRoleId)
    return {
      token: `mock-token-${row.id}-${Date.now()}`,
      user: {
        id: row.id,
        username: row.username,
        name: row.name,
        roles,
        currentRoleId,
        permissions,
        menus,
        buttons,
      },
    }
  }

  /** 切换角色：校验角色归属后返回该角色的权限与菜单 */
  async getRoleData(userId: number, roleId: number): Promise<RoleData> {
    const roleIds = await this.loadRoleIds(userId)
    if (!roleIds.includes(roleId)) {
      throw new ApiError('当前账号未绑定该角色', 40300)
    }
    return this.buildRoleData(roleId)
  }

  /**
   * 构建角色权限数据：
   * - permissions：role_apps 中的应用 key 列表（前端按应用级权限做路由守卫）
   * - menus：role_menus 关联且可见的菜单，按 parent_id 组装为树
   * - buttons：role_menus.permissions 聚合出的按钮级权限点（去重、去空）
   */
  private async buildRoleData(roleId: number): Promise<RoleData> {
    const [appRows] = await this.pool.query<RowDataPacket[]>(
      'SELECT `app_key` FROM `role_apps` WHERE `role_id` = ? ORDER BY `app_key`',
      [roleId],
    )
    const permissions = appRows.map((r) => r.app_key as string)

    const [menuRows] = await this.pool.query<RowDataPacket[]>(
      'SELECT m.`id`, m.`app_key`, m.`parent_id`, m.`title`, m.`icon`, m.`path`, ' +
        'rm.`permissions` AS `role_permissions` ' +
        'FROM `menus` m JOIN `role_menus` rm ON rm.`menu_id` = m.`id` ' +
        'WHERE rm.`role_id` = ? AND m.`visible` = 1 ORDER BY m.`id`',
      [roleId],
    )
    const menus = this.buildMenuTree(menuRows)

    const buttons = new Set<string>()
    menuRows.forEach((r) => {
      const raw = r.role_permissions as string | null
      if (!raw) return
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((p) => buttons.add(p))
    })

    return { permissions, menus, buttons: [...buttons] }
  }

  /** 扁平菜单行 → 树：顶级项 key 取 appKey（与前端路由/高亮逻辑对齐），子项 key 用 menu-{id} */
  private buildMenuTree(rows: RowDataPacket[]): AuthMenuItem[] {
    const nodes = new Map<number, { parentId: number | null; node: AuthMenuItem }>()
    rows.forEach((r) => {
      nodes.set(r.id as number, {
        parentId: (r.parent_id as number | null) ?? null,
        node: {
          key: r.parent_id == null ? (r.app_key as string) : `menu-${r.id}`,
          title: r.title as string,
          icon: (r.icon as string) || undefined,
          path: (r.path as string) || undefined,
          appKey: r.app_key as string,
          children: [],
        },
      })
    })
    const roots: AuthMenuItem[] = []
    nodes.forEach(({ parentId, node }) => {
      const parent = parentId != null ? nodes.get(parentId)?.node : undefined
      if (parent) parent.children!.push(node)
      else roots.push(node)
    })
    // 叶子节点去掉空 children 数组
    const cleanup = (list: AuthMenuItem[]) => {
      list.forEach((n) => {
        if (n.children?.length) cleanup(n.children)
        else delete n.children
      })
    }
    cleanup(roots)
    return roots
  }

  private async toView(userId: number): Promise<UserView> {
    const row = await this.findRow(userId)
    if (!row) throw new ApiError('人员不存在', 40400)
    const roleIds = await this.loadRoleIds(userId)
    const roleNames = await this.loadRoleNames(roleIds)
    return { ...mapUser(row), roleIds, roleNames }
  }

  async list(): Promise<UserView[]> {
    const [rows] = await this.pool.query<UserRow[]>('SELECT * FROM `users` ORDER BY `id`')
    const result: UserView[] = []
    for (const r of rows) {
      const roleIds = await this.loadRoleIds(r.id)
      const roleNames = await this.loadRoleNames(roleIds)
      result.push({ ...mapUser(r), roleIds, roleNames })
    }
    return result
  }

  async get(id: number): Promise<UserView> {
    return this.toView(id)
  }

  private async assertRolesExist(roleIds: number[]) {
    if (!roleIds.length) return
    const placeholders = roleIds.map(() => '?').join(',')
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM `roles` WHERE `id` IN (' + placeholders + ')',
      roleIds,
    )
    if (Number(rows[0].cnt) !== roleIds.length) {
      throw new ApiError('存在不存在的角色 id', 40400)
    }
  }

  async create(input: UserCreateInput): Promise<User> {
    const [dupUser] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM `users` WHERE `username` = ?',
      [input.username],
    )
    if (Number(dupUser[0].cnt) > 0) throw new ApiError('用户名已存在', 40000)
    const [dupEmail] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM `users` WHERE `email` = ?',
      [input.email],
    )
    if (Number(dupEmail[0].cnt) > 0) throw new ApiError('邮箱已存在', 40000)
    await this.assertRolesExist(input.roleIds)

    const [result] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO `users` (`username`, `name`, `email`, `phone`, `status`, `password`) VALUES (?, ?, ?, ?, ?, ?)',
      [input.username, input.name, input.email, input.phone ?? null, input.status, input.password],
    )
    const userId = result.insertId
    if (input.roleIds.length) {
      await this.pool.query(
        'INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES ' +
          input.roleIds.map(() => '(?, ?)').join(', '),
        input.roleIds.flatMap((rid) => [userId, rid]),
      )
    }
    return this.toView(userId)
  }

  async update(id: number, input: UserUpdateInput): Promise<User> {
    const row = await this.findRow(id)
    if (!row) throw new ApiError('人员不存在', 40400)
    if (input.username !== undefined) {
      const [dup] = await this.pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS cnt FROM `users` WHERE `username` = ? AND `id` <> ?',
        [input.username, id],
      )
      if (Number(dup[0].cnt) > 0) throw new ApiError('用户名已存在', 40000)
    }
    if (input.email !== undefined) {
      const [dup] = await this.pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS cnt FROM `users` WHERE `email` = ? AND `id` <> ?',
        [input.email, id],
      )
      if (Number(dup[0].cnt) > 0) throw new ApiError('邮箱已存在', 40000)
    }

    const sets: string[] = []
    const params: unknown[] = []
    if (input.username !== undefined) {
      sets.push('`username` = ?')
      params.push(input.username)
    }
    if (input.name !== undefined) {
      sets.push('`name` = ?')
      params.push(input.name)
    }
    if (input.email !== undefined) {
      sets.push('`email` = ?')
      params.push(input.email)
    }
    if (input.phone !== undefined) {
      sets.push('`phone` = ?')
      params.push(input.phone)
    }
    if (input.status !== undefined) {
      sets.push('`status` = ?')
      params.push(input.status)
    }
    if (input.password !== undefined) {
      sets.push('`password` = ?')
      params.push(input.password)
    }
    if (sets.length) {
      await this.pool.query(
        'UPDATE `users` SET ' + sets.join(', ') + ' WHERE `id` = ?',
        [...params, id],
      )
    }
    if (input.roleIds !== undefined) {
      await this.assertRolesExist(input.roleIds)
      await this.pool.query('DELETE FROM `user_roles` WHERE `user_id` = ?', [id])
      if (input.roleIds.length) {
        await this.pool.query(
          'INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES ' +
            input.roleIds.map(() => '(?, ?)').join(', '),
          input.roleIds.flatMap((rid) => [id, rid]),
        )
      }
    }
    return this.toView(id)
  }

  async remove(id: number): Promise<void> {
    const row = await this.findRow(id)
    if (!row) throw new ApiError('人员不存在', 40400)
    await this.pool.query('DELETE FROM `users` WHERE `id` = ?', [id])
  }
}
