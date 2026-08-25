import { Injectable } from '@nestjs/common'
import type { WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'
import type {
  ClientMessage,
  NotificationMessage,
  NotificationType,
  ServerEnvelope,
} from './notification.types'

/** 单客户端连接记录 */
interface ClientConnection {
  id: string
  ws: WebSocket
  /** 登录用户名（连接握手时通过 query.userId 注入） */
  userId?: string
  /** 该客户端订阅/过滤偏好 */
  prefs: {
    mutedTypes: NotificationType[]
    mutedModules: string[]
    soundEnabled: boolean
  }
  /** 已发送但客户端尚未确认的通知（用于失败重试） */
  pending: Map<string, RetryItem>
  /** 心跳计时器 */
  heartbeat?: NodeJS.Timeout
}

interface RetryItem {
  message: NotificationMessage
  attempts: number
  timer?: NodeJS.Timeout
}

/**
 * 通知推送中心（服务端）。
 *
 * 职责：
 * 1. 维护全部活跃 WebSocket 连接，按 userId 分组（同一用户多端登录）。
 * 2. 消息产生后根据 targets / recipient / 客户端订阅偏好决定分发范围。
 * 3. 维护「已发送未确认」队列，客户端 ack 后清除；超时重投（指数退避，最多 3 次）。
 * 4. 客户端离线时，alert 类消息进入离线缓冲，重连后补发（避免实时告警丢失）。
 */
@Injectable()
export class NotificationService {
  private clients = new Map<string, ClientConnection>()
  /** userId -> 该用户全部连接 id（支持多端） */
  private userConnections = new Map<string, Set<string>>()
  /** 离线期间为各用户保留的未送达通知（重连后补发） */
  private offlineBuffer = new Map<string, NotificationMessage[]>()
  /** 历史通知（内存，最多保留 200 条，供新连接拉取） */
  private history: NotificationMessage[] = []
  private readonly historyLimit = 200
  private readonly maxRetry = 3
  private readonly ackTimeout = 5000

  register(ws: WebSocket, userId?: string): string {
    const id = randomUUID()
    const conn: ClientConnection = {
      id,
      ws,
      userId,
      prefs: { mutedTypes: [], mutedModules: [], soundEnabled: true },
      pending: new Map(),
    }
    this.clients.set(id, conn)
    if (userId) {
      if (!this.userConnections.has(userId)) this.userConnections.set(userId, new Set())
      this.userConnections.get(userId)!.add(id)
      // 重连后补发离线期间的通知
      const buffered = this.offlineBuffer.get(userId)
      if (buffered?.length) {
        this.send(id, { type: 'history', messages: buffered })
        this.offlineBuffer.delete(userId)
      }
    }
    ws.on('message', (raw) => this.handleClientMessage(id, raw.toString()))
    ws.on('close', () => this.unregister(id))
    ws.on('error', () => this.unregister(id))
    // 心跳：超时未收到 pong 则关闭
    conn.heartbeat = setInterval(() => {
      if (ws.readyState !== ws.OPEN) return
      try {
        ws.ping()
      } catch {
        /* ignore */
      }
    }, 30000)
    return id
  }

  private unregister(id: string) {
    const conn = this.clients.get(id)
    if (!conn) return
    if (conn.heartbeat) clearInterval(conn.heartbeat)
    conn.pending.forEach((item) => item.timer && clearTimeout(item.timer))
    if (conn.userId) {
      const set = this.userConnections.get(conn.userId)
      set?.delete(id)
      if (set && set.size === 0) this.userConnections.delete(conn.userId)
    }
    this.clients.delete(id)
  }

  /** 解析客户端消息：送达确认 / 订阅偏好变更 */
  private handleClientMessage(id: string, raw: string) {
    const conn = this.clients.get(id)
    if (!conn) return
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw) as ClientMessage
    } catch {
      return
    }
    if (msg.type === 'ack') {
      this.confirmAck(conn, msg.ids)
    } else if (msg.type === 'subscribe') {
      conn.prefs.mutedTypes = msg.mutedTypes ?? []
      conn.prefs.mutedModules = msg.mutedModules ?? []
      conn.prefs.soundEnabled = msg.soundEnabled ?? true
      // 偏好变更后，立即按新偏好同步当前 pending（清理已被静音的）
      this.reconcilePending(conn)
    }
  }

  /** 客户端确认送达：清除 pending 与重试计时器 */
  private confirmAck(conn: ClientConnection, ids: string[]) {
    ids.forEach((mid) => {
      const item = conn.pending.get(mid)
      if (item?.timer) clearTimeout(item.timer)
      conn.pending.delete(mid)
    })
  }

  /** 偏好变更后清理被静音的待确认项（无需再重试） */
  private reconcilePending(conn: ClientConnection) {
    conn.pending.forEach((item, mid) => {
      if (this.isMuted(conn, item.message)) {
        if (item.timer) clearTimeout(item.timer)
        conn.pending.delete(mid)
      }
    })
  }

  /** 判断某通知是否被该连接的订阅偏好屏蔽 */
  private isMuted(conn: ClientConnection, msg: NotificationMessage): boolean {
    if (conn.prefs.mutedTypes.includes(msg.type)) return true
    if (msg.module && conn.prefs.mutedModules.includes(msg.module)) return true
    return false
  }

  /** 判断该通知是否应投递给某连接（范围 + 偏好） */
  private shouldDeliver(conn: ClientConnection, msg: NotificationMessage): boolean {
    const inScope =
      msg.targets.length === 0 || // 广播
      (msg.module ? msg.targets.includes(msg.module) : false) ||
      (conn.userId ? msg.targets.includes(conn.userId) : false) ||
      (msg.recipient ? msg.recipient === conn.userId : false)
    if (!inScope) return false
    return !this.isMuted(conn, msg)
  }

  /** 产生一条通知并分发（核心入口） */
  publish(input: Omit<NotificationMessage, 'id' | 'createdAt'>): NotificationMessage {
    const message: NotificationMessage = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    }
    // 入历史
    this.history.unshift(message)
    if (this.history.length > this.historyLimit) this.history.pop()

    let delivered = 0
    this.clients.forEach((conn) => {
      if (this.shouldDeliver(conn, message)) {
        this.deliverWithRetry(conn, message)
        delivered++
      }
    })

    // 无人实时在线：alert 类进入离线缓冲，待用户重连补发；其余类型丢弃（非紧急）
    if (delivered === 0 && message.type === 'alert' && message.recipient) {
      const buf = this.offlineBuffer.get(message.recipient) ?? []
      buf.push(message)
      this.offlineBuffer.set(message.recipient, buf)
    }
    return message
  }

  /** 投递并在未确认时按指数退避重试 */
  private deliverWithRetry(conn: ClientConnection, message: NotificationMessage) {
    if (this.isMuted(conn, message)) return
    this.send(conn.id, { type: 'notification', message })
    const item: RetryItem = { message, attempts: 1 }
    conn.pending.set(message.id, item)
    item.timer = setTimeout(() => this.retry(conn, message.id), this.ackTimeout)
  }

  private retry(conn: ClientConnection, mid: string) {
    const item = conn.pending.get(mid)
    if (!item) return // 已确认
    if (item.attempts >= this.maxRetry) {
      // 达到最大重试：放弃该连接的投递（连接可能已不可达）
      conn.pending.delete(mid)
      return
    }
    if (conn.ws.readyState === conn.ws.OPEN) {
      this.send(conn.id, { type: 'notification', message: item.message })
    }
    item.attempts++
    item.timer = setTimeout(() => this.retry(conn, mid), this.ackTimeout * item.attempts)
  }

  private send(clientId: string, envelope: ServerEnvelope) {
    const conn = this.clients.get(clientId)
    if (!conn || conn.ws.readyState !== conn.ws.OPEN) return
    try {
      conn.ws.send(JSON.stringify(envelope))
    } catch {
      /* 发送失败：依赖重试/心跳清理 */
    }
  }

  /** 给某用户所有连接推送（供 REST 接口调用） */
  publishToUser(userId: string, input: Omit<NotificationMessage, 'id' | 'createdAt'>) {
    const scoped = { ...input, targets: [userId], recipient: userId }
    return this.publish(scoped)
  }

  /** 提供历史给新连接 / REST 查询 */
  getHistory(): NotificationMessage[] {
    return this.history
  }
}
