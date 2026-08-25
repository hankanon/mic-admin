import { createHttpServer } from './app'

const PORT = Number(process.env.PORT || 4000)

const { server } = createHttpServer()
server.listen(PORT, () => {
  console.log(`[sys-server] listening on http://localhost:${PORT}`)
})
