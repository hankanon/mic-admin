/**
 * 通知系统共享类型（前端）。
 * 与 apps/sys-server/src/notification/types.ts 字段保持一致，作为前后端协议约定。
 */

/** 通知类型 */
export type NotificationType = 'announcement' | 'reminder' | 'alert'

/** 告警级别 */
export type AlertLevel = 'info' | 'warning' | 'critical'

/** 单条通知 */
export interface NotificationMessage {
  id: string
  type: NotificationType
  title: string
  content: string
  module?: string
  alertLevel?: AlertLevel
  targets: string[]
  recipient?: string
  link?: string
  createdAt: string
  /** 客户端侧已读标记（不参与协议，仅前端本地状态） */
  read?: boolean
}

/** 客户端订阅/过滤偏好 */
export interface NotificationPrefs {
  /** 关闭接收的类型 */
  mutedTypes: NotificationType[]
  /** 关闭接收的模块 */
  mutedModules: string[]
  /** 是否允许声音提醒 */
  soundEnabled: boolean
}

/** 服务端 → 客户端消息 */
export interface ServerEnvelope {
  type: 'notification' | 'ack-result' | 'history'
  message?: NotificationMessage
  ids?: string[]
  messages?: NotificationMessage[]
}

/** 客户端 → 服务端消息 */
export type ClientMessage =
  | { type: 'ack'; ids: string[] }
  | { type: 'subscribe'; mutedTypes: NotificationType[]; mutedModules: string[]; soundEnabled: boolean }

/** 连接状态 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
