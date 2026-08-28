<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { type MenuItem, stripAppPrefix, matchMenuKey } from './config'

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

/** 判断某顶级菜单项是否为当前激活（路由落在其路径、子项或子页范围内） */
function isTopActive(item: MenuItem): boolean {
  const full = route.fullPath.replace(/^#/, '')
  if (item.path) {
    const cur = stripAppPrefix(full)
    const target = stripAppPrefix(item.path)
    return cur === target || cur.startsWith(target + '/')
  }
  if (item.appKey) {
    // dashboard 顶级组的「数据总览」叶子 path='/'：必须先单独命中 '/'，
    // 否则 stripAppPrefix('/') -> '/'，与 child path 逻辑也能命中，但 'appKey 兜底'会误把 '/doc' 也归到 dashboard
    if (item.appKey === 'dashboard') {
      if (full === '/' || full === '') return true
      return full.startsWith('/dashboard') && !full.startsWith('/doc') && !full.startsWith('/sys')
    }
    if (full.startsWith('/' + item.appKey)) return true
  }
  // 兜底：递归检查 children —— 若当前路由能匹配到任一子菜单，则顶级组激活
  if (item.children?.length && matchMenuKey(item.children, full)) return true
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
