import { Module } from '@nestjs/common'
import { MenuModule } from './modules/menu/menu.module'
import { RoleModule } from './modules/role/role.module'
import { UserModule } from './modules/user/user.module'
import { NotificationModule } from './modules/notification/notification.module'

/** 应用根模块：聚合系统管理（菜单/角色/人员）与实时通知两大功能域 */
@Module({
  imports: [MenuModule, RoleModule, UserModule, NotificationModule],
})
export class AppModule {}
