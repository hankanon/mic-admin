import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { WsAdapter } from '@nestjs/platform-ws'
import cors from 'cors'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import { ResponseInterceptor } from './common/response.interceptor'

async function bootstrap() {
  // 启动期强校验 JWT 密钥：缺失或弱密钥直接拒绝启动（生产必须注入强密钥）
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET 未配置或长度不足 32 字符，拒绝启动。' +
        '生产环境请用 `openssl rand -base64 48` 生成并通过环境变量注入。',
    )
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // WebSocket 驱动：使用原生 ws 适配器（与 @nestjs/platform-ws 网关配合）
  app.useWebSocketAdapter(new WsAdapter(app))

  // 跨域：与前端同源/跨域加载子应用一致，允许全部来源
  app.use(cors())

  // 统一异常过滤（业务错误 / 参数校验 / 404 / 服务器错误）
  app.useGlobalFilters(new AllExceptionsFilter())

  // 统一成功响应结构：{ code: 0, message: 'ok', data }
  app.useGlobalInterceptors(new ResponseInterceptor())

  // 健康检查（与原 sys-server 的 GET /health 一致）
  const expressInstance = app.getHttpAdapter().getInstance()
  expressInstance.get('/health', (_req: unknown, res: { json: (body: unknown) => void }) => {
    res.json({ code: 0, message: 'ok', data: { status: 'up' } })
  })

  const PORT = Number(process.env.PORT || 4000)
  await app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`)
  })
}

bootstrap()
