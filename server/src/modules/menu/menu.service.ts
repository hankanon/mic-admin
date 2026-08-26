import { Inject, Injectable } from '@nestjs/common'
import type { Pool } from 'mysql2/promise'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { ApiError } from '../../common/errors'
import type { AppKey, Menu, MenuNode } from '../../common/types'
import type { MenuCreateInput, MenuUpdateInput } from '../../common/schemas'

interface MenuRow extends RowDataPacket {
  id: number
  app_key: string
  parent_id: number | null
  title: string
  icon: string | null
  path: string | null
  type: string
  order: number
  visible: number
  permission: string | null
  created_at: Date | string
  updated_at: Date | string
}

function mapMenu(r: MenuRow): Menu {
  return {
    id: r.id,
    appKey: r.app_key as AppKey,
    parentId: r.parent_id ?? 0,
    title: r.title,
    icon: r.icon ?? undefined,
    path: r.path ?? undefined,
    type: r.type as Menu['type'],
    order: r.order,
    visible: !!r.visible,
    permission: r.permission ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

@Injectable()
export class MenuService {
  constructor(@Inject('MYSQL_POOL') private readonly pool: Pool) {}

  private async findRow(id: number): Promise<MenuRow | undefined> {
    const [rows] = await this.pool.query<MenuRow[]>(
      'SELECT * FROM `menus` WHERE `id` = ?',
      [id],
    )
    return rows[0]
  }

  /** 扁平列表：可按 appKey 过滤，按 parentId/order 排序 */
  async list(appKey?: string): Promise<Menu[]> {
    const sql =
      'SELECT * FROM `menus`' +
      (appKey ? ' WHERE `app_key` = ?' : '') +
      ' ORDER BY `parent_id`, `order`'
    const [rows] = appKey
      ? await this.pool.query<MenuRow[]>(sql, [appKey])
      : await this.pool.query<MenuRow[]>(sql)
    return rows.map(mapMenu)
  }

  /** 树形结构：可按 appKey 过滤 */
  async tree(appKey?: string): Promise<MenuNode[]> {
    const items = await this.list(appKey)
    const map = new Map<number, MenuNode>()
    items.forEach((m) => map.set(m.id, { ...m, children: [] }))
    const roots: MenuNode[] = []
    map.forEach((node) => {
      if (node.parentId === 0 || node.parentId === null) {
        roots.push(node)
      } else {
        const parent = map.get(node.parentId)
        if (parent) parent.children!.push(node)
        else roots.push(node)
      }
    })
    return roots
  }

  async get(id: number): Promise<Menu> {
    const row = await this.findRow(id)
    if (!row) throw new ApiError('菜单不存在', 40400)
    return mapMenu(row)
  }

  async create(input: MenuCreateInput): Promise<Menu> {
    if (input.parentId !== 0 && input.parentId != null) {
      const parent = await this.findRow(input.parentId)
      if (!parent) throw new ApiError('父菜单不存在', 40400)
      if (parent.app_key !== input.appKey) {
        throw new ApiError('父菜单与目标菜单所属子应用不一致', 40000)
      }
    }
    const parentId = input.parentId && input.parentId !== 0 ? input.parentId : null
    const [result] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO `menus` ' +
        '(`app_key`, `parent_id`, `title`, `icon`, `path`, `type`, `order`, `visible`, `permission`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.appKey,
        parentId,
        input.title,
        input.icon ?? null,
        input.path ?? null,
        input.type,
        input.order,
        input.visible ? 1 : 0,
        input.permission ?? null,
      ],
    )
    return this.get(result.insertId)
  }

  async update(id: number, input: MenuUpdateInput): Promise<Menu> {
    const row = await this.findRow(id)
    if (!row) throw new ApiError('菜单不存在', 40400)

    if (input.parentId !== undefined && input.parentId !== null && input.parentId !== 0) {
      if (input.parentId === id) throw new ApiError('不能将菜单设为自身的父级', 40000)
      // 循环引用检测：沿候选父级向上回溯，是否回到当前菜单
      let cur = await this.findRow(input.parentId)
      while (cur && cur.parent_id !== null && cur.parent_id !== 0) {
        if (cur.parent_id === id) throw new ApiError('不能将菜单移动到其自身的子级下', 40000)
        cur = await this.findRow(cur.parent_id)
      }
      const parent = await this.findRow(input.parentId)
      if (!parent) throw new ApiError('父菜单不存在', 40000)
      const targetApp = input.appKey ?? (row.app_key as AppKey)
      if (parent.app_key !== targetApp) {
        throw new ApiError('父菜单与目标菜单所属子应用不一致', 40000)
      }
    }

    const sets: string[] = []
    const params: unknown[] = []
    if (input.appKey !== undefined) {
      sets.push('`app_key` = ?')
      params.push(input.appKey)
    }
    if (input.parentId !== undefined) {
      sets.push('`parent_id` = ?')
      params.push(input.parentId === 0 ? null : input.parentId)
    }
    if (input.title !== undefined) {
      sets.push('`title` = ?')
      params.push(input.title)
    }
    if (input.icon !== undefined) {
      sets.push('`icon` = ?')
      params.push(input.icon)
    }
    if (input.path !== undefined) {
      sets.push('`path` = ?')
      params.push(input.path)
    }
    if (input.type !== undefined) {
      sets.push('`type` = ?')
      params.push(input.type)
    }
    if (input.order !== undefined) {
      sets.push('`order` = ?')
      params.push(input.order)
    }
    if (input.visible !== undefined) {
      sets.push('`visible` = ?')
      params.push(input.visible ? 1 : 0)
    }
    if (input.permission !== undefined) {
      sets.push('`permission` = ?')
      params.push(input.permission)
    }
    if (sets.length) {
      await this.pool.query(
        'UPDATE `menus` SET ' + sets.join(', ') + ' WHERE `id` = ?',
        [...params, id],
      )
    }
    return this.get(id)
  }

  async remove(id: number): Promise<void> {
    const row = await this.findRow(id)
    if (!row) throw new ApiError('菜单不存在', 40400)
    const [children] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM `menus` WHERE `parent_id` = ?',
      [id],
    )
    if (Number(children[0].cnt) > 0) {
      throw new ApiError('该菜单下存在子菜单，请先删除子菜单', 40000)
    }
    const [used] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM `role_menus` WHERE `menu_id` = ?',
      [id],
    )
    if (Number(used[0].cnt) > 0) {
      throw new ApiError('菜单已被角色使用，无法删除', 40000)
    }
    await this.pool.query('DELETE FROM `menus` WHERE `id` = ?', [id])
  }
}
