<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import microApp from '@micro-zoe/micro-app'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import {
  TopNavMenu,
  LayoutActions,
  AppMenu,
  menuConfig,
  filterMenusByPermissions,
  matchMenuKey,
  stripAppPrefix,
  type MenuItem,
} from '@mic/components'
import { SWITCHABLE_ACCOUNTS, hasAppPermission } from '@mic/utils'
import { useUserStore } from '../store/user'
import { useTabsStore } from '../store/tabs'
import TabsView from '../components/TabsView.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const tabsStore = useTabsStore()

const permissions = computed(() => userStore.userInfo?.permissions ?? [])
const menus = computed(() => filterMenusByPermissions(menuConfig, permissions.value))

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

const userInfo = computed(() => ({
  id: userStore.userInfo?.id != null ? String(userStore.userInfo.id) : undefined,
  name: userStore.userInfo?.name || '未登录',
  avatar: userStore.userInfo?.avatar,
}))

const accounts = computed(() =>
  SWITCHABLE_ACCOUNTS.map((a) => ({ ...a, current: a.username === userStore.userInfo?.id })),
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
  microApp.setGlobalData({ token: '', userInfo: null })
  router.push('/login')
}

/** 切换角色：更新用户态、重新下发全局数据，并校正当前路由到权限范围内 */
function handleSwitchAccount(username: string) {
  userStore.switchAccount(username)
  const perms = userStore.userInfo?.permissions ?? []
  microApp.setGlobalData({
    token: userStore.token,
    userInfo: userStore.userInfo,
  })
  const path = route.fullPath.replace(/^#/, '')
  const appKey = path.startsWith('/doc') ? 'doc' : path.startsWith('/sys') ? 'sys' : null
  if (appKey && !hasAppPermission(perms, appKey)) {
    const first = (['doc', 'sys'] as const).find((k) => hasAppPermission(perms, k))
    router.push(first ? `/${first}` : '/')
    tabsStore.reset()
    syncTabs()
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
          @logout="handleLogout"
          @switch-account="handleSwitchAccount"
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
