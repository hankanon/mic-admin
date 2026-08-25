import type { NotificationType, AlertLevel } from './types'

/** 通知类型中文标签（用于面板分组与渲染） */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  announcement: '系统公告',
  reminder: '用户提醒',
  alert: '实时告警',
}

/** 通知类型对应的 Element Plus 颜色/图标 */
export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  { icon: string; color: string; tag: string }
> = {
  announcement: { icon: 'Bell', color: '#409eff', tag: 'primary' },
  reminder: { icon: 'ChatDotRound', color: '#67c23a', tag: 'success' },
  alert: { icon: 'Warning', color: '#e6a23c', tag: 'warning' },
}

/** 告警级别中文标签 */
export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  info: '提示',
  warning: '警告',
  critical: '严重',
}

/** 默认订阅偏好 */
export const DEFAULT_NOTIFICATION_PREFS = {
  mutedTypes: [] as NotificationType[],
  mutedModules: [] as string[],
  soundEnabled: true,
}

/** 重连策略：基础延迟（ms）与最大延迟、最大重试次数 */
export const RECONNECT_CONFIG = {
  baseDelay: 1000,
  maxDelay: 15000,
  maxRetries: Infinity, // 持续重连直至成功
  factor: 1.8,
}

/** 本地偏好持久化 key */
export const NOTIFICATION_PREFS_KEY = 'notification_prefs'

/** 历史消息本地缓存 key（离线期间本地保留已读/未读状态） */
export const NOTIFICATION_CACHE_KEY = 'notification_cache'

/** 通知中心 WebSocket 路径 */
export const NOTIFICATION_WS_PATH = '/api/notifications'
