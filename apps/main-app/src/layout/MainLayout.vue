<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import microApp from '@micro-zoe/micro-app'
import {
  BasicLayout,
  menuConfig,
  filterMenusByPermissions,
  matchMenuKey,
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
  <BasicLayout
    :menus="menus"
    mode="host"
    app-title="MIC Admin 控制台"
    :user-info="userInfo"
    :accounts="accounts"
    @logout="handleLogout"
    @switch-account="handleSwitchAccount"
  >
    <template #tabs>
      <TabsView />
    </template>
    <router-view />
  </BasicLayout>
</template>
