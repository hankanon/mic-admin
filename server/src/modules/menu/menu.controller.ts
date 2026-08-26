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
import { MenuService } from './menu.service'
import { menuCreateSchema, menuUpdateSchema } from '../../common/schemas'

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
  create(@Body() body: unknown) {
    return this.menuService.create(menuCreateSchema.parse(body))
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.menuService.update(Number(id), menuUpdateSchema.parse(body))
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.menuService.remove(Number(id))
    return null
  }
}
