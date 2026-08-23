<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BasicLayout, getMenusByApp, filterMenusByPermissions, type AppKey } from '@mic/components'
import { isMicroEnv, getGlobalData, onGlobalData, initTheme, useTheme } from '@mic/utils'
import { useUserStore } from './store/user'

const micro = isMicroEnv()
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const appKey: AppKey = 'profile'
const permissions = computed(() => userStore.userInfo?.permissions ?? ['*'])
const allMenus = computed(() => filterMenusByPermissions(getMenusByApp(appKey), permissions.value))
// 左侧仅展示当前应用分组的 children
const menus = computed(() => {
  const group = allMenus.value.find((m) => m.appKey === appKey)
  return group?.children ?? []
})

function syncUserFromGlobal() {
  const data = getGlobalData()
  if (data?.userInfo) userStore.userInfo = data.userInfo
}
const { setTheme } = useTheme()

onMounted(() => {
  initTheme()
  syncUserFromGlobal()
  if (micro) {
    const data = getGlobalData()
    if (data?.theme) setTheme(data.theme)
  }
})
const stopGlobal = onGlobalData((data) => {
  if (data?.userInfo) userStore.userInfo = data.userInfo
  if (data?.theme) setTheme(data.theme)
})
onUnmounted(stopGlobal)

const userInfo = computed(() => ({
  id: userStore.userInfo?.id != null ? String(userStore.userInfo.id) : undefined,
  name: userStore.userInfo?.name || '未登录',
  avatar: userStore.userInfo?.avatar,
}))

const useLayout = computed(() => !micro && route.path !== '/login')

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<template>
  <template v-if="micro || route.path === '/login'">
    <router-view v-slot="{ Component }">
      <keep-alive include="PersonalView,TodoList">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </template>
  <BasicLayout
    v-else-if="useLayout"
    :menus="menus"
    mode="standalone"
    app-title="个人中心"
    :user-info="userInfo"
    @logout="handleLogout"
  >
    <router-view v-slot="{ Component }">
      <keep-alive include="PersonalView,TodoList">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </BasicLayout>
</template>
