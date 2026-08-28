import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiError } from '../../common/errors'
import { UserService } from './user.service'
import { loginSchema, userCreateSchema, userUpdateSchema } from '../../common/schemas'

/** 从 Authorization 头解析 mock token 中的用户 id（格式：mock-token-{userId}-{ts}） */
function parseTokenUserId(authorization?: string): number {
  const token = (authorization || '').replace(/^Bearer\s+/i, '')
  const matched = token.match(/^mock-token-(\d+)-\d+$/)
  if (!matched) throw new ApiError('登录已过期，请重新登录', 40100)
  return Number(matched[1])
}

@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 登录：校验账号密码，返回 token 与用户信息（含角色、权限、菜单） */
  @Post('login')
  login(@Body() body: unknown) {
    return this.userService.login(loginSchema.parse(body))
  }

  /** 切换角色：返回该角色的权限与菜单（从 token 解析当前用户） */
  @Get('role-data')
  roleData(
    @Headers('authorization') authorization: string | undefined,
    @Query('roleId') roleId: string,
  ) {
    const userId = parseTokenUserId(authorization)
    const id = Number(roleId)
    if (!Number.isInteger(id) || id <= 0) throw new ApiError('角色 id 不合法', 42200)
    return this.userService.getRoleData(userId, id)
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
  create(@Body() body: unknown) {
    return this.userService.create(userCreateSchema.parse(body))
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.userService.update(Number(id), userUpdateSchema.parse(body))
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.userService.remove(Number(id))
    return null
  }
}
