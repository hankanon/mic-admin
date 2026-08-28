import { Module } from '@nestjs/common'
import { RoleController } from './role.controller'
import { RoleService } from './role.service'
import { PermissionService } from '../../common/permission.service'

@Module({
  controllers: [RoleController],
  providers: [RoleService, PermissionService],
})
export class RoleModule {}
