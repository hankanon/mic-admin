import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common'
import { UseGuards } from '@nestjs/common'
import { RoleService } from './role.service'
import { roleCreateSchema, roleUpdateSchema } from '../../common/schemas'
import { PermissionGuard } from '../../common/permission.guard'
import { RequirePermission } from '../../common/permission.decorator'
import { ROLE_PERMISSIONS } from '../../common/permissions'

@UseGuards(PermissionGuard)
@Controller('api/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  list() {
    return this.roleService.list()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.roleService.get(Number(id))
  }

  @Post()
  @RequirePermission(ROLE_PERMISSIONS.create)
  create(@Body() body: unknown) {
    return this.roleService.create(roleCreateSchema.parse(body))
  }

  @Put(':id')
  @RequirePermission(ROLE_PERMISSIONS.update)
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.roleService.update(Number(id), roleUpdateSchema.parse(body))
  }

  @Delete(':id')
  @RequirePermission(ROLE_PERMISSIONS.remove)
  async remove(@Param('id') id: string) {
    await this.roleService.remove(Number(id))
    return null
  }
}
