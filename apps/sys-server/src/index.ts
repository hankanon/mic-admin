import { createApp } from './app'

const PORT = Number(process.env.PORT || 4000)

createApp().listen(PORT, () => {
  console.log(`[sys-server] listening on http://localhost:${PORT}`)
})
