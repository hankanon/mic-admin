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

const appKey: AppKey = 'sys'
const permissions = computed(() => userStore.userInfo?.permissions ?? ['*'])
const menus = computed(() => filterMenusByPermissions(getMenusByApp(appKey), permissions.value))

// 微前端环境：同步主应用下发的用户信息（含权限），切换角色后实时生效
function syncUserFromGlobal() {
  const data = getGlobalData()
  if (data?.userInfo) userStore.userInfo = data.userInfo
}
const { setTheme } = useTheme()

// 子应用独立文档也需主题：本地偏好/系统兜底，集成时以基座下发主题为准
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
      <keep-alive include="MenuManage,RoleManage,UserManage">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </template>
  <BasicLayout
    v-else-if="useLayout"
    :menus="menus"
    mode="standalone"
    app-title="系统管理"
    :user-info="userInfo"
    @logout="handleLogout"
  >
    <router-view v-slot="{ Component }">
      <keep-alive include="MenuManage,RoleManage,UserManage">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </BasicLayout>
</template>
