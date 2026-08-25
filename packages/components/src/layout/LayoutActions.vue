<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { emitToMain, MicroMsgType, useTheme, type NotificationMessage, type NotificationPrefs, type ConnectionStatus } from '@mic/utils'
import NotificationBell from '../notification/NotificationBell.vue'
import { useGuide } from '../guide/useGuide'

const props = withDefaults(
  defineProps<{
    userInfo?: { id?: string; name: string; avatar?: string }
    accounts?: { username: string; name: string; current?: boolean }[]
    /** 启动操作指引前回调（如展开菜单使目标元素可见） */
    onBeforeGuide?: () => void
    /** host: 主应用（登出走 emit）；standalone: 子应用独立运行（自行跳登录） */
    mode?: 'host' | 'standalone'
    /** 通知中心数据（由基座注入，子应用 standalone 可不传） */
    notifications?: NotificationMessage[]
    notificationUnread?: number
    notificationStatus?: ConnectionStatus
    notificationPrefs?: NotificationPrefs
    /** 可订阅模块（用于过滤偏好） */
    notificationModules?: { key: string; label: string }[]
  }>(),
  {
    mode: 'host',
    notifications: () => [],
    notificationUnread: 0,
    notificationStatus: 'disconnected',
    notificationPrefs: () => ({ mutedTypes: [], mutedModules: [], soundEnabled: true }),
    notificationModules: () => [],
  },
)

const emit = defineEmits<{
  (e: 'logout'): void
  (e: 'switch-account', username: string): void
  (e: 'update:notification-prefs', prefs: NotificationPrefs): void
  (e: 'notification-mark-read', id: string): void
  (e: 'notification-mark-all'): void
  (e: 'notification-clear'): void
  (e: 'notification-select', msg: NotificationMessage): void
}>()

/** 触发区显示名：优先用登录账号 id 首字母大写，回退到 name */
const displayName = computed(() => {
  const info = props.userInfo as { id?: string; name: string } | undefined
  const id = info?.id
  if (id) return id.charAt(0).toUpperCase() + id.slice(1)
  return info?.name || '未登录'
})
/** 角色标签：显示在 name 下方并带方括号；与 displayName 相同时隐藏以避免重复 */
const roleLabel = computed(() => props.userInfo?.name || '')

// 主题切换（模块级单例，跨基座与子应用共用）
const { currentTheme, toggleTheme } = useTheme()

/**
 * 全屏切换：基于 Fullscreen API。
 * - 进入：对 document.documentElement 调 requestFullscreen。
 * - 退出：对 document 调 exitFullscreen。
 * - 兼容 Safari 旧版前缀 webkit*；监听 fullscreenchange 同步 ESC 退出等外部变更。
 */
const isFullscreen = ref(false)
function getFullscreenElement(): Element | null {
  return (
    document.fullscreenElement ||
    (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
    null
  )
}
function requestFullscreen() {
  const root = document.documentElement as unknown as {
    requestFullscreen?: () => Promise<void> | void
    webkitRequestFullscreen?: () => Promise<void> | void
  }
  const req = root.requestFullscreen || root.webkitRequestFullscreen
  if (req) req.call(root)
}
function exitFullscreen() {
  const doc = document as unknown as {
    exitFullscreen?: () => Promise<void> | void
    webkitExitFullscreen?: () => Promise<void> | void
  }
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen
  if (exit) exit.call(document)
}
function toggleFullscreen() {
  if (getFullscreenElement()) exitFullscreen()
  else requestFullscreen()
}
function syncFullscreen() {
  isFullscreen.value = !!getFullscreenElement()
}
onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreen)
  document.addEventListener('webkitfullscreenchange', syncFullscreen)
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
  document.removeEventListener('webkitfullscreenchange', syncFullscreen)
})

/** 顶部用户菜单（el-popover）相关状态 */
const userMenuRef = ref<any>()
/** "切换角色" 子列表展开状态（hover 驱动，平滑展开） */
const switchOpen = ref(false)
/** 点击菜单项后短暂锁定 popover，避免 hover 立即重新打开造成闪烁 */
const popoverLocked = ref(false)
let userMenuLockTimer: number | undefined

