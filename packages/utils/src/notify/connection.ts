import { ref } from 'vue'
import {
  RECONNECT_CONFIG,
  NOTIFICATION_WS_PATH,
} from './constants'
import type {
  ClientMessage,
  ConnectionStatus,
  NotificationMessage,
  NotificationPrefs,
  ServerEnvelope,
} from './types'

/**
 * 前端通知 WebSocket 客户端（模块级单例）。
 *
 * 能力：
 * - 自动重连：断线后按指数退避（RECONNECT_CONFIG）持续重连，状态通过 status 暴露。
 * - 心跳：定时 ping 维持连接，服务端未 pong 由浏览器 onclose 触发重连。
 * - 送达确认：收到 notification 后累积 ack 队列，批量 ack 服务端（去重）。
 * - 失败重试（服务端主导）：服务端对未确认通知指数重投，客户端仅做去重。
 * - 订阅偏好下发：连接建立后将当前 prefs 发送给服务端做过滤。
 * - 事件回调：onMessage / onHistory 由 store 注入。
 */

type MessageHandler = (msg: NotificationMessage) => void
type HistoryHandler = (msgs: NotificationMessage[]) => void

class NotificationConnection {
  status = ref<ConnectionStatus>('disconnected')
  private ws: WebSocket | null = null
  private url: string
  private userId?: string
  private prefs: NotificationPrefs | null = null
  private messageHandler: MessageHandler | null = null
  private historyHandler: HistoryHandler | null = null
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private ackQueue: string[] = []
  private ackTimer: ReturnType<typeof setTimeout> | null = null
  private manualClose = false
  /** 同一连接内已接收消息 id 集合，避免服务端子连接/历史重复投递造成重复 */
  private seen = new Set<string>()

  constructor() {
    // WebSocket 地址：优先 VITE_SYS_SERVER_URL（基座提供），回退同源
    const env = (import.meta as any).env ?? {}
    const base = env.VITE_SYS_SERVER_URL || (typeof location !== 'undefined' ? location.origin : '')
    this.url = base.replace(/\/$/, '') + NOTIFICATION_WS_PATH
  }

  setHandlers(opts: { onMessage: MessageHandler; onHistory: HistoryHandler }) {
    this.messageHandler = opts.onMessage
    this.historyHandler = opts.onHistory
  }

  /** 更新订阅偏好并即时下发（若已连接） */
  updatePrefs(prefs: NotificationPrefs) {
    this.prefs = prefs
    if (this.status.value === 'connected') {
      this.send({ type: 'subscribe', ...prefs })
    }
  }

  connect(userId?: string) {
    if (typeof WebSocket === 'undefined') return
    this.userId = userId
    this.manualClose = false
    this.open()
  }

  private open() {
    if (!this.url) return
    this.status.value = this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting'
    const wsUrl = this.userId ? `${this.url}?userId=${encodeURIComponent(this.userId)}` : this.url
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.status.value = 'connected'
      this.reconnectAttempts = 0
      this.seen.clear()
      if (this.prefs) this.send({ type: 'subscribe', ...this.prefs })
      this.startHeartbeat()
    }

    ws.onmessage = (ev) => this.handleEnvelope(ev.data)

    ws.onclose = () => {
      this.stopHeartbeat()
      if (!this.manualClose) this.scheduleReconnect()
      else this.status.value = 'disconnected'
    }

    ws.onerror = () => {
      // 错误后等待 onclose 触发重连
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
  }

  private handleEnvelope(raw: string) {
    let env: ServerEnvelope
    try {
      env = JSON.parse(raw) as ServerEnvelope
    } catch {
      return
    }
    if (env.type === 'notification' && env.message) {
      const msg = env.message
      // 去重：同一连接内不重复处理（服务端历史/实时可能重复）
      if (this.seen.has(msg.id)) {
        this.queueAck(msg.id)
        return
      }
      this.seen.add(msg.id)
      this.queueAck(msg.id)
      this.messageHandler?.(msg)
    } else if (env.type === 'history' && env.messages) {
      // 历史仅作初始化，不重复入 seen（实时到达时仍需处理）
      this.historyHandler?.(env.messages)
    } else if (env.type === 'ack-result') {
      // 服务端确认收到 ack，无需处理
    }
  }

  /** 累积 ack，批量发送（减少消息量） */
  private queueAck(id: string) {
    this.ackQueue.push(id)
    if (this.ackTimer) return
    this.ackTimer = setTimeout(() => this.flushAck(), 300)
  }

  private flushAck() {
    this.ackTimer = null
    if (!this.ackQueue.length) return
    const ids = this.ackQueue
    this.ackQueue = []
    this.send({ type: 'ack', ids })
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send('ping')
        } catch {
          /* ignore */
        }
      }
    }, 25000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.status.value = 'reconnecting'
    const { baseDelay, maxDelay, factor } = RECONNECT_CONFIG
    const delay = Math.min(maxDelay, baseDelay * Math.pow(factor, this.reconnectAttempts))
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.open()
    }, delay)
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg))
        return
      } catch {
        /* ignore */
      }
    }
  }

  /** 主动关闭（如退出登录） */
  disconnect() {
    this.manualClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()
    try {
      this.ws?.close()
    } catch {
      /* ignore */
    }
    this.ws = null
    this.status.value = 'disconnected'
  }
}

/** 单例：整个运行环境（基座或子应用）共享一条到 sys-server 的 WS 连接 */
export const notificationConnection = new NotificationConnection()
