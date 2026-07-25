<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BasicLayout, getMenusByApp, filterMenusByPermissions, type AppKey } from '@mic/components'
import { isMicroEnv, getGlobalData, onGlobalData } from '@mic/utils'
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
onMounted(syncUserFromGlobal)
const stopGlobal = onGlobalData((data) => {
  if (data?.userInfo) userStore.userInfo = data.userInfo
})
onUnmounted(stopGlobal)
const userInfo = computed(() => ({
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
