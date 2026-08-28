import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { MenuModule } from './modules/menu/menu.module'
import { RoleModule } from './modules/role/role.module'
import { UserModule } from './modules/user/user.module'
import { NotificationModule } from './modules/notification/notification.module'
import { AuthModule } from './modules/auth/auth.module'
import { AuthGuard } from './modules/auth/auth.guard'
import { DatabaseModule } from './common/database.module'

/** 应用根模块：聚合系统管理（菜单/角色/人员）与实时通知两大功能域 */
@Module({
  imports: [
    // 加载 server/.env.development 中的数据库连接配置
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.development' }),
    DatabaseModule,
    AuthModule,
    MenuModule,
    RoleModule,
    UserModule,
    NotificationModule,
  ],
  providers: [
    // 全局 JWT 认证守卫：所有 HTTP 接口默认需要有效 access token（@Public() 白名单除外）
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
