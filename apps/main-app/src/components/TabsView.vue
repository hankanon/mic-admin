<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTabsStore } from '../store/tabs'

const router = useRouter()
const tabsStore = useTabsStore()

const scrollContainer = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const tabs = computed(() => tabsStore.tabs)
const activePath = computed(() => tabsStore.activePath)

function updateScrollState() {
  const el = scrollContainer.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 1
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

function scrollByStep(delta: number) {
  scrollContainer.value?.scrollBy({ left: delta, behavior: 'smooth' })
}

/** 当前激活页签滚入可视区，避免溢出时被遮挡 */
function scrollActiveIntoView() {
  const el = scrollContainer.value
  if (!el) return
  const active = el.querySelector('.tab-item.is-active') as HTMLElement | null
  active?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
}

/** 点击页签：切换路由（重复点击当前页不跳转） */
function go(path: string) {
  if (path === router.currentRoute.value.path) return
  router.push(path)
}

/** 关闭按钮：先判断是否需要跳转，再关闭 */
function closeFromButton(path: string) {
  const wasActive = activePath.value === path
  const next = tabsStore.closeTab(path)
  if (wasActive) router.push(next)
}

/** 右键菜单命令：目标页签即右键命中的那个 tab（由模板传入） */
function onCommand(command: string | number | object, path: string) {
  const cmd = String(command)
  const target = path
  if (cmd === 'close-self') {
    if (tabsStore.isAffix(target)) return
    const next = tabsStore.closeTab(target)
    if (target === activePath.value) router.push(next)
  } else if (cmd === 'close-others') {
    tabsStore.closeOthers(target)
    router.push(activePath.value)
  } else if (cmd === 'close-all') {
    tabsStore.closeAll()
    router.push(activePath.value)
  }
}

onMounted(async () => {
  await nextTick()
  updateScrollState()
  scrollActiveIntoView()
  window.addEventListener('resize', updateScrollState)
})
onBeforeUnmount(() => window.removeEventListener('resize', updateScrollState))

// 页签数量 / 激活变化后重新计算滚动态并滚入激活项
watch(
  () => tabs.value.length,
  async () => {
    await nextTick()
    updateScrollState()
    scrollActiveIntoView()
  },
)
watch(activePath, async () => {
  await nextTick()
  scrollActiveIntoView()
})
</script>

<template>
  <div class="tabs-view">
    <span
      v-show="canScrollLeft"
      class="tabs-view__arrow tabs-view__arrow--left"
      title="向左滚动"
      @click="scrollByStep(-200)"
    >‹</span>

    <div ref="scrollContainer" class="tabs-view__scroll" @scroll="updateScrollState">
      <el-dropdown
        v-for="tab in tabs"
        :key="tab.path"
        trigger="contextmenu"
        placement="bottom-start"
        class="tab-item-dropdown"
        @command="(c) => onCommand(c, tab.path)"
      >
        <div
          class="tab-item"
          :class="{ 'is-active': tab.path === activePath }"
          :title="tab.title"
          @click="go(tab.path)"
        >
          <span class="tab-item__title">{{ tab.title }}</span>
          <span
            v-if="!tab.affix"
            class="tab-item__close"
            title="关闭"
            @click.stop="closeFromButton(tab.path)"
          >×</span>
        </div>

        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              command="close-self"
              :disabled="tabsStore.isAffix(tab.path)"
            >关闭自己</el-dropdown-item>
            <el-dropdown-item command="close-others">关闭其他</el-dropdown-item>
            <el-dropdown-item command="close-all">关闭全部</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <span
      v-show="canScrollRight"
      class="tabs-view__arrow tabs-view__arrow--right"
      title="向右滚动"
      @click="scrollByStep(200)"
    >›</span>
  </div>
</template>

<style scoped>
.tabs-view {
  display: flex;
  align-items: center;
  height: 40px;
  background: var(--mic-header-bg);
  border-bottom: 1px solid var(--mic-border);
  padding: 0 2px;
  position: relative;
}
/* 每个 tab 作为独立的 dropdown 触发元素，保持水平排列且不拉伸 */
.tab-item-dropdown {
  display: inline-flex;
  flex: none;
  margin-right: 6px;
}
.tabs-view__scroll {
  display: flex;
  align-items: center;
  height: 40px;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  scrollbar-width: none;
}
.tabs-view__scroll::-webkit-scrollbar {
  display: none;
}
.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 13px;
  cursor: pointer;
  flex: none;
  user-select: none;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.tab-item:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.tab-item.is-active {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}
.tab-item__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
}
.tab-item__close:hover {
  background: var(--el-fill-color-dark, rgba(0, 0, 0, 0.18));
  color: #fff;
}
.tabs-view__arrow {
  flex: none;
  width: 24px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  font-size: 18px;
  background: var(--mic-header-bg);
}
.tabs-view__arrow:hover {
  color: var(--el-color-primary);
}
.tabs-view__arrow--left {
  border-right: 1px solid var(--mic-border);
}
.tabs-view__arrow--right {
  border-left: 1px solid var(--mic-border);
}
</style>
