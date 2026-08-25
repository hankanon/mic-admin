import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import menuRouter from './routes/menu'
import roleRouter from './routes/role'
import userRouter from './routes/user'
import notificationRouter from './routes/notification'
import { notFound, errorHandler } from './middlewares/errorHandler'
import { startNotificationWs } from './notification/wsServer'

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ code: 0, message: 'ok', data: { status: 'up' } })
  })

  app.use('/api/menus', menuRouter)
  app.use('/api/roles', roleRouter)
  app.use('/api/users', userRouter)
  app.use('/api/notifications', notificationRouter)

  app.use(notFound)
  app.use(errorHandler)
  return app
}

/** 创建可承载 WebSocket 的 HTTP server（供 index.ts 使用） */
export function createHttpServer() {
  const app = createApp()
  const server = createServer(app)
  startNotificationWs(server)
  return { app, server }
}
