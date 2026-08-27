import { Inject, Injectable } from '@nestjs/common'
import type { Pool } from 'mysql2/promise'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { ApiError } from '../../common/errors'
import type { User } from '../../common/types'
import type { UserCreateInput, UserUpdateInput } from '../../common/schemas'

interface UserRow extends RowDataPacket {
  id: number
  username: string
  name: string
  email: string
  phone: string | null
  status: string
  created_at: Date | string
  updated_at: Date | string
}

export interface UserView extends User {
  /** 关联角色名称，便于前端展示 */
  roleNames: string[]
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
