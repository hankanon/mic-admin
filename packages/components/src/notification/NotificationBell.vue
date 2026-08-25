<script setup lang="ts">
import { computed, ref } from 'vue'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_META,
  ALERT_LEVEL_LABELS,
  type NotificationMessage,
  type NotificationPrefs,
  type ConnectionStatus,
  type NotificationType,
} from '@mic/utils'

const props = withDefaults(
  defineProps<{
    messages: NotificationMessage[]
    unreadCount?: number
    connectionStatus?: ConnectionStatus
    prefs: NotificationPrefs
    /** 可订阅的模块列表（用于过滤偏好勾选） */
    modules?: { key: string; label: string }[]
  }>(),
  {
    unreadCount: 0,
    connectionStatus: 'disconnected',
    modules: () => [],
  },
)

const emit = defineEmits<{
  (e: 'update:prefs', prefs: NotificationPrefs): void
  (e: 'mark-read', id: string): void
  (e: 'mark-all'): void
  (e: 'clear'): void
  (e: 'select', msg: NotificationMessage): void
}>()

const visible = ref(false)
const activeTab = ref<NotificationType | 'all'>('all')

const iconComponents = ElementPlusIconsVue as Record<string, any>
function resolveIcon(name?: string) {
  if (!name) return undefined
  return iconComponents[name]
}

const allTypes: NotificationType[] = ['announcement', 'reminder', 'alert']

const filtered = computed(() => {
  if (activeTab.value === 'all') return props.messages
  return props.messages.filter((m) => m.type === activeTab.value)
})

const statusMeta = computed(() => {
  switch (props.connectionStatus) {
    case 'connected':
      return { text: '已连接', color: '#67c23a' }
    case 'connecting':
      return { text: '连接中', color: '#e6a23c' }
    case 'reconnecting':
      return { text: '重连中', color: '#e6a23c' }
    default:
      return { text: '已断开', color: '#909399' }
  }
})

function toggleType(type: NotificationType) {
  const set = new Set(props.prefs.mutedTypes)
  if (set.has(type)) set.delete(type)
  else set.add(type)
  emit('update:prefs', { ...props.prefs, mutedTypes: [...set] })
}

function toggleModule(key: string) {
  const set = new Set(props.prefs.mutedModules)
  if (set.has(key)) set.delete(key)
  else set.add(key)
  emit('update:prefs', { ...props.prefs, mutedModules: [...set] })
}

