import { Injectable } from '@nestjs/common'
import { ApiError } from '../../common/errors'
import { db, nextId } from '../../common/store'
import type { Role } from '../../common/types'
import type { RoleCreateInput, RoleUpdateInput } from '../../common/schemas'

function findRole(id: number): Role | undefined {
  return db.roles.find((r) => r.id === id)
}

function assertMenusExist(menuIds: number[]) {
  for (const mid of menuIds) {
    if (!db.menus.some((m) => m.id === mid)) {
      throw new ApiError(`菜单 id ${mid} 不存在`, 40400)
    }
  }
}

export interface RoleView extends Role {
  /** 关联菜单标题，便于前端展示 */
  menuTitles: string[]
}

function toView(role: Role): RoleView {
  return {
    ...role,
    menuTitles: role.menuIds
      .map((id) => db.menus.find((m) => m.id === id)?.title)
      .filter((t): t is string => Boolean(t)),
  }
}

@Injectable()
export class RoleService {
  list(): RoleView[] {
    return db.roles.map(toView)
  }

  get(id: number): RoleView {
    const role = findRole(id)
    if (!role) throw new ApiError('角色不存在', 40400)
    return toView(role)
  }

  create(input: RoleCreateInput): Role {
    if (db.roles.some((r) => r.code === input.code)) {
      throw new ApiError('角色标识已存在', 40000)
    }
    if (db.roles.some((r) => r.name === input.name)) {
      throw new ApiError('角色名称已存在', 40000)
    }
    assertMenusExist(input.menuIds)
    const now = new Date().toISOString()
    const role: Role = {
      id: nextId('role'),
      name: input.name,
      code: input.code,
      appKeys: input.appKeys,
      menuIds: input.menuIds,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    }
    db.roles.push(role)
    return role
  }

  update(id: number, input: RoleUpdateInput): Role {
    const role = findRole(id)
    if (!role) throw new ApiError('角色不存在', 40400)
    if (input.code !== undefined && db.roles.some((r) => r.code === input.code && r.id !== id)) {
      throw new ApiError('角色标识已存在', 40000)
    }
    if (input.name !== undefined && db.roles.some((r) => r.name === input.name && r.id !== id)) {
      throw new ApiError('角色名称已存在', 40000)
    }
    if (input.menuIds !== undefined) assertMenusExist(input.menuIds)
    const now = new Date().toISOString()
    Object.assign(role, input, { updatedAt: now })
    return role
  }

  remove(id: number): void {
    const role = findRole(id)
    if (!role) throw new ApiError('角色不存在', 40400)
    const usedBy = db.users
      .filter((u) => u.roleIds.includes(id))
      .map((u) => u.name)
    if (usedBy.length) {
      throw new ApiError(`角色已被人员【${usedBy.join('、')}】使用，无法删除`, 40000)
    }
    db.roles = db.roles.filter((r) => r.id !== id)
  }
}
