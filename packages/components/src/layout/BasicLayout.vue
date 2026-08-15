<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import AppMenu from '../menu/AppMenu.vue'
import LayoutActions from './LayoutActions.vue'
import { type MenuItem, matchMenuKey, stripAppPrefix } from '../menu/config'

const props = withDefaults(
  defineProps<{
    menus: MenuItem[]
    appTitle?: string
    logo?: string
    userInfo?: { id?: string; name: string; avatar?: string }
    mode?: 'host' | 'standalone'
    accounts?: { username: string; name: string; current?: boolean }[]
    /** 隐藏内置 header（操作指引/主题/全屏/用户区由宿主自行渲染） */
    hideHeader?: boolean
  }>(),
  { appTitle: 'MIC Admin', mode: 'host', hideHeader: false },
)

const emit = defineEmits<{
  (e: 'logout'): void
  (e: 'switch-account', username: string): void
}>()

const router = useRouter()
const route = useRoute()

/** 侧边菜单收起状态：false 展开（完整布局），true 收起（仅显示子应用图标） */
const collapsed = ref(false)

const iconComponents = ElementPlusIconsVue as Record<string, any>
function resolveIcon(name?: string) {
  if (!name) return undefined
  return iconComponents[name]
}

const activeMenu = computed(() => matchMenuKey(props.menus, route.fullPath))

/** 收起态：判断当前路由是否落在某顶级菜单项（含其子项）范围内，用于图标高亮 */
function isTopActive(item: MenuItem): boolean {
  const full = route.fullPath
  if (item.path) {
    const cur = stripAppPrefix(full)
    const target = stripAppPrefix(item.path)
    return cur === target || cur.startsWith(target + '/')
  }
  if (item.appKey) return full.startsWith('/' + item.appKey)
  return false
}

/** 收起态点击图标：导航到该顶级项（子应用）对应的首个页面 */
function goTop(item: MenuItem) {
  let target = item.path
  if (!target && item.children?.length) target = item.children[0].path
  if (!target) return
  const to = props.mode === 'standalone' ? stripAppPrefix(target) : target
  if (to !== route.fullPath) router.push(to)
}
</script>

<template>
  <el-container class="basic-layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="basic-layout__aside" :class="{ 'is-collapsed': collapsed }">
      <div class="basic-layout__logo" :class="{ 'is-collapsed': collapsed }">
        <img v-if="logo" :src="logo" alt="logo" class="basic-layout__logo-img" />
        <span v-show="!collapsed" class="basic-layout__logo-text">{{ appTitle }}</span>
        <el-button
          text
          circle
          class="basic-layout__logo-toggle"
          :title="collapsed ? '展开菜单' : '收起菜单'"
          @click="collapsed = !collapsed"
        >
          <el-icon><component :is="resolveIcon(collapsed ? 'Expand' : 'Fold')" /></el-icon>
        </el-button>
      </div>

      <div class="basic-layout__menu">
        <!-- 无子菜单（如首页）：展示空状态占位 -->
        <div v-if="!menus.length" class="basic-layout__menu-empty">
          <span v-show="!collapsed">暂无子菜单</span>
        </div>

        <!-- 展开：完整菜单布局 -->
        <AppMenu v-else-if="!collapsed" :menus="menus" :active-menu="activeMenu" :mode="mode" />

        <!-- 收起：仅展示各子应用图标，悬停提示名称 -->
        <div v-else class="collapse-bar">
          <div
            v-for="item in menus"
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
    </el-aside>

    <el-container>
      <el-header v-if="!hideHeader" class="basic-layout__header">
        <div v-if="appTitle" class="basic-layout__header-title">{{ appTitle }}</div>
        <LayoutActions
          :user-info="userInfo"
          :accounts="accounts"
          :mode="mode"
          :on-before-guide="() => { if (collapsed) collapsed = false }"
          @logout="emit('logout')"
          @switch-account="(u: string) => emit('switch-account', u)"
        />
      </el-header>

      <div v-if="$slots.tabs" class="basic-layout__tabs">
        <slot name="tabs" />
      </div>

      <el-main class="basic-layout__main">
        <slot />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.basic-layout {
  height: 100%;
  min-height: 0;
}
.basic-layout__aside {
  background: var(--mic-aside-bg);
  color: var(--mic-text-inverse);
  display: flex;
  flex-direction: column;
  transition: width 0.28s ease, background-color 0.28s ease;
  overflow: hidden;
}
/* 收起态：菜单背景使用主题色并调至 0.3 亮度（半透明），保持平滑过渡 */
.basic-layout__aside.is-collapsed {
  background: color-mix(in srgb, var(--el-color-primary) 30%, transparent);
}
.basic-layout__logo {
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
.basic-layout__logo.is-collapsed {
  justify-content: center;
  padding: 0;
  background: color-mix(in srgb, var(--el-color-primary) 30%, transparent);
}
.basic-layout__logo-img {
  width: 28px;
  height: 28px;
}
/* 菜单模块折叠按钮：位于标题右侧，与文字垂直居中对齐 */
.basic-layout__logo-toggle {
  margin-left: auto;
  color: var(--mic-text-inverse);
  font-size: 18px;
  transition: background-color 0.15s, color 0.15s;
}
/* 收起态：按钮居中固定显示于顶部，保证始终可见可点击 */
.basic-layout__logo.is-collapsed .basic-layout__logo-toggle {
  margin-left: 0;
}
.basic-layout__logo-toggle:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}
.basic-layout__menu {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.basic-layout__menu-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}
/* 收起态图标栏：竖向居中排列，统一图标尺寸与间距 */
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
.basic-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--mic-header-bg);
  border-bottom: 1px solid var(--mic-border);
  color: var(--mic-text);
}
.basic-layout__tabs {
  background: var(--mic-header-bg);
}
.basic-layout__main {
  background: var(--mic-bg);
  padding: 16px;
}
</style>
