/**
 * 通知系统共享类型定义（服务端）。
 * 与 packages/utils/src/notify/types.ts 保持字段一致，作为前后端协议约定。
 */

/** 通知类型：系统公告 / 用户提醒 / 实时告警 */
export type NotificationType = 'announcement' | 'reminder' | 'alert'

/** 告警级别（仅 alert 类型使用） */
export type AlertLevel = 'info' | 'warning' | 'critical'

/**
 * 单条通知。
 * - id: 全局唯一，前端用于去重与送达确认。
 * - type: 决定前端的渲染/分组/声音策略。
 * - targets: 接收范围；空数组表示广播（所有在线客户端）。
 * - recipient: 精确投放的用户名（如提醒某用户），与 targets 取并集。
 */
export interface NotificationMessage {
  id: string
  type: NotificationType
  title: string
  content: string
  /** 来源模块（如 dashboard / doc / sys），用于分组与过滤 */
  module?: string
  alertLevel?: AlertLevel
  /** 目标应用 key（决定哪些客户端接收），空=全部 */
  targets: string[]
  /** 精确接收用户名，空=不限 */
  recipient?: string
  /** 业务跳转链接（可选，如 /doc/list） */
  link?: string
  createdAt: string
}

/** 客户端 → 服务端：送达确认 */
export interface AckPayload {
  type: 'ack'
  ids: string[]
}

/** 客户端 → 服务端：订阅偏好变更（过滤设置） */
export interface SubscribePayload {
  type: 'subscribe'
  /** 关闭接收的类型 */
  mutedTypes: NotificationType[]
  /** 关闭接收的模块 */
  mutedModules: string[]
  /** 是否允许声音提醒 */
  soundEnabled: boolean
}

/** 客户端 → 服务端消息联合类型 */
export type ClientMessage = AckPayload | SubscribePayload

/** 服务端 → 客户端消息 */
export interface ServerEnvelope {
  type: 'notification' | 'ack-result' | 'history'
  message?: NotificationMessage
  ids?: string[]
  messages?: NotificationMessage[]
}