const iconComponents = ElementPlusIconsVue as Record<string, any>
function resolveIcon(name?: string) {
  if (!name) return undefined
  return iconComponents[name]
}

/**
 * 操作指引：基于 driver.js 的分步式高亮引导。
 * 高亮需在左侧菜单展开态下进行（菜单项选择器依赖展开后的 DOM），故启动前先展开菜单。
 */
const guide = useGuide({
  onClose: () => {
    // 完成后保持展开以便查看
  },
})
function openGuide() {
  // 确保菜单展开，使 [data-menu-key] 目标元素可见，定位准确
  props.onBeforeGuide?.()
  guide.start()
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出登录？', '提示', { type: 'warning' })
  } catch {
    return
  }
  // 独立运行：通知主应用（微前端环境有效），并跳转登录
  emitToMain({ type: MicroMsgType.Logout })
  if (props.mode === 'standalone') {
    // standalone 由宿主通过 emit 处理跳转
    emit('logout')
  } else {
    // host：交由主应用处理登出
    emit('logout')
  }
}

/** 关闭用户菜单（选项点击后调用）：隐藏 + 短暂锁防 hover 复发 */
function closeUserMenu() {
  switchOpen.value = false
  popoverLocked.value = true
  try {
    userMenuRef.value?.hide?.()
  } catch {
    /* ignore: el-popover 不暴露 hide 时由 disabled + 下次 outside click 兜底 */
  }
  if (userMenuLockTimer) window.clearTimeout(userMenuLockTimer)
  userMenuLockTimer = window.setTimeout(() => {
    popoverLocked.value = false
  }, 300)
}

function onProfile() {
  closeUserMenu()
  ElMessage.info('个人资料功能开发中')
}

function onPickAccount(username: string) {
  closeUserMenu()
  emit('switch-account', username)
}

function onLogout() {
  closeUserMenu()
  handleLogout()
}
</script>

