import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { UseGuards } from '@nestjs/common'
import { MenuService } from './menu.service'
import { menuCreateSchema, menuUpdateSchema } from '../../common/schemas'
import { PermissionGuard } from '../../common/permission.guard'
import { RequirePermission } from '../../common/permission.decorator'
import { MENU_PERMISSIONS } from '../../common/permissions'

@UseGuards(PermissionGuard)
@Controller('api/menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  list(@Query('appKey') appKey?: string) {
    return this.menuService.list(appKey)
  }

  @Get('tree')
  tree(@Query('appKey') appKey?: string) {
    return this.menuService.tree(appKey)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.menuService.get(Number(id))
  }

  @Post()
  @RequirePermission(MENU_PERMISSIONS.create)
  create(@Body() body: unknown) {
    return this.menuService.create(menuCreateSchema.parse(body))
  }

  @Put(':id')
  @RequirePermission(MENU_PERMISSIONS.update)
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.menuService.update(Number(id), menuUpdateSchema.parse(body))
  }

  @Delete(':id')
  @RequirePermission(MENU_PERMISSIONS.remove)
  async remove(@Param('id') id: string) {
    await this.menuService.remove(Number(id))
    return null
  }
}
