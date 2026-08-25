import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common'
import { RoleService } from './role.service'
import { roleCreateSchema, roleUpdateSchema } from '../../common/schemas'

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
  create(@Body() body: unknown) {
    return this.roleService.create(roleCreateSchema.parse(body))
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.roleService.update(Number(id), roleUpdateSchema.parse(body))
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.roleService.remove(Number(id))
    return null
  }
}
