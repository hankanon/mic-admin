<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { type MenuItem, stripAppPrefix } from './config'

const props = withDefaults(
  defineProps<{
    menus: MenuItem[]
    activeMenu?: string
    /** host: 主应用，按完整路径跳转；standalone: 子应用独立运行，剥离前缀跳转 */
    mode?: 'host' | 'standalone'
  }>(),
  { activeMenu: '', mode: 'host' },
)

const router = useRouter()
const menuRef = ref<{ open: (index: string) => void } | null>(null)

const iconComponents = ElementPlusIconsVue as Record<string, any>

function resolveIcon(name?: string) {
  if (!name) return undefined
  return iconComponents[name]
}

function handleSelect(item: MenuItem) {
  if (!item.path) return
  const target = props.mode === 'standalone' ? stripAppPrefix(item.path) : item.path
  if (target === router.currentRoute.value.fullPath) return
  router.push(target)
}

/** 查找激活菜单项所属的父级子菜单 key */
function findParentKey(key: string): string | undefined {
  for (const item of props.menus) {
    if (item.children?.some((child) => child.key === key)) return item.key
  }
  return undefined
}

/**
 * 保证激活项所属的子菜单保持展开。
 * Element Plus 仅在初始化 / items 变化时自动展开激活项父级，
 * 监听 default-active 变化不会重新展开，导航后需主动 open。
 */
async function ensureActiveOpen() {
  await nextTick()
  const parent = findParentKey(props.activeMenu)
  if (!parent) return
  try {
    menuRef.value?.open(parent)
  } catch {
    // 子菜单尚未注册时忽略
  }
}

onMounted(ensureActiveOpen)
watch(() => props.activeMenu, ensureActiveOpen)

const defaultActive = computed(() => props.activeMenu)
</script>

<template>
  <el-menu
    ref="menuRef"
    :default-active="defaultActive"
    class="mic-app-menu"
    :collapse-transition="false"
  >
    <template v-for="item in menus" :key="item.key">
      <!-- 含子菜单 -->
      <el-sub-menu v-if="item.children && item.children.length" :index="item.key">
        <template #title>
          <el-icon v-if="item.icon"><component :is="resolveIcon(item.icon)" /></el-icon>
          <span>{{ item.title }}</span>
        </template>
        <el-menu-item
          v-for="child in item.children"
          :key="child.key"
          :index="child.key"
          :data-menu-key="child.key"
          @click="handleSelect(child)"
        >
          <el-icon v-if="child.icon"><component :is="resolveIcon(child.icon)" /></el-icon>
          <template #title>{{ child.title }}</template>
        </el-menu-item>
      </el-sub-menu>

      <!-- 普通菜单项 -->
      <el-menu-item v-else :index="item.key" :data-menu-key="item.key" @click="handleSelect(item)">
        <el-icon v-if="item.icon"><component :is="resolveIcon(item.icon)" /></el-icon>
        <template #title>{{ item.title }}</template>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<style scoped>
.mic-app-menu {
  border-right: none;
  height: 100%;
}

/* Element Plus 默认 vertical 菜单激活项仅改变文字色，无背景块；
   此处显式补上激活背景，保证点击后高亮可见 */
.mic-app-menu :deep(.el-menu-item.is-active) {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.mic-app-menu :deep(.el-menu-item.is-active:hover) {
  background-color: var(--el-color-primary-light-8);
}
</style>
