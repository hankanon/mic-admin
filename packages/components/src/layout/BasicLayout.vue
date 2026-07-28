<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import AppMenu from '../menu/AppMenu.vue'
import { type MenuItem, matchMenuKey, stripAppPrefix } from '../menu/config'
import { emitToMain, MicroMsgType, useTheme } from '@mic/utils'

const props = withDefaults(
  defineProps<{
    menus: MenuItem[]
    appTitle?: string
    logo?: string
    userInfo?: { id?: string; name: string; avatar?: string }
    mode?: 'host' | 'standalone'
    accounts?: { username: string; name: string; current?: boolean }[]
  }>(),
  { appTitle: 'MIC Admin', mode: 'host' },
)

const emit = defineEmits<{
  (e: 'logout'): void
  (e: 'switch-account', username: string): void
}>()

const router = useRouter()
const route = useRoute()

/** 触发区显示名：优先用登录账号 id 首字母大写（与参考图 "Admin" 对应），回退到 name */
const displayName = computed(() => {
  const info = props.userInfo as { id?: string; name: string } | undefined
  const id = info?.id
  if (id) return id.charAt(0).toUpperCase() + id.slice(1)
  return info?.name || '未登录'
})
/** 角色标签：显示在 name 下方并带方括号；与 displayName 相同时隐藏以避免重复 */
const roleLabel = computed(() => props.userInfo?.name || '')

// 主题切换（模块级单例，跨基座与子应用共用；基座切换会自动通过 micro-app :data 下发子应用）
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

/** 侧边菜单收起状态：false 展开（完整布局），true 收起（仅显示子应用图标） */
const collapsed = ref(false)

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
 * 操作指引：分步式引导。每一步只聚焦一个功能点。
 * - icon：步骤主图标（大号显示在卡片顶部）
 * - title：步骤标题
 * - subtitle：步骤副标题
 * - desc：步骤详细描述
 * - features：该步骤下可展开的功能列表（可选）
 */
interface GuideStep {
  icon: string
  title: string
  subtitle: string
  desc: string
  features?: string[]
}
const guideSteps: GuideStep[] = [
  {
    icon: 'Operation',
    title: '欢迎使用操作指引',
    subtitle: '快速了解平台核心功能',
    desc: '接下来将分步为您介绍顶部导航栏中的常用按钮，以及各子应用的功能定位，可随时跳过或上一步返回。',
  },
  {
    icon: 'QuestionFilled',
    title: '操作指引入口',
    subtitle: '随时查阅功能说明',
    desc: '点击该按钮即可随时重新打开本指引，介绍头部按钮与各子应用的作用。',
  },
  {
    icon: 'Sunny',
    title: '切换系统主题',
    subtitle: '一键开启护眼模式',
    desc: '在「白天模式」与「黑夜模式」之间切换，偏好会自动持久化保存，下次访问自动沿用。',
  },
  {
    icon: 'FullScreen',
    title: '全屏切换',
    subtitle: '沉浸式使用体验',
    desc: '进入或退出浏览器全屏视图；进入全屏后也可按 ESC 键退出。',
  },
  {
    icon: 'UserFilled',
    title: '用户菜单',
    subtitle: '账号相关操作',
    desc: '点击右上角头像展开，可进行「个人资料」「切换角色」「退出登录」等操作。',
  },
  {
    icon: 'Fold',
    title: '菜单展开 / 收起',
    subtitle: '灵活调整布局',
    desc: '点击左下角按钮收起侧边栏（仅保留子应用图标）或重新展开，节省横向空间。',
  },
  {
    icon: 'HomeFilled',
    title: '首页',
    subtitle: '基座欢迎页',
    desc: '快速概览平台入口与各子应用导航，是登录后的默认着陆页。',
  },
  {
    icon: 'Document',
    title: '文档发布',
    subtitle: '内容运营子应用',
    desc: '提供文档管理与发布相关能力。',
    features: ['文档列表：查看、检索与管理全部文档', '发布管理：编辑、提交与发布文档'],
  },
  {
    icon: 'Setting',
    title: '系统管理',
    subtitle: '平台后台子应用',
    desc: '负责权限与组织配置的后台管理模块。',
    features: [
      '菜单管理：维护系统菜单结构',
      '角色管理：配置角色与对应权限',
      '人员管理：维护平台用户与账号',
    ],
  },
]

