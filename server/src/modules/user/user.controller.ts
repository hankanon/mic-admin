import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common'
import { UseGuards } from '@nestjs/common'
import { ApiError } from '../../common/errors'
import { Public } from '../../common/public.decorator'
import { UserService } from './user.service'
import { loginSchema, userCreateSchema, userUpdateSchema } from '../../common/schemas'
import { PermissionGuard } from '../../common/permission.guard'
import { RequirePermission } from '../../common/permission.decorator'
import { USER_PERMISSIONS } from '../../common/permissions'
import type { RequestUser } from '../auth/auth.guard'

@UseGuards(PermissionGuard)
@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 登录（公开接口）：校验账号密码，返回 JWT 令牌对与用户信息（含角色、权限、菜单） */
  @Public()
  @Post('login')
  login(@Body() body: unknown) {
    return this.userService.login(loginSchema.parse(body))
  }

  /** 切换角色：返回该角色的权限与菜单，并重签 access token（身份由全局 AuthGuard 解析） */
  @Get('role-data')
  roleData(
    @Req() req: { user: RequestUser },
    @Query('roleId') roleId: string,
  ) {
    const id = Number(roleId)
    if (!Number.isInteger(id) || id <= 0) throw new ApiError('角色 id 不合法', 42200)
    return this.userService.getRoleData(req.user.userId, id)
  }

  @Get()
  list() {
    return this.userService.list()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.userService.get(Number(id))
  }

  @Post()
  @RequirePermission(USER_PERMISSIONS.create)
  create(@Body() body: unknown) {
    return this.userService.create(userCreateSchema.parse(body))
  }

  @Put(':id')
  @RequirePermission(USER_PERMISSIONS.update)
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.userService.update(Number(id), userUpdateSchema.parse(body))
  }

  @Delete(':id')
  @RequirePermission(USER_PERMISSIONS.remove)
  async remove(@Param('id') id: string) {
    await this.userService.remove(Number(id))
    return null
  }
}
