<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { type MenuItem, stripAppPrefix } from './config'

const props = withDefaults(
  defineProps<{
    menus: MenuItem[]
    /** host: 主应用，按完整路径跳转；standalone: 子应用独立运行，剥离前缀跳转 */
    mode?: 'host' | 'standalone'
  }>(),
  { mode: 'host' },
)

const router = useRouter()
const route = useRoute()

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
  if (item.appKey) return full.startsWith('/' + item.appKey)
  // 无 path/appKey 的项（如首页 path:'/'）特殊处理
  if (item.key === 'home') return full === '/' || full === ''
  return false
}

const activeTopKey = computed(() => {
  const found = props.menus.find((m) => isTopActive(m))
  return found?.key ?? ''
})

/** 点击顶级项：跳转到该项首页（path 或首个 child path） */
function handleSelect(item: MenuItem) {
  let target = item.path
  if (!target && item.children?.length) target = item.children[0].path
  if (!target) return
  const to = props.mode === 'standalone' ? stripAppPrefix(target) : target
  if (to !== route.fullPath.replace(/^#/, '')) router.push(to)
}
</script>

<template>
  <el-menu
    :default-active="activeTopKey"
    mode="horizontal"
    class="top-nav-menu"
    :ellipsis="false"
    @select="(key: string) => { const it = menus.find(m => m.key === key); if (it) handleSelect(it) }"
  >
    <el-menu-item
      v-for="item in menus"
      :key="item.key"
      :index="item.key"
      :class="{ 'is-active': isTopActive(item) }"
    >
      <el-icon v-if="item.icon"><component :is="resolveIcon(item.icon)" /></el-icon>
      <span>{{ item.title }}</span>
    </el-menu-item>
  </el-menu>
</template>

<style scoped>
.top-nav-menu {
  border-bottom: none;
  background: transparent;
  height: 56px;
  display: flex;
  align-items: center;
}
.top-nav-menu :deep(.el-menu-item) {
  height: 56px;
  line-height: 56px;
  border-bottom: 2px solid transparent;
  font-size: 14px;
}
.top-nav-menu :deep(.el-menu-item.is-active) {
  border-bottom-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: transparent;
}
.top-nav-menu :deep(.el-menu-item:hover) {
  background: var(--el-fill-color-light);
}
</style>