/** 操作指引弹窗状态与当前步骤索引 */
const showGuide = ref(false)
const currentStep = ref(0)
/** 是否为最后一步（用于切换「下一步」文案为「完成」） */
const isLastStep = computed(() => currentStep.value === guideSteps.length - 1)
/** 是否为第一步（用于禁用「上一步」） */
const isFirstStep = computed(() => currentStep.value === 0)
/** 进度百分比（用于进度条） */
const progressPercent = computed(() =>
  Math.round(((currentStep.value + 1) / guideSteps.length) * 100),
)
/** 打开指引时重置到第一步 */
function openGuide() {
  currentStep.value = 0
  showGuide.value = true
}
function nextStep() {
  if (isLastStep.value) showGuide.value = false
  else currentStep.value += 1
}
function prevStep() {
  if (!isFirstStep.value) currentStep.value -= 1
}
/** 跳过 / 完成 按钮 */
function skipGuide() {
  showGuide.value = false
}

const activeMenu = computed(() => matchMenuKey(props.menus, route.fullPath))

/** 收起态：判断当前路由是否落在某顶级菜单项（含其子项）范围内，用于图标高亮 */
function isTopActive(item: MenuItem): boolean {
  const full = route.fullPath
  if (item.path) {
    const cur = stripAppPrefix(full)
    const target = stripAppPrefix(item.path)
    return cur === target || cur.startsWith(target + '/')
  }
  if (item.appKey) return full.startsWith('/' + item.appKey)
  return false
}

