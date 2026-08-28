import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ApiError } from './errors'
import { parseTokenUserId } from './auth-token'
import { PermissionService } from './permission.service'
import { PERMISSION_KEY } from './permission.decorator'

/**
 * 按钮级接口鉴权守卫。
 *
 * 与 `@RequirePermission(code)` 配合使用：解析 token 得到用户 → 聚合其全部角色的
 * 按钮权限点 → 校验是否包含所需权限点，不满足返回 40300。
 * 未声明 `@RequirePermission` 的接口直接放行（保持既有接口行为不变）。
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!required) return true

    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>()
    const userId = parseTokenUserId(req.headers.authorization)

    const { permissions, buttons } = await this.permissionService.loadUserPermissions(userId)

    // 超级管理员直通：应用级或按钮级含 '*'
    if (permissions.includes('*') || buttons.includes('*')) return true
    if (buttons.includes(required)) return true

    throw new ApiError('无操作权限', 40300)
  }
}
