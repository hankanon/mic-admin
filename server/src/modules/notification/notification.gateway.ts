import { Logger } from '@nestjs/common'
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets'
import type { WebSocket, WebSocketServer as WSServer } from 'ws'
import type { IncomingMessage } from 'node:http'
import { NotificationService } from './notification.service'

/**
 * 通知 WebSocket 网关。
 * 路径 /api/notifications，握手 query 携带 userId（可选）用于定向投递。
 * 前端在同源下（server:4000）建立连接，由基座通过 VITE_SYS_SERVER_URL 配置。
 *
 * 注意：心跳（ping/pong）由 NotificationService.register 内部 setInterval 处理，
 * 这里仅负责连接建立/断开时的注册与清理。
 */
@WebSocketGateway({ path: '/api/notifications' })
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationGateway.name)

  @WebSocketServer()
  server!: WSServer

  constructor(private readonly notificationService: NotificationService) {}

  handleConnection(client: WebSocket, request: IncomingMessage) {
    const url = new URL(request.url ?? '', 'http://localhost')
    const userId = url.searchParams.get('userId') || undefined
    this.notificationService.register(client, userId)
  }

  handleDisconnect(_client: WebSocket) {
    // 连接清理由 NotificationService 的 ws 'close'/'error' 事件统一处理
  }

  afterInit(_server: WSServer) {
    this.logger.log('WebSocket server ready at /api/notifications')
  }
}
