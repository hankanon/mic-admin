import { createRequest } from '../request'
import type { NotificationMessage, NotificationType, AlertLevel } from './types'

/**
 * 通知相关的 REST 接口（演示用）。
 * 实际生产环境发布由后端业务触发，前端一般只读历史。
 * 这些接口部署在 sys-server（VITE_SYS_SERVER_URL），故单独创建请求实例。
 */
const notifyRequest = createRequest({
  baseURL: (import.meta as any).env?.VITE_SYS_SERVER_URL || '/api',
})

export interface PublishInput {
  type: NotificationType
  title: string
  content: string
  module?: string
  alertLevel?: AlertLevel
  targets?: string[]
  recipient?: string
  link?: string
}

/** 发布通知（向 sys-server 推送） */
export function publishNotification(input: PublishInput) {
  return notifyRequest.post<NotificationMessage>('/notifications/publish', input)
}

/** 发布给指定用户 */
export function publishToUser(userId: string, input: PublishInput) {
  return notifyRequest.post<NotificationMessage>('/notifications/publish-to-user', { userId, ...input })
}

/** 拉取历史通知 */
export function fetchNotificationHistory() {
  return notifyRequest.get<NotificationMessage[]>('/notifications/history')
}

