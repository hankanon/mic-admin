import { Body, Controller, Post, Req } from '@nestjs/common'
import { AuthService, TokenPair } from './auth.service'
import { Public } from '../../common/public.decorator'

/** /api/auth 前缀；Controller 路由默认在 app.setGlobalPrefix('api') 之外，故显式写全 */
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 刷新令牌：旋转（旧 refresh 单次使用，作废）+ 签发新对 */
  @Public()
  @Post('refresh')
  async refresh(
    @Body() body: { refreshToken: string; roleId?: number | null },
  ): Promise<TokenPair> {
    return this.authService.refresh(body.refreshToken, body.roleId)
  }

  /** 登出：吊销该用户全部 refresh（access 自然过期） */
  @Post('logout')
  async logout(@Req() req: { user: { userId: number } }): Promise<null> {
    await this.authService.revokeAll(req.user.userId)
    return null
  }
}
