import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MenuModule } from './modules/menu/menu.module'
import { RoleModule } from './modules/role/role.module'
import { UserModule } from './modules/user/user.module'
import { NotificationModule } from './modules/notification/notification.module'
import { DatabaseModule } from './common/database.module'

/** 应用根模块：聚合系统管理（菜单/角色/人员）与实时通知两大功能域 */
@Module({
  imports: [
    // 加载 server/.env.development 中的数据库连接配置
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.development' }),
    DatabaseModule,
    MenuModule,
    RoleModule,
    UserModule,
    NotificationModule,
  ],
})
export class AppModule {}
