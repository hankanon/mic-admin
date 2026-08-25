import { WebSocketServer, type WebSocket } from 'ws'
import type { Server } from 'node:http'
import { notificationService } from './notificationService'

/**
 * 启动通知 WebSocket 服务。
 * 路径 /api/notifications，握手 query 携带 userId（可选）用于定向投递。
 * 前端在同源下（sys-server:4000）建立连接，由基座通过 VITE_SYS_SERVER_URL 配置。
 */
export function startNotificationWs(server: Server) {
  const wss = new WebSocketServer({ server, path: '/api/notifications' })

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url ?? '', 'http://localhost')
    const userId = url.searchParams.get('userId') || undefined
    notificationService.register(ws, userId)
    ws.on('pong', () => {
      // 心跳存活；心跳超时由 setInterval 间接检测（close 时清理）
    })
  })

  console.log('[notification] WebSocket server ready at /api/notifications')
  return wss
}
