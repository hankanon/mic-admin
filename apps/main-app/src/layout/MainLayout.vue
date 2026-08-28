<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import microApp from '@micro-zoe/micro-app'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import {
  TopNavMenu,
  LayoutActions,
  AppMenu,
  matchMenuKey,
  stripAppPrefix,
  type MenuItem,
  type AppKey,
} from '@mic/components'
import { hasAppPermission } from '@mic/utils'
import { useUserStore } from '../store/user'
import { useTabsStore } from '../store/tabs'
import { useNotificationStore } from '../store/notification'
import TabsView from '../components/TabsView.vue'

// keep-alive 缓存组件需要具名（App.vue include 匹配）
defineOptions({ name: 'MainLayout' })

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const tabsStore = useTabsStore()
const notificationStore = useNotificationStore()

const permissions = computed(() => userStore.userInfo?.permissions ?? [])
// 菜单树来自后端（登录/切换角色时下发），按角色权限动态生成
const menus = computed<MenuItem[]>(() => (userStore.userInfo?.menus ?? []) as unknown as MenuItem[])

// 通知中心：基座登录后建立到 sys-server 的 WebSocket 连接（身份取登录账号名）
const notificationModules = [
  { key: 'dashboard', label: '首页大盘' },
  { key: 'doc', label: '文档管理' },
  { key: 'sys', label: '系统管理' },
  { key: 'profile', label: '个人中心' },
  { key: 'qa', label: '智能问答' },
]
const currentUserId = computed(
  () => userStore.userInfo?.username || (userStore.userInfo?.id != null ? String(userStore.userInfo.id) : undefined),
)
notificationStore.init(currentUserId.value)

// 登录/登出/切角色后同步全局数据到子应用；
// 重新登录时重建通知连接（keep-alive 复用 MainLayout 实例，顶层 init 不会在二次登录执行）
watch(
  () => userStore.userInfo,
  (info) => {
    microApp.setGlobalData({ token: userStore.token, userInfo: info })
    if (info) notificationStore.init(currentUserId.value)
  },
)

const iconComponents = ElementPlusIconsVue as Record<string, any>
function resolveIcon(name?: string) {
  if (!name) return undefined
  return iconComponents[name]
}

