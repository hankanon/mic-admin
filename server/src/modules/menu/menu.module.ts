import { Module } from '@nestjs/common'
import { MenuController } from './menu.controller'
import { MenuService } from './menu.service'
import { PermissionService } from '../../common/permission.service'

@Module({
  controllers: [MenuController],
  providers: [MenuService, PermissionService],
})
export class MenuModule {}
