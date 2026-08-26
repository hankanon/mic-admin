import { Global, Module } from '@nestjs/common'
import { pool } from './db'

/** 全局数据库模块：对外提供 MySQL 连接池，供各 service 注入使用 */
@Global()
@Module({
  providers: [{ provide: 'MYSQL_POOL', useValue: pool }],
  exports: ['MYSQL_POOL'],
})
export class DatabaseModule {}
