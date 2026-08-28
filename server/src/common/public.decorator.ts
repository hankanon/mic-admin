import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

/**
 * 标记接口为公开（跳过全局 JWT 认证），如登录、健康检查。
 * 用法：@Public() @Post('login')
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
