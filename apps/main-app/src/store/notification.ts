import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  notificationConnection,
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_CACHE_KEY,
  NOTIFICATION_PREFS_KEY,
  getStorage,
  setStorage,
  removeStorage,
  type NotificationMessage,
  type NotificationPrefs,
  type ConnectionStatus,
  type NotificationType,
} from '@mic/utils'

/**
 * 通知中心 store（基座）。
 *
 * 职责：
 * - 管理到 sys-server 的 WebSocket 连接生命周期（基于单例 notificationConnection）。
 * - 接收实时通知，本地去重、维护未读计数与历史列表（localStorage 持久化）。
 * - 维护用户订阅/过滤偏好（mutedTypes / mutedModules / soundEnabled），变更即时下发服务端。
 * - 提供标记已读、按类型/模块过滤、声音提醒等能力。
 *
 * 注意：仅基座持有连接（子应用通过 onGlobalData 同步 userInfo → 同上单例连接）。
 */
export const useNotificationStore = defineStore('notification', () => {
  const messages = ref<NotificationMessage[]>([])
  const unreadCount = ref(0)
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const prefs = ref<NotificationPrefs>({ ...DEFAULT_NOTIFICATION_PREFS })
  /** 当前用户已激活的账号（用于定向连接） */
  const activeUserId = ref<string | undefined>(undefined)
  /** 连接是否已初始化（避免重复 connect） */
  let initialized = false

  // 读取本地持久化偏好
  const savedPrefs = getStorage<NotificationPrefs>(NOTIFICATION_PREFS_KEY)
  if (savedPrefs) prefs.value = { ...DEFAULT_NOTIFICATION_PREFS, ...savedPrefs }
  // 读取本地缓存的历史（保持刷新后不丢失已接收通知）
  const cached = getStorage<NotificationMessage[]>(NOTIFICATION_CACHE_KEY)
  if (cached) messages.value = cached

  function persist() {
    setStorage(NOTIFICATION_CACHE_KEY, messages.value)
  }

  /** 是否应被本地偏好过滤（双重保险：服务端也会过滤） */
  function isBlocked(msg: NotificationMessage): boolean {
    if (prefs.value.mutedTypes.includes(msg.type)) return true
    if (msg.module && prefs.value.mutedModules.includes(msg.module)) return true
    return false
  }

  function playSound(type: NotificationType) {
    if (!prefs.value.soundEnabled) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const freq = type === 'alert' ? 880 : type === 'announcement' ? 660 : 520
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.value = 0.04
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.18)
    } catch {
      /* 音频不可用时静默 */
    }
  }

  function onMessage(msg: NotificationMessage) {
    // 已在连接层去重；此处再按本地偏好过滤
    if (isBlocked(msg)) return
    messages.value.unshift(msg)
    if (messages.value.length > 200) messages.value.pop()
    unreadCount.value++
    persist()
    playSound(msg.type)
  }

  function onHistory(msgs: NotificationMessage[]) {
    // 服务端下发离线期间缓冲（已按服务端偏好过滤）；合并去重
    const existing = new Set(messages.value.map((m) => m.id))
    const merged = [...msgs.filter((m) => !existing.has(m.id) && !isBlocked(m)), ...messages.value]
    merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    messages.value = merged.slice(0, 200)
    unreadCount.value = messages.value.filter((m) => !m.read).length
    persist()
  }

  /** 初始化连接（基座登录后调用一次） */
  function init(userId?: string) {
    activeUserId.value = userId
    connectionStatus.value = notificationConnection.status.value
    notificationConnection.setHandlers({ onMessage, onHistory })
    notificationConnection.updatePrefs(prefs.value)
    if (!initialized) {
      notificationConnection.connect(userId)
      initialized = true
    }
    // 同步连接状态
    const stop = setInterval(() => {
      if (notificationConnection.status.value !== connectionStatus.value) {
        connectionStatus.value = notificationConnection.status.value
      }
    }, 500)
    // 简单同步，10s 后停止轮询（状态变化不频繁）
    setTimeout(() => clearInterval(stop), 10000)
  }

  /** 切换账号：断开旧连接，用新 userId 重连 */
  function reconnect(userId?: string) {
    notificationConnection.disconnect()
    initialized = false
    init(userId)
  }

  function updatePrefs(next: Partial<NotificationPrefs>) {
    prefs.value = { ...prefs.value, ...next }
    setStorage(NOTIFICATION_PREFS_KEY, prefs.value)
    notificationConnection.updatePrefs(prefs.value)
  }

  function markAllRead() {
    messages.value.forEach((m) => (m.read = true))
    unreadCount.value = 0
    persist()
  }

  function markRead(id: string) {
    const m = messages.value.find((x) => x.id === id)
    if (m && !m.read) {
      m.read = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
      persist()
    }
  }

  function clearAll() {
    messages.value = []
    unreadCount.value = 0
    persist()
  }

  /** 退出登录：断开连接、清理本地缓存 */
  function destroy() {
    notificationConnection.disconnect()
    initialized = false
  }

  // 按类型/模块计数的派生（面板分组用）
  const countByType = computed(() => {
    const acc: Record<NotificationType, number> = { announcement: 0, reminder: 0, alert: 0 }
    messages.value.forEach((m) => {
      if (!m.read) acc[m.type]++
    })
    return acc
  })

  return {
    messages,
    unreadCount,
    connectionStatus,
    prefs,
    activeUserId,
    init,
    reconnect,
    updatePrefs,
    markAllRead,
    markRead,
    clearAll,
    destroy,
    countByType,
  }
})