function toggleSound() {
  emit('update:prefs', { ...props.prefs, soundEnabled: !props.prefs.soundEnabled })
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function onClick(msg: NotificationMessage) {
  emit('mark-read', msg.id)
  emit('select', msg)
}
</script>

<template>
  <el-popover
    v-model:visible="visible"
    placement="bottom-end"
    :width="360"
    :show-arrow="false"
    popper-class="notification-popper"
    trigger="click"
  >
    <!-- 触发器：铃铛 + 未读红点 -->
    <template #reference>
      <el-badge :value="unreadCount" :hidden="!unreadCount" :max="99" class="notify-bell">
        <el-button text circle class="layout-actions__btn notify-bell__btn">
          <el-icon><component :is="resolveIcon('Bell')" /></el-icon>
        </el-button>
      </el-badge>
    </template>

    <div class="notify-panel">
      <!-- 头部：标题 + 连接状态 + 全部已读 -->
      <div class="notify-panel__header">
        <div class="notify-panel__title">
          通知中心
          <span class="notify-panel__status" :style="{ color: statusMeta.color }">
            <i class="dot" :style="{ background: statusMeta.color }" />{{ statusMeta.text }}
          </span>
        </div>
        <el-button link type="primary" size="small" @click="emit('mark-all')">全部已读</el-button>
      </div>

      <!-- 类型筛选 tab -->
      <div class="notify-panel__tabs">
        <span
          class="notify-tab"
          :class="{ 'is-active': activeTab === 'all' }"
          @click="activeTab = 'all'"
        >全部</span>
        <span
          v-for="t in allTypes"
          :key="t"
          class="notify-tab"
          :class="{ 'is-active': activeTab === t }"
          @click="activeTab = t"
        >{{ NOTIFICATION_TYPE_LABELS[t] }}</span>
      </div>

      <!-- 列表 -->
      <div class="notify-panel__list">
        <el-empty v-if="!filtered.length" description="暂无通知" :image-size="60" />
        <div
          v-for="msg in filtered"
          :key="msg.id"
          class="notify-item"
          :class="{ 'is-unread': !msg.read }"
          @click="onClick(msg)"
        >
          <span class="notify-item__icon" :style="{ color: NOTIFICATION_TYPE_META[msg.type].color }">
            <el-icon><component :is="resolveIcon(NOTIFICATION_TYPE_META[msg.type].icon)" /></el-icon>
          </span>
          <div class="notify-item__body">
            <div class="notify-item__title">
              {{ msg.title }}
              <el-tag
                v-if="msg.type === 'alert' && msg.alertLevel"
                size="small"
                :type="msg.alertLevel === 'critical' ? 'danger' : msg.alertLevel === 'warning' ? 'warning' : 'info'"
              >{{ ALERT_LEVEL_LABELS[msg.alertLevel] }}</el-tag>
            </div>
            <div class="notify-item__content">{{ msg.content }}</div>
            <div class="notify-item__meta">
              <span>{{ NOTIFICATION_TYPE_LABELS[msg.type] }}</span>
              <span v-if="msg.module">· {{ msg.module }}</span>
              <span>· {{ fmtTime(msg.createdAt) }}</span>
            </div>
          </div>
          <span v-if="!msg.read" class="notify-item__dot" />
        </div>
      </div>

      <!-- 偏好设置（订阅/过滤） -->
      <div class="notify-panel__prefs">
        <div class="notify-prefs__head">
          <span>偏好设置</span>
          <el-switch
            :model-value="prefs.soundEnabled"
            inline-prompt
            active-text="声音"
            inactive-text="静音"
            @change="toggleSound"
          />
        </div>
        <div class="notify-prefs__row">
          <span class="notify-prefs__label">屏蔽类型</span>
          <div class="notify-prefs__chips">
            <el-tag
              v-for="t in allTypes"
              :key="t"
              class="notify-chip"
              :class="{ 'is-muted': prefs.mutedTypes.includes(t) }"
              effect="plain"
              @click="toggleType(t)"
            >{{ NOTIFICATION_TYPE_LABELS[t] }}</el-tag>
          </div>
        </div>
        <div v-if="modules.length" class="notify-prefs__row">
          <span class="notify-prefs__label">屏蔽模块</span>
          <div class="notify-prefs__chips">
            <el-tag
              v-for="m in modules"
              :key="m.key"
              class="notify-chip"
              :class="{ 'is-muted': prefs.mutedModules.includes(m.key) }"
              effect="plain"
              @click="toggleModule(m.key)"
            >{{ m.label }}</el-tag>
          </div>
        </div>
        <div class="notify-panel__footer">
          <el-button link type="danger" size="small" @click="emit('clear')">清空全部</el-button>
        </div>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.notify-bell__btn {
  position: relative;
}
.notify-bell :deep(.el-badge__content) {
  border: none;
}
.notify-panel {
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}
.notify-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 2px 8px;
}
.notify-panel__title {
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.notify-panel__status {
  font-size: 12px;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 4px;
}
.notify-panel__status .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}
.notify-panel__tabs {
  display: flex;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.notify-tab {
  font-size: 13px;
  padding: 2px 10px;
  border-radius: 12px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  transition: all 0.15s;
}
.notify-tab:hover {
  color: var(--el-color-primary);
}
.notify-tab.is-active {
  background: var(--el-color-primary);
  color: #fff;
}
.notify-panel__list {
  flex: 1;
  overflow-y: auto;
  min-height: 80px;
  max-height: 320px;
  margin: 4px -8px;
  padding: 0 8px;
}
.notify-item {
  display: flex;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  transition: background 0.12s;
}
.notify-item:hover {
  background: var(--el-fill-color-light);
}
.notify-item.is-unread {
  background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
}
.notify-item__icon {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 2px;
}
.notify-item__body {
  flex: 1;
  min-width: 0;
}
.notify-item__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.notify-item__content {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-top: 2px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.notify-item__meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
.notify-item__dot {
  position: absolute;
  right: 6px;
  top: 14px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-color-danger);
}
.notify-panel__prefs {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 10px;
}
.notify-prefs__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}
.notify-prefs__row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.notify-prefs__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  width: 52px;
  line-height: 22px;
}
.notify-prefs__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.notify-chip {
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
}
.notify-chip.is-muted {
  opacity: 0.45;
  text-decoration: line-through;
}
.notify-panel__footer {
  text-align: right;
  margin-top: 4px;
}
</style>
