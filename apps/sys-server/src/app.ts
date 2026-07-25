import express from 'express'
import cors from 'cors'
import menuRouter from './routes/menu'
import roleRouter from './routes/role'
import userRouter from './routes/user'
import { notFound, errorHandler } from './middlewares/errorHandler'

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

  app.use(notFound)
  app.use(errorHandler)
  return app
}
