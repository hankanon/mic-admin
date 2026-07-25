<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import microApp from '@micro-zoe/micro-app'
import { BasicLayout, menuConfig, filterMenusByPermissions } from '@mic/components'
import { SWITCHABLE_ACCOUNTS, hasAppPermission } from '@mic/utils'
import { useUserStore } from '../store/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const permissions = computed(() => userStore.userInfo?.permissions ?? [])
const menus = computed(() => filterMenusByPermissions(menuConfig, permissions.value))

const userInfo = computed(() => ({
  name: userStore.userInfo?.name || '未登录',
  avatar: userStore.userInfo?.avatar,
}))

const accounts = computed(() =>
  SWITCHABLE_ACCOUNTS.map((a) => ({ ...a, current: a.username === userStore.userInfo?.id })),
)

function handleLogout() {
  userStore.logout()
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
    theme: 'light',
  })
  const path = route.fullPath.replace(/^#/, '')
  const appKey = path.startsWith('/doc') ? 'doc' : path.startsWith('/sys') ? 'sys' : null
  if (appKey && !hasAppPermission(perms, appKey)) {
    const first = (['doc', 'sys'] as const).find((k) => hasAppPermission(perms, k))
    router.push(first ? `/${first}` : '/')
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
    <router-view />
  </BasicLayout>
</template>
