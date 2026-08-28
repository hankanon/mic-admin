import { Inject, Injectable } from '@nestjs/common'
import type { Pool } from 'mysql2/promise'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { ApiError } from '../../common/errors'
import type { AppKey, Role, MenuPermissionMap } from '../../common/types'
import type { RoleCreateInput, RoleUpdateInput } from '../../common/schemas'
import { PermissionService } from '../../common/permission.service'
import { ALL_PERMISSION_CODES } from '../../common/permissions'

interface RoleRow extends RowDataPacket {
  id: number
  name: string
  code: string
  description: string | null
  created_at: Date | string
  updated_at: Date | string
}

export interface RoleView extends Role {
  /** 关联菜单标题，便于前端展示 */
  menuTitles: string[]
  /** 关联菜单节点（含层级信息），便于前端按子应用以树结构展示 */
  menus: { id: number; title: string; parentId: number; appKey: AppKey }[]
  /** 菜单 id → 该菜单下已授权的按钮权限点（按钮级授权回显） */
  menuPermissions: MenuPermissionMap
}

function mapRole(r: RoleRow): Role {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    appKeys: [],
    menuIds: [],
    description: r.description ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

@Injectable()
export class RoleService {
  constructor(
    @Inject('MYSQL_POOL') private readonly pool: Pool,
    private readonly permissionService: PermissionService,
  ) {}

  private async findRow(id: number): Promise<RoleRow | undefined> {
    const [rows] = await this.pool.query<RoleRow[]>(
      'SELECT * FROM `roles` WHERE `id` = ?',
      [id],
    )
    return rows[0]
  }

  private async loadAppKeys(roleId: number): Promise<AppKey[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT `app_key` FROM `role_apps` WHERE `role_id` = ?',
      [roleId],
    )
    return rows.map((r) => r.app_key as AppKey)
  }

  private async loadMenuIds(roleId: number): Promise<number[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT `menu_id` FROM `role_menus` WHERE `role_id` = ?',
      [roleId],
    )
    return rows.map((r) => r.menu_id as number)
  }

  private async loadMenuTitles(menuIds: number[]): Promise<string[]> {
    if (!menuIds.length) return []
    const placeholders = menuIds.map(() => '?').join(',')
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT `title` FROM `menus` WHERE `id` IN (' + placeholders + ')',
      menuIds,
    )
    return rows.map((r) => r.title as string)
  }

  private async loadMenuNodes(
    menuIds: number[],
  ): Promise<{ id: number; title: string; parentId: number; appKey: AppKey }[]> {
    if (!menuIds.length) return []
    const placeholders = menuIds.map(() => '?').join(',')
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT `id`, `title`, `parent_id` AS parentId, `app_key` AS appKey FROM `menus` WHERE `id` IN (' +
        placeholders +
        ')',
      menuIds,
    )
    return rows.map((r) => ({
      id: r.id as number,
      title: r.title as string,
      parentId: r.parentId as number,
      appKey: r.appKey as AppKey,
    }))
  }

  /** 读取角色在各菜单下已授权的按钮权限点（回显用） */
  private async loadMenuPermissions(roleId: number): Promise<MenuPermissionMap> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT `menu_id`, `permissions` FROM `role_menus` WHERE `role_id` = ?',
      [roleId],
    )
    const map: MenuPermissionMap = {}
    rows.forEach((r) => {
      const raw = r.permissions as string | null
      if (!raw) return
      const codes = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (codes.length) map[r.menu_id as number] = codes
    })
    return map
  }

  /**
   * 写入菜单 → 按钮权限点映射。
   * 仅落库合法权限点（ALL_PERMISSION_CODES 白名单），非白名单项静默丢弃，
   * 防止前端传入任意字符串污染权限集合。
   */
  private async saveMenuPermissions(
    roleId: number,
    menuPermissions: Record<string | number, string[]>,
  ): Promise<void> {
    const entries = Object.entries(menuPermissions ?? {})
    if (!entries.length) return
    const allowed = new Set(ALL_PERMISSION_CODES)
    for (const [menuId, codes] of entries) {
      const id = Number(menuId)
      if (!Number.isInteger(id) || id <= 0) continue
      const clean = [...new Set((codes ?? []).filter((c) => allowed.has(c)))]
      await this.pool.query(
        'UPDATE `role_menus` SET `permissions` = ? WHERE `role_id` = ? AND `menu_id` = ?',
        [clean.length ? clean.join(',') : null, roleId, id],
      )
    }
    // 授权变更 → 失效按钮权限缓存，使受影响用户即时生效
    this.permissionService.invalidate()
  }

  private async toView(roleId: number): Promise<RoleView> {
    const row = await this.findRow(roleId)
    if (!row) throw new ApiError('角色不存在', 40400)
    const appKeys = await this.loadAppKeys(roleId)
    const menuIds = await this.loadMenuIds(roleId)
    const menuTitles = await this.loadMenuTitles(menuIds)
    const menus = await this.loadMenuNodes(menuIds)
    const menuPermissions = await this.loadMenuPermissions(roleId)
    return { ...mapRole(row), appKeys, menuIds, menuTitles, menus, menuPermissions }
  }

  async list(): Promise<RoleView[]> {
    const [rows] = await this.pool.query<RoleRow[]>('SELECT * FROM `roles` ORDER BY `id`')
    const result: RoleView[] = []
    for (const r of rows) {
      const appKeys = await this.loadAppKeys(r.id)
      const menuIds = await this.loadMenuIds(r.id)
      const menuTitles = await this.loadMenuTitles(menuIds)
      const menus = await this.loadMenuNodes(menuIds)
      const menuPermissions = await this.loadMenuPermissions(r.id)
      result.push({ ...mapRole(r), appKeys, menuIds, menuTitles, menus, menuPermissions })
    }
    return result
  }

  async get(id: number): Promise<RoleView> {
    return this.toView(id)
  }

  private async assertMenusExist(menuIds: number[]) {
    if (!menuIds.length) return
    const placeholders = menuIds.map(() => '?').join(',')
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM `menus` WHERE `id` IN (' + placeholders + ')',
      menuIds,
    )
    if (Number(rows[0].cnt) !== menuIds.length) {
      throw new ApiError('存在不存在的菜单 id', 40400)
    }
  }

  async create(input: RoleCreateInput): Promise<Role> {
    const [dupCode] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM `roles` WHERE `code` = ?',
      [input.code],
    )
    if (Number(dupCode[0].cnt) > 0) throw new ApiError('角色标识已存在', 40000)
    const [dupName] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM `roles` WHERE `name` = ?',
      [input.name],
    )
    if (Number(dupName[0].cnt) > 0) throw new ApiError('角色名称已存在', 40000)
    await this.assertMenusExist(input.menuIds)

    const [result] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO `roles` (`name`, `code`, `description`) VALUES (?, ?, ?)',
      [input.name, input.code, input.description ?? null],
    )
    const roleId = result.insertId
    if (input.appKeys.length) {
      await this.pool.query(
        'INSERT INTO `role_apps` (`role_id`, `app_key`) VALUES ' +
          input.appKeys.map(() => '(?, ?)').join(', '),
        input.appKeys.flatMap((k) => [roleId, k]),
      )
    }
    if (input.menuIds.length) {
      await this.pool.query(
        'INSERT INTO `role_menus` (`role_id`, `menu_id`) VALUES ' +
          input.menuIds.map(() => '(?, ?)').join(', '),
        input.menuIds.flatMap((m) => [roleId, m]),
      )
    }
    await this.saveMenuPermissions(roleId, input.menuPermissions ?? {})
    return this.toView(roleId)
  }

  async update(id: number, input: RoleUpdateInput): Promise<Role> {
    const row = await this.findRow(id)
    if (!row) throw new ApiError('角色不存在', 40400)
    if (input.code !== undefined) {
      const [dup] = await this.pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS cnt FROM `roles` WHERE `code` = ? AND `id` <> ?',
        [input.code, id],
      )
      if (Number(dup[0].cnt) > 0) throw new ApiError('角色标识已存在', 40000)
    }
    if (input.name !== undefined) {
      const [dup] = await this.pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS cnt FROM `roles` WHERE `name` = ? AND `id` <> ?',
        [input.name, id],
      )
      if (Number(dup[0].cnt) > 0) throw new ApiError('角色名称已存在', 40000)
    }

    const sets: string[] = []
    const params: unknown[] = []
    if (input.name !== undefined) {
      sets.push('`name` = ?')
      params.push(input.name)
    }
    if (input.code !== undefined) {
      sets.push('`code` = ?')
      params.push(input.code)
    }
    if (input.description !== undefined) {
      sets.push('`description` = ?')
      params.push(input.description)
    }
    if (sets.length) {
      await this.pool.query(
        'UPDATE `roles` SET ' + sets.join(', ') + ' WHERE `id` = ?',
        [...params, id],
      )
    }
    if (input.appKeys !== undefined) {
      await this.pool.query('DELETE FROM `role_apps` WHERE `role_id` = ?', [id])
      if (input.appKeys.length) {
        await this.pool.query(
          'INSERT INTO `role_apps` (`role_id`, `app_key`) VALUES ' +
            input.appKeys.map(() => '(?, ?)').join(', '),
          input.appKeys.flatMap((k) => [id, k]),
        )
      }
    }
    if (input.menuIds !== undefined) {
      await this.assertMenusExist(input.menuIds)
      await this.pool.query('DELETE FROM `role_menus` WHERE `role_id` = ?', [id])
      if (input.menuIds.length) {
        await this.pool.query(
          'INSERT INTO `role_menus` (`role_id`, `menu_id`) VALUES ' +
            input.menuIds.map(() => '(?, ?)').join(', '),
          input.menuIds.flatMap((m) => [id, m]),
        )
      }
      // 重设菜单后按新提交的按钮权限点回写（未提交则清空该角色的按钮权限）
      await this.saveMenuPermissions(id, input.menuPermissions ?? {})
    } else if (input.menuPermissions !== undefined) {
      // 仅更新按钮权限点、不动菜单关联
      await this.saveMenuPermissions(id, input.menuPermissions)
    }
    return this.toView(id)
  }

  async remove(id: number): Promise<void> {
    const row = await this.findRow(id)
    if (!row) throw new ApiError('角色不存在', 40400)
    const [used] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM `user_roles` WHERE `role_id` = ?',
      [id],
    )
    if (Number(used[0].cnt) > 0) {
      throw new ApiError('角色已被人员使用，无法删除', 40000)
    }
    await this.pool.query('DELETE FROM `roles` WHERE `id` = ?', [id])
  }
}
