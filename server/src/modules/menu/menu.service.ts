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

// 应用段编码：与菜单初始化数据的 ID 规则保持一致
const APP_KEY_CODE: Record<AppKey, number> = {
  dashboard: 1,
  doc: 2,
  qa: 3,
  profile: 4,
  sys: 5,
}

// 解析层级编码 ID 为四段：[应用段, L1, L2, L3]
function parseSegments(id: number): { app: number; l1: number; l2: number; l3: number } {
  const s = String(id).padStart(8, '0')
  return {
    app: Number(s.slice(0, 2)),
    l1: Number(s.slice(2, 4)),
    l2: Number(s.slice(4, 6)),
    l3: Number(s.slice(6, 8)),
  }
}

// 依据「应用段 + 父级路径 + 同级顺序」生成层级编码 ID
// 格式：应用段(2) + L1(2) + L2(2) + L3(2)，未用层级补 0，按数值序即展示顺序
function buildMenuId(appKey: AppKey, parentId: number | null, order: number): number {
  const code = APP_KEY_CODE[appKey]
  const base = code * 1_000_000
  if (!parentId) {
    // 顶级菜单：应用段 + L1(order) + 00 + 00
    return base + order * 10_000
  }
  const p = parseSegments(parentId)
  if (p.l3 !== 0) {
    throw new ApiError('菜单层级过深，最多支持三级', 40000)
  }
  if (p.l2 === 0) {
    // 父级为 L1：应用段 + L1 + L2(order) + 00
    return base + p.l1 * 10_000 + order * 100
  }
  // 父级为 L2：应用段 + L1 + L2 + L3(order)
  return base + p.l1 * 10_000 + p.l2 * 100 + order
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

  /** 扁平列表：可按 appKey 过滤，按层级编码 ID 排序（与展示顺序一致） */
  async list(appKey?: string): Promise<Menu[]> {
    const sql =
      'SELECT * FROM `menus`' +
      (appKey ? ' WHERE `app_key` = ?' : '') +
      ' ORDER BY `id`'
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
    const parentId = input.parentId && input.parentId !== 0 ? input.parentId : null
    if (parentId) {
      const parent = await this.findRow(parentId)
      if (!parent) throw new ApiError('父菜单不存在', 40400)
      if (parent.app_key !== input.appKey) {
        throw new ApiError('父菜单与目标菜单所属子应用不一致', 40000)
      }
    }
    // 排序：显式传入 order 优先，否则取同级最大 order + 1
    const order =
      input.order > 0
        ? input.order
        : await this.nextOrder(input.appKey, parentId)
    // 生成与层级结构一致的编码 ID
    const id = buildMenuId(input.appKey, parentId, order)
    const [dup] = await this.pool.query<RowDataPacket[]>(
      'SELECT 1 FROM `menus` WHERE `id` = ?',
      [id],
    )
    if (dup.length) throw new ApiError('菜单 ID 已存在（同应用同级排序冲突）', 40000)
    await this.pool.query<ResultSetHeader>(
      'INSERT INTO `menus` ' +
        '(`id`, `app_key`, `parent_id`, `title`, `icon`, `path`, `type`, `order`, `visible`, `permission`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        input.appKey,
        parentId,
        input.title,
        input.icon ?? null,
        input.path ?? null,
        input.type,
        order,
        input.visible ? 1 : 0,
        input.permission ?? null,
      ],
    )
    return this.get(id)
  }

  /** 取某应用在指定父级下的同级最大 order + 1 */
  private async nextOrder(appKey: AppKey, parentId: number | null): Promise<number> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT MAX(`order`) AS m FROM `menus` WHERE `app_key` = ? AND `parent_id` <=> ?',
      [appKey, parentId],
    )
    return (Number(rows[0]?.m) || 0) + 1
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
    // 可空字段：上送了（含空字符串）就原样保存；未上送（undefined）则保留数据库默认值 NULL
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
