import { Module } from '@nestjs/common'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { PermissionService } from '../../common/permission.service'

@Module({
  controllers: [UserController],
  providers: [UserService, PermissionService],
})
export class UserModule {}
