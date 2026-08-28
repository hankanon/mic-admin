import { Module } from '@nestjs/common'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { AuthModule } from '../auth/auth.module'
import { PermissionService } from '../../common/permission.service'

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserService, PermissionService],
})
export class UserModule {}
