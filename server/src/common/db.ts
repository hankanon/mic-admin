import { config } from 'dotenv'
import { resolve } from 'node:path'
import { createPool, type Pool } from 'mysql2/promise'

// 在创建连接池前确保 .env.development 已载入 process.env（早于 ConfigModule 初始化时机）。
// CWD 即 server/ 目录（pnpm --filter @mic/server 在该目录执行脚本）。
config({ path: resolve(process.cwd(), '.env.development') })

/**
 * MySQL 连接池（惰性连接：仅在实际执行查询时建连，
 * 因此在 MySQL 未启动的开发环境下不会导致服务启动失败）。
 * 配置来自 server/.env.development。
 */
export const pool: Pool = createPool({
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASS ?? '',
  database: process.env.MYSQL_DB ?? 'admin',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
})

// 每次从连接池新建连接时强制设置字符集，避免服务端默认 latin1 导致中文乱码。
pool.on('connection', (connection) => {
  connection.query('SET NAMES utf8mb4')
})
