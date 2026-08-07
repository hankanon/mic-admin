<script setup lang="ts">
import { computed, watch, onMounted, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import microApp from '@micro-zoe/micro-app'
import { useUserStore } from '../store/user'
import { MicroMsgType, useTheme } from '@mic/utils'
import { microApps, type MicroAppItem } from '../micro/apps'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()
const { currentTheme } = useTheme()

const globalData = computed(() => ({
  token: userStore.token,
  userInfo: userStore.userInfo,
  // 主题跟随基座单例状态；micro-app 会在 :data 变化时自动下发到子应用 iframe
  theme: currentTheme.value,
}))

/** 当前基座路由所属的子应用（用于 v-show 显隐，实现子应用级缓存） */
const activeAppName = computed<string | undefined>(() => {
  const path = route.fullPath.replace(/^#/, '')
  return microApps.find(
    (a) => path === a.baseroute || path === a.baseroute + '/' || path.startsWith(a.baseroute + '/'),
  )?.name
})

/** 从基座路由提取某子应用的子路径（去掉 baseroute 前缀） */
function getSubPath(app: MicroAppItem): string {
  const path = route.fullPath.replace(/^#/, '')
  if (path === app.baseroute || path === app.baseroute + '/') return '/'
  const sub = path.startsWith(app.baseroute + '/') ? path.slice(app.baseroute.length) : '/'
  return sub || '/'
}

/** 已挂载（iframe 渲染完成）的子应用集合，用于避免子应用未就绪时调用 router.push */
const mountedApps = reactive(new Set<string>())

/** 仅向当前激活且已渲染的子应用同步子路由，避免打扰隐藏（已缓存）的应用 */
function syncSubRoute() {
  const name = activeAppName.value
  if (!name) return
  const app = microApps.find((a) => a.name === name)
  if (!app) return
  // 子应用未渲染就绪（首次进入）时调用 microApp.router.push 会报「导航失败」，
  // 跳过等待 @mounted 后再补同步（见 onAppMounted）
  if (!mountedApps.has(name)) return
  try {
    microApp.router.push({ name, path: getSubPath(app) })
  } catch {
    // 极小概率仍未就绪时忽略，@mounted / 后续 watch 重试
  }
}

/** 子应用 iframe 渲染完成后记录并补同步，确保首次进入深层子路由也能落在正确页面 */
function onAppMounted(name: string) {
  mountedApps.add(name)
  if (name === activeAppName.value) syncSubRoute()
}

onMounted(syncSubRoute)
watch(() => route.fullPath, syncSubRoute)

function onDataChange(e: CustomEvent) {
  const data = e?.detail?.data
  if (!data || typeof data !== 'object') return
  switch (data.type) {
    case MicroMsgType.Unauthorized:
    case MicroMsgType.Logout:
      userStore.logout()
      router.push('/login')
      break
    case MicroMsgType.RefreshUser:
      microApp.setGlobalData({ token: userStore.token, userInfo: userStore.userInfo })
      break
    default:
      break
  }
}
</script>

<template>
  <div class="micro-container">
    <!-- 同时挂载全部子应用，仅用 v-show 切换显隐，实现应用级缓存（切走不卸载） -->
    <micro-app
      v-for="app in microApps"
      :key="app.name"
      :name="app.name"
      :url="app.url"
      :baseroute="app.baseroute"
      :data="globalData"
      iframe
      v-show="app.name === activeAppName"
      @datachange="onDataChange"
      @mounted="onAppMounted(app.name)"
    />
    <el-empty v-if="!activeAppName" description="未找到子应用配置" />
  </div>
</template>

<style scoped>
.micro-container {
  height: 100%;
  width: 100%;
}
</style>