/** 收起态点击图标：导航到该顶级项（子应用）对应的首个页面 */
function goTop(item: MenuItem) {
  let target = item.path
  if (!target && item.children?.length) target = item.children[0].path
  if (!target) return
  const to = props.mode === 'standalone' ? stripAppPrefix(target) : target
  if (to !== route.fullPath) router.push(to)
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
    router.push('/login')
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
  <el-container class="basic-layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="basic-layout__aside">
      <div class="basic-layout__logo" :class="{ 'is-collapsed': collapsed }">
        <img v-if="logo" :src="logo" alt="logo" class="basic-layout__logo-img" />
        <span v-show="!collapsed" class="basic-layout__logo-text">{{ appTitle }}</span>
      </div>

      <div class="basic-layout__menu">
        <!-- 展开：完整菜单布局 -->
        <AppMenu v-if="!collapsed" :menus="menus" :active-menu="activeMenu" :mode="mode" />

        <!-- 收起：仅展示各子应用图标，悬停提示名称 -->
        <div v-else class="collapse-bar">
          <div
            v-for="item in menus"
            :key="item.key"
            class="collapse-item"
            :class="{ 'is-active': isTopActive(item) }"
            @click="goTop(item)"
          >
            <el-tooltip :content="item.title" placement="right" :show-after="0">
              <span class="collapse-item__icon">
                <el-icon v-if="item.icon"><component :is="resolveIcon(item.icon)" /></el-icon>
              </span>
            </el-tooltip>
          </div>
        </div>
      </div>

      <div
        class="basic-layout__collapse-toggle"
        :title="collapsed ? '展开菜单' : '收起菜单'"
        @click="collapsed = !collapsed"
      >
        <el-icon><component :is="resolveIcon(collapsed ? 'Expand' : 'Fold')" /></el-icon>
      </div>
    </el-aside>

    <el-container>
      <el-header class="basic-layout__header">
        <div class="basic-layout__header-title">{{ appTitle }}</div>
        <div class="basic-layout__header-right">
          <!-- 操作指引：打开指引弹窗（分步式引导） -->
          <el-tooltip content="操作指引" placement="bottom">
            <el-button text circle class="basic-layout__theme-btn" @click="openGuide">
              <el-icon><component :is="resolveIcon('QuestionFilled')" /></el-icon>
            </el-button>
          </el-tooltip>
          <!-- 主题切换：昼夜图标（点击切换到对立模式），tooltip 提示 -->
          <el-tooltip
            :content="currentTheme === 'dark' ? '切换到白天模式' : '切换到黑夜模式'"
            placement="bottom"
          >
            <el-button text circle class="basic-layout__theme-btn" @click="toggleTheme($event)">
              <el-icon><component :is="resolveIcon(currentTheme === 'dark' ? 'Sunny' : 'Moon')" /></el-icon>
            </el-button>
          </el-tooltip>
          <!-- 全屏切换：进入/退出全屏，图标随状态变化，tooltip 提示 -->
          <el-tooltip
            :content="isFullscreen ? '退出全屏' : '全屏'"
            placement="bottom"
          >
            <el-button text circle class="basic-layout__theme-btn" @click="toggleFullscreen">
              <el-icon><component :is="resolveIcon(isFullscreen ? 'Aim' : 'FullScreen')" /></el-icon>
            </el-button>
          </el-tooltip>
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
      </el-header>

      <div v-if="$slots.tabs" class="basic-layout__tabs">
        <slot name="tabs" />
      </div>

      <el-main class="basic-layout__main">
        <slot />
      </el-main>
    </el-container>
  </el-container>

  <!-- 操作指引：分步式引导弹窗 -->
  <el-dialog
    v-model="showGuide"
    title="操作指引"
    width="540px"
    class="guide-dialog"
    :append-to-body="true"
    destroy-on-close
    align-center
  >
    <div class="guide">
      <!-- 进度条 + 步骤计数 -->
      <div class="guide__progress">
        <el-progress
          :percentage="progressPercent"
          :show-text="false"
          :stroke-width="4"
          class="guide__progress-bar"
        />
        <span class="guide__counter">
          {{ currentStep + 1 }} / {{ guideSteps.length }}
        </span>
      </div>

      <!-- 当前步骤内容（带平滑过渡） -->
      <Transition name="guide-fade" mode="out-in">
        <div class="guide__step" :key="currentStep">
          <div class="guide__icon-wrap">
            <el-icon class="guide__icon"><component :is="resolveIcon(guideSteps[currentStep].icon)" /></el-icon>
          </div>
          <h2 class="guide__title">{{ guideSteps[currentStep].title }}</h2>
          <div class="guide__subtitle">{{ guideSteps[currentStep].subtitle }}</div>
          <p class="guide__desc">{{ guideSteps[currentStep].desc }}</p>
          <ul v-if="guideSteps[currentStep].features?.length" class="guide__features">
            <li v-for="f in guideSteps[currentStep].features" :key="f">{{ f }}</li>
          </ul>
        </div>
      </Transition>
    </div>

    <template #footer>
      <div class="guide__footer">
        <!-- 步骤指示点 -->
        <div class="guide__dots" :aria-label="`第 ${currentStep + 1} 步，共 ${guideSteps.length} 步`">
          <span
            v-for="(s, i) in guideSteps"
            :key="i"
            class="guide__dot"
            :class="{ 'is-active': i === currentStep, 'is-done': i < currentStep }"
            @click="currentStep = i"
          />
        </div>

        <div class="guide__actions">
          <el-button text :disabled="isFirstStep" @click="prevStep">
            <el-icon><component :is="resolveIcon('ArrowLeft')" /></el-icon>
            <span style="margin-left: 4px">上一步</span>
          </el-button>
          <el-button text @click="skipGuide">
            {{ isLastStep ? '完成' : '跳过' }}
          </el-button>
          <el-button type="primary" round @click="nextStep">
            {{ isLastStep ? '完成' : '下一步' }}
            <el-icon v-if="!isLastStep" style="margin-left: 4px">
              <component :is="resolveIcon('ArrowRight')" />
            </el-icon>
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.basic-layout {
  height: 100vh;
}
.basic-layout__aside {
  background: var(--mic-aside-bg);
  color: var(--mic-text-inverse);
  display: flex;
  flex-direction: column;
  transition: width 0.28s ease;
  overflow: hidden;
}
.basic-layout__logo {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  font-weight: 600;
  font-size: 16px;
  color: var(--mic-text-inverse);
  background: var(--mic-logo-bg);
  white-space: nowrap;
}
.basic-layout__logo.is-collapsed {
  justify-content: center;
  padding: 0;
}
.basic-layout__logo-img {
  width: 28px;
  height: 28px;
}
.basic-layout__menu {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
/* 收起态图标栏：竖向居中排列，统一图标尺寸与间距 */
.collapse-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
}
.collapse-item {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.75);
  transition: background 0.15s, color 0.15s;
}
.collapse-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.collapse-item.is-active {
  background: var(--el-color-primary);
  color: #fff;
}
.collapse-item__icon {
  display: inline-flex;
  font-size: 20px;
  line-height: 1;
}
.basic-layout__collapse-toggle {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.7);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  transition: color 0.15s, background 0.15s;
}
.basic-layout__collapse-toggle:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}
.basic-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--mic-header-bg);
  border-bottom: 1px solid var(--mic-border);
  color: var(--mic-text);
}
.basic-layout__theme-btn {
  margin-right: 4px;
}
.basic-layout__tabs {
  background: var(--mic-header-bg);
}
.basic-layout__header-right {
  display: flex;
  align-items: center;
  gap: 12px;
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
.basic-layout__main {
  background: var(--mic-bg);
  padding: 16px;
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

/* 操作指引弹窗（el-dialog 默认 teleport 到 body，作用域样式无法触达，故写在此非 scoped 块） */
.guide-dialog .el-dialog__header {
  padding-bottom: 8px;
}
.guide-dialog .el-dialog__body {
  padding-top: 4px;
  padding-bottom: 8px;
}
.guide-dialog .el-dialog__footer {
  padding-top: 0;
}
.guide {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* 顶部进度条 + 步骤计数 */
.guide__progress {
  display: flex;
  align-items: center;
  gap: 12px;
}
.guide__progress-bar {
  flex: 1;
}
.guide__counter {
  flex: none;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
/* 单个步骤卡片：图标 + 标题 + 副标题 + 描述 + 功能列表 */
.guide__step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 8px 4px 4px;
  min-height: 200px;
}
.guide__icon-wrap {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
  margin-bottom: 16px;
  transition: background 0.3s, color 0.3s, transform 0.3s;
}
.guide__icon {
  font-size: 36px;
  line-height: 1;
}
.guide__title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 0.5px;
}
.guide__subtitle {
  font-size: 14px;
  color: var(--el-color-primary);
  margin-bottom: 14px;
  opacity: 0.85;
}
.guide__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  max-width: 440px;
}
.guide__features {
  margin: 12px 0 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}
.guide__features li {
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}
/* 底部：步骤指示点 + 操作按钮组 */
.guide__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.guide__dots {
  display: flex;
  align-items: center;
  gap: 6px;
}
.guide__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-border-color);
  cursor: pointer;
  transition: background 0.2s, transform 0.2s, width 0.2s;
}
.guide__dot:hover {
  background: var(--el-color-primary-light-5, var(--el-color-primary));
}
.guide__dot.is-done {
  background: var(--el-color-primary-light-3, var(--el-color-primary));
}
.guide__dot.is-active {
  background: var(--el-color-primary);
  width: 20px;
  border-radius: 4px;
}
.guide__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* 步骤切换的平滑过渡（淡入 + 上移） */
.guide-fade-enter-active,
.guide-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.guide-fade-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.guide-fade-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
/* 响应式：窄屏下压缩间距与字号 */
@media (max-width: 560px) {
  .guide__icon-wrap {
    width: 60px;
    height: 60px;
    margin-bottom: 12px;
  }
  .guide__icon {
    font-size: 30px;
  }
  .guide__title {
    font-size: 18px;
  }
  .guide__subtitle {
    font-size: 13px;
    margin-bottom: 10px;
  }
  .guide__desc {
    font-size: 12px;
  }
  .guide__footer {
    flex-direction: column-reverse;
    align-items: stretch;
    gap: 10px;
  }
  .guide__dots {
    justify-content: center;
  }
  .guide__actions {
    justify-content: space-between;
  }
}
</style>