/** 判断某顶级菜单项是否为当前激活（路由落在其路径或子项范围内） */
function isTopActive(item: MenuItem): boolean {
  const full = route.fullPath.replace(/^#/, '')
  if (item.path) {
    const cur = stripAppPrefix(full)
    const target = stripAppPrefix(item.path)
    return cur === target || cur.startsWith(target + '/')
  }
  // dashboard baseroute 为 '/dashboard'，数据总览路径为 '/'：匹配根及 /dashboard 子页面（排除 doc/sys）
  if (item.appKey === 'dashboard') {
    if (full === '/' || full === '') return true
    return full.startsWith('/dashboard') && !full.startsWith('/doc') && !full.startsWith('/sys')
  }
  if (item.appKey) return full.startsWith('/' + item.appKey)
  return false
}

/** 当前激活的顶级分组：用于驱动左侧子菜单内容 */
const activeTopGroup = computed(() => menus.value.find((m) => isTopActive(m)))

/** 左侧菜单：仅展示当前顶级分组的 children；首页等无 children 时为空 */
const childMenus = computed<MenuItem[]>(() => activeTopGroup.value?.children ?? [])

/** 左侧子菜单激活项 key（用于 AppMenu 高亮） */
const activeMenu = computed(() => matchMenuKey(childMenus.value, route.fullPath))

/** 侧边菜单收起状态 */
const collapsed = ref(false)

/** 收起态点击图标：导航到该菜单项对应页面 */
function goTop(item: MenuItem) {
  let target = item.path
  if (!target && item.children?.length) target = item.children[0].path
  if (!target) return
  const to = target
  if (to !== route.fullPath.replace(/^#/, '')) router.push(to)
}

const userInfo = computed(() => {
  const info = userStore.userInfo
  // 右上角标签显示当前生效角色名（切换角色后实时反映），未命中时回退姓名
  const currentRoleName = info?.roleList?.find((r) => r.id === info.currentRoleId)?.name
  return {
    id: info?.username || (info?.id != null ? String(info.id) : undefined),
    name: currentRoleName || info?.name || '未登录',
    avatar: info?.avatar,
  }
})

const accounts = computed(() =>
  (userStore.userInfo?.roleList ?? []).map((r) => ({
    username: String(r.id),
    name: r.name,
    current: r.id === userStore.userInfo?.currentRoleId,
  })),
)

/** 在（已按权限过滤的）菜单树中按 key 查找菜单项 */
function findMenu(list: MenuItem[], key: string): MenuItem | undefined {
  for (const m of list) {
    if (m.key === key) return m
    if (m.children) {
      const found = findMenu(m.children, key)
      if (found) return found
    }
  }
  return undefined
}

/** 路由变化时：按当前激活菜单项自动新增页签并同步高亮 */
function syncTabs() {
  const key = matchMenuKey(menus.value, route.fullPath)
  if (key) {
    const item = findMenu(menus.value, key)
    if (item?.path) {
      tabsStore.addTab({ path: item.path, title: item.title, key: item.key })
    }
  }
  // 同步激活高亮（即使未新增也确保当前页签高亮）
  if (tabsStore.tabs.some((t) => t.path === route.path)) {
    tabsStore.setActive(route.path)
  }
}

watch(() => route.fullPath, syncTabs, { immediate: true })

function handleLogout() {
  userStore.logout()
  tabsStore.reset()
  notificationStore.destroy()
  microApp.setGlobalData({ token: '', userInfo: null })
  router.push('/login')
}

/**
 * 切换角色：拉取新角色的权限与菜单，重新下发全局数据，并校正路由与页签到新权限范围内。
 *
 * 一致性策略：
 * - 当前路由所属 app 无权限 → 跳到「第一个有权限的顶级组」的首页（dashboard 永远可达，取 `/`；其他取 children[0].path）
 * - 有权限但当前菜单已不在新菜单树中（如某顶级组的某子项被取消）→ 仍跳到该 app 的首个子项，确保内容区与左侧菜单一致
 * - 跳转完成后由 watch(route.fullPath) 触发 syncTabs 统一添加页签与高亮
 */
async function handleSwitchAccount(roleIdStr: string) {
  const roleId = Number(roleIdStr)
  if (!Number.isInteger(roleId) || roleId === userStore.userInfo?.currentRoleId) return
  try {
    await userStore.switchRole(roleId)
  } catch {
    // 失败时保持原角色（错误提示由请求拦截器统一弹出）
    return
  }
  microApp.setGlobalData({
    token: userStore.token,
    userInfo: userStore.userInfo,
  })
  // 菜单集合已变化：先重置页签，避免校正跳转前残留旧页签干扰高亮
  tabsStore.reset()

  // 解析当前路由所属顶级 appKey
  const path = route.fullPath.replace(/^#/, '')
  const curAppKey = parseAppKeyFromPath(path)
  const perms = userStore.userInfo?.permissions ?? []
  const nextMenus = menus.value // 切换后的新菜单树
  // 校正目标：有权限的第一个顶级组（dashboard 始终第一个且公共可达）
  const targetPath = pickFirstAccessibleAppPath(nextMenus, perms)

  let needRedirect = false
  let redirectTo = targetPath
  if (curAppKey && !hasAppPermission(perms, curAppKey)) {
    // 当前 app 已越权 → 跳转
    needRedirect = true
  } else if (curAppKey && hasAppPermission(perms, curAppKey)) {
    // 当前 app 仍有权限：校验当前叶子页签是否还在新菜单树中
    if (!matchMenuKey(nextMenus, path)) {
      // 当前叶子菜单已下架 → 跳到该 app 的首个可见叶子
      const group = nextMenus.find((m) => m.appKey === curAppKey)
      const firstLeaf = firstLeafPathOf(group)
      needRedirect = true
      redirectTo = firstLeaf || targetPath
    }
  } else {
    // 路由不在任何已知顶级 app 下（理论上不应出现，兜底校正）
    needRedirect = true
  }

  if (needRedirect && redirectTo && redirectTo !== path) {
    // 使用 replace 语义，避免在历史栈留下无效旧路径
    router.replace(redirectTo)
  } else {
    // 未跳转：主动同步一次高亮与页签（tabs 已 reset，需按当前路由重建）
    syncTabs()
  }
}

/** 从路由路径提取顶级 appKey（与 MicroContainer 一致：/dashboard、/doc、/sys、/profile、/qa） */
function parseAppKeyFromPath(fullPath: string): string | null {
  const p = fullPath.replace(/^#/, '')
  const map: Array<[string, string]> = [
    ['/dashboard', 'dashboard'],
    ['/doc', 'doc'],
    ['/sys', 'sys'],
    ['/profile', 'profile'],
    ['/qa', 'qa'],
  ]
  for (const [prefix, key] of map) {
    if (p === prefix || p === prefix + '/' || p.startsWith(prefix + '/')) return key
  }
  if (p === '/' || p === '') return 'dashboard'
  return null
}

/** 从菜单组中取首个可见叶子路径（用于「有权限但当前叶子被下架」时的回退目标） */
function firstLeafPathOf(group: MenuItem | undefined): string | undefined {
  if (!group) return undefined
  if (group.path) return group.path
  return group.children?.[0]?.path
}

/**
 * 在新菜单树中挑选第一个有权限的顶级组的首页路径：
 * - 优先级按 menuConfig 固定顺序：dashboard → doc → qa → profile → sys
 * - 取该组的 path 或首个 children 的 path
 */
function pickFirstAccessibleAppPath(list: MenuItem[], perms: string[]): string {
  const order: AppKey[] = ['dashboard', 'doc', 'qa', 'profile', 'sys']
  for (const key of order) {
    const group = list.find((m) => m.appKey === key)
    if (!group) continue
    if (key === 'dashboard' || hasAppPermission(perms, key)) {
      const p = firstLeafPathOf(group)
      if (p) return p
    }
  }
  // 兜底：根路径（始终可访问）
  return '/'
}

/** 点击通知项：若携带业务链接则跳转（基座直接 router.push，子应用通过 MicroMsgType 转发） */
function handleNotificationSelect(msg: { link?: string }) {
  if (msg.link) {
    router.push(msg.link)
  }
}
</script>

<template>
  <div class="main-layout">
    <!-- 左侧：系统名 + aside 菜单 -->
    <aside
      class="main-layout__left"
      :class="{ 'is-empty': !childMenus.length, 'is-collapsed': collapsed }"
      :style="{ width: collapsed ? '64px' : '220px' }"
    >
      <div class="main-layout__logo" :class="{ 'is-collapsed': collapsed }">
        <span v-show="!collapsed" class="main-layout__logo-text">MIC Admin 控制台</span>
        <el-button
          text
          circle
          class="main-layout__logo-toggle"
          :title="collapsed ? '展开菜单' : '收起菜单'"
          @click="collapsed = !collapsed"
        >
          <el-icon><component :is="resolveIcon(collapsed ? 'Expand' : 'Fold')" /></el-icon>
        </el-button>
      </div>

      <div class="main-layout__menu">
        <!-- 无子菜单（如首页）：展示空状态占位 -->
        <div v-if="!childMenus.length" class="main-layout__menu-empty">
          <span v-show="!collapsed">暂无子菜单</span>
        </div>

        <!-- 展开：完整菜单布局 -->
        <AppMenu
          v-else-if="!collapsed"
          :menus="childMenus"
          :active-menu="activeMenu"
          mode="host"
        />

        <!-- 收起：仅展示各子菜单图标，悬停提示名称 -->
        <div v-else class="collapse-bar">
          <div
            v-for="item in childMenus"
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
    </aside>

    <!-- 右侧：topbar + tabs + 内容区 -->
    <div class="main-layout__right">
      <header class="main-layout__topbar">
        <TopNavMenu :menus="menus" mode="host" class="main-layout__topnav" />
        <LayoutActions
          :user-info="userInfo"
          :accounts="accounts"
          mode="host"
          :on-before-guide="() => { if (collapsed) collapsed = false }"
          :notifications="notificationStore.messages"
          :notification-unread="notificationStore.unreadCount"
          :notification-status="notificationStore.connectionStatus"
          :notification-prefs="notificationStore.prefs"
          :notification-modules="notificationModules"
          @logout="handleLogout"
          @switch-account="handleSwitchAccount"
          @update:notification-prefs="(p) => notificationStore.updatePrefs(p)"
          @notification-mark-read="(id) => notificationStore.markRead(id)"
          @notification-mark-all="notificationStore.markAllRead"
          @notification-clear="notificationStore.clearAll"
          @notification-select="handleNotificationSelect"
        />
      </header>

      <div class="main-layout__tabs">
        <TabsView />
      </div>

      <main class="main-layout__main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
/* 左侧布局：系统名 + aside 菜单 */
.main-layout__left {
  flex-shrink: 0;
  background: var(--mic-aside-bg);
  color: var(--mic-text-inverse);
  display: flex;
  flex-direction: column;
  transition: width 0.28s ease, background-color 0.28s ease;
  overflow: hidden;
}
.main-layout__left.is-collapsed {
  background: color-mix(in srgb, var(--el-color-primary) 30%, transparent);
}
/* 无子菜单时（如首页）：左侧背景改为白色，与右侧主区统一 */
.main-layout__left.is-empty {
  background: var(--mic-header-bg);
  color: var(--mic-text);
}
.main-layout__left.is-empty.is-collapsed {
  background: var(--mic-header-bg);
}
/* 无子菜单时：菜单主体区改白色，logo 区保持主题蓝高亮以体现品牌区 */
.main-layout__left.is-empty .main-layout__menu {
  background: var(--mic-header-bg);
}
.main-layout__logo {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px 0 16px;
  font-weight: 600;
  font-size: 16px;
  color: var(--mic-text-inverse);
  background: var(--el-color-primary);
  white-space: nowrap;
  transition: background-color 0.28s ease;
}
.main-layout__logo.is-collapsed {
  justify-content: center;
  padding: 0;
  background: color-mix(in srgb, var(--el-color-primary) 30%, transparent);
}
.main-layout__logo-text {
  overflow: hidden;
  text-overflow: ellipsis;
}
.main-layout__logo-toggle {
  margin-left: auto;
  color: var(--mic-text-inverse);
  font-size: 18px;
  transition: background-color 0.15s, color 0.15s;
}
.main-layout__logo.is-collapsed .main-layout__logo-toggle {
  margin-left: 0;
}
.main-layout__logo-toggle:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}
.main-layout__menu {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.main-layout__menu-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}
/* 无子菜单时（白色背景）：空状态文字用浅灰色 */
.main-layout__left.is-empty .main-layout__menu-empty {
  color: var(--el-text-color-secondary);
}
/* 收起态图标栏 */
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
/* 右侧布局 */
.main-layout__right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.main-layout__topbar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  background: var(--mic-header-bg);
  border-bottom: 1px solid var(--mic-border);
  padding: 0 16px;
}
.main-layout__topnav {
  flex: 1;
  min-width: 0;
}
.main-layout__tabs {
  flex-shrink: 0;
  background: var(--mic-header-bg);
}
.main-layout__main {
  flex: 1;
  overflow: auto;
  background: var(--mic-bg);
  padding: 16px;
}
</style>
