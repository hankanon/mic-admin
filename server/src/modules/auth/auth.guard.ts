import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { ApiError } from '../../common/errors'
import { IS_PUBLIC_KEY } from '../../common/public.decorator'

/** 认证守卫填充到 req 上的用户信息 */
export interface RequestUser {
  userId: number
  username: string
  roleId: number | null
}

/**
 * 全局 JWT 认证守卫（通过 APP_GUARD 注册）：
 * - 白名单：@Public() 标注的接口直接放行；
 * - 校验 access token（验签/过期/iss/aud/tv），并实时校验账号状态与 token_version；
 * - 校验通过后写入 req.user，供业务与 PermissionGuard 使用。
 * - 非 HTTP 通道（WS/RPC）保持现状，直接放行。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>()
    const authorization = request.headers.authorization || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) throw new ApiError('未登录', 40100, 401)

    const payload = await this.authService.verifyToken(token, 'access')
    const user = await this.authService.loadAuthUser(Number(payload.sub))
    if (!user) throw new ApiError('账号不存在', 40103, 401)
    if (user.status !== 'active') throw new ApiError('账号已禁用', 40103, 401)
    if (user.tokenVersion !== payload.tv) throw new ApiError('登录状态已失效，请重新登录', 40100, 401)

    request.user = { userId: user.id, username: user.username, roleId: payload.roleId ?? null }
    return true
  }
}