<template>
  <div class="layout-actions">
    <!-- 操作指引：打开 driver.js 分步高亮引导 -->
    <el-tooltip content="操作指引" placement="bottom">
      <el-button text circle class="layout-actions__btn js-guide-entry" @click="openGuide">
        <el-icon><component :is="resolveIcon('QuestionFilled')" /></el-icon>
      </el-button>
    </el-tooltip>
    <!-- 主题切换：昼夜图标（点击切换到对立模式），tooltip 提示 -->
    <el-tooltip
      :content="currentTheme === 'dark' ? '切换到白天模式' : '切换到黑夜模式'"
      placement="bottom"
    >
      <el-button text circle class="layout-actions__btn js-guide-theme" @click="toggleTheme($event)">
        <el-icon><component :is="resolveIcon(currentTheme === 'dark' ? 'Sunny' : 'Moon')" /></el-icon>
      </el-button>
    </el-tooltip>
    <!-- 全屏切换：进入/退出全屏，图标随状态变化，tooltip 提示 -->
    <el-tooltip
      :content="isFullscreen ? '退出全屏' : '全屏'"
      placement="bottom"
    >
      <el-button text circle class="layout-actions__btn js-guide-fullscreen" @click="toggleFullscreen">
        <el-icon><component :is="resolveIcon(isFullscreen ? 'Aim' : 'FullScreen')" /></el-icon>
      </el-button>
    </el-tooltip>
    <!-- 消息通知：铃铛图标，位于登录用户名左侧 -->
    <NotificationBell
      v-if="notifications"
      :messages="notifications"
      :unread-count="notificationUnread"
      :connection-status="notificationStatus"
      :prefs="notificationPrefs"
      :modules="notificationModules"
      @update:prefs="(p) => emit('update:notification-prefs', p)"
      @mark-read="(id) => emit('notification-mark-read', id)"
      @mark-all="emit('notification-mark-all')"
      @clear="emit('notification-clear')"
      @select="(m) => emit('notification-select', m)"
    />
    <el-popover
      ref="userMenuRef"
      trigger="hover"
      placement="bottom-end"
      :width="210"
      :show-arrow="false"
      popper-class="user-menu-popper"
      :disabled="popoverLocked"
      :hide-after="150"
    >
      <div class="user-menu" @click.stop>
        <div class="user-menu__item" @click="onProfile">
          <el-icon class="user-menu__icon"><component :is="resolveIcon('User')" /></el-icon>
          <span class="user-menu__label">个人资料</span>
        </div>
        <div
          class="user-menu__switch"
          :class="{ 'is-open': switchOpen }"
          @mouseenter="switchOpen = true"
          @mouseleave="switchOpen = false"
        >
          <div class="user-menu__item user-menu__item--group">
            <el-icon class="user-menu__icon"><component :is="resolveIcon('RefreshRight')" /></el-icon>
            <span class="user-menu__label">切换角色</span>
          </div>
          <div v-if="accounts?.length" class="user-menu__sub">
            <div class="user-menu__sub-inner">
              <div
                v-for="acc in accounts"
                :key="acc.username"
                class="user-menu__sub-item"
                :class="{ 'is-current': acc.current }"
                @click="onPickAccount(acc.username)"
              >
                <span>{{ acc.name }}</span>
                <span v-if="acc.current" class="user-menu__current">（当前）</span>
              </div>
            </div>
          </div>
        </div>
        <div class="user-menu__divider" />
        <div class="user-menu__item" @click="onLogout">
          <el-icon class="user-menu__icon"><component :is="resolveIcon('SwitchButton')" /></el-icon>
          <span class="user-menu__label">退出登录</span>
        </div>
      </div>
      <template #reference>
        <div class="user-trigger">
          <el-avatar
            :size="36"
            :icon="resolveIcon('UserFilled')"
            style="background: var(--mic-primary); color: #fff"
          />
          <div class="user-trigger__info">
            <div class="user-trigger__name">{{ displayName }}</div>
            <div
              v-if="roleLabel && roleLabel !== displayName"
              class="user-trigger__role"
            >[{{ roleLabel }}]</div>
          </div>
        </div>
      </template>
    </el-popover>
  </div>
</template>

<style scoped>
.layout-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.layout-actions__btn {
  margin-right: 4px;
}
/* 顶部右侧：用户登录状态触发区（hover 弹出用户菜单） */
.user-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  outline: none;
  transition: background 0.15s;
}
.user-trigger:hover {
  background: var(--el-fill-color-light);
}
.user-trigger__info {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  text-align: left;
}
.user-trigger__name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}
.user-trigger__role {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>

<!--
  顶部用户菜单：popper 默认 teleport 到 body，作用域样式无法触达，
  因此单独写在非 scoped 块。类名前缀 user-menu-* 避免与全局冲突。
-->
<style>
.user-menu-popper {
  padding: 6px 0;
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1);
}
.user-menu {
  min-width: 180px;
}
.user-menu__item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 40px;
  padding: 0 16px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, color 0.12s;
}
.user-menu__item:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}
.user-menu__icon {
  font-size: 16px;
  display: inline-flex;
}
.user-menu__switch {
  position: relative;
}
.user-menu__item--group {
  /* 与普通 item 视觉一致；保留类以便扩展（如右侧箭头） */
}
.user-menu__sub {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease;
}
.user-menu__switch.is-open .user-menu__sub {
  grid-template-rows: 1fr;
}
.user-menu__sub-inner {
  min-height: 0;
  overflow: hidden;
}
.user-menu__sub-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  padding: 0 16px 0 38px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: background 0.12s;
}
.user-menu__sub-item:hover {
  background: var(--el-fill-color-light);
}
.user-menu__sub-item.is-current {
  color: var(--el-text-color-secondary);
  cursor: default;
}
.user-menu__sub-item.is-current:hover {
  background: transparent;
}
.user-menu__current {
  font-size: 12px;
  color: var(--el-color-primary);
}
.user-menu__divider {
  height: 1px;
  margin: 4px 0;
  background: var(--el-border-color-lighter);
}
</style>
