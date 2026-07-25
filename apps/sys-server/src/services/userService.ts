import { ApiError } from '../errors'
import { db, nextId } from '../store'
import type { User } from '../types'
import type { UserCreateInput, UserUpdateInput } from '../schemas'

function findUser(id: number): User | undefined {
  return db.users.find((u) => u.id === id)
}

function assertRolesExist(roleIds: number[]) {
  for (const rid of roleIds) {
    if (!db.roles.some((r) => r.id === rid)) {
      throw new ApiError(`角色 id ${rid} 不存在`, 40400)
    }
  }
}

export interface UserView extends User {
  /** 关联角色名称，便于前端展示 */
  roleNames: string[]
}

function toView(user: User): UserView {
  return {
    ...user,
    roleNames: user.roleIds
      .map((id) => db.roles.find((r) => r.id === id)?.name)
      .filter((n): n is string => Boolean(n)),
  }
}

export function list(): UserView[] {
  return db.users.map(toView).sort((a, b) => a.id - b.id)
}

export function get(id: number): UserView {
  const user = findUser(id)
  if (!user) throw new ApiError('人员不存在', 40400)
  return toView(user)
}

export function create(input: UserCreateInput): User {
  if (db.users.some((u) => u.username === input.username)) {
    throw new ApiError('用户名已存在', 40000)
  }
  if (db.users.some((u) => u.email === input.email)) {
    throw new ApiError('邮箱已存在', 40000)
  }
  assertRolesExist(input.roleIds)
  const now = new Date().toISOString()
  const user: User = {
    id: nextId('user'),
    username: input.username,
    name: input.name,
    email: input.email,
    phone: input.phone,
    status: input.status,
    roleIds: input.roleIds,
    createdAt: now,
    updatedAt: now,
  }
  db.users.push(user)
  return user
}

export function update(id: number, input: UserUpdateInput): User {
  const user = findUser(id)
  if (!user) throw new ApiError('人员不存在', 40400)
  if (input.username !== undefined && db.users.some((u) => u.username === input.username && u.id !== id)) {
    throw new ApiError('用户名已存在', 40000)
  }
  if (input.email !== undefined && db.users.some((u) => u.email === input.email && u.id !== id)) {
    throw new ApiError('邮箱已存在', 40000)
  }
  if (input.roleIds !== undefined) assertRolesExist(input.roleIds)
  const now = new Date().toISOString()
  Object.assign(user, input, { updatedAt: now })
  return user
}

export function remove(id: number): void {
  const user = findUser(id)
  if (!user) throw new ApiError('人员不存在', 40400)
  db.users = db.users.filter((u) => u.id !== id)
}
