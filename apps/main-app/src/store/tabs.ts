import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TabItem {
  /** 唯一标识，等于对应菜单项的 path（不含 query），用于重复校验与路由跳转 */
  path: string
  title: string
  key: string
}

/**
 * 页签（Tab）状态（基座级）。
 *
 * 页签完全由「菜单树 + 当前路由」驱动（见 MainLayout 的 syncTabs）：
 * 仅当访问到当前角色菜单树中的叶子页面时才生成对应页签；
 * 不存在硬编码的常驻/兜底页签，关闭后不自动恢复。
 */
export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<TabItem[]>([])
  const activePath = ref<string>('')

  /** 新增页签；按 path 去重，已存在则仅置为当前激活 */
  function addTab(item: TabItem) {
    if (!item?.path) return
    const exists = tabs.value.find((t) => t.path === item.path)
    if (!exists) tabs.value.push({ ...item })
    activePath.value = item.path
  }

  /** 仅设置当前激活（path 必须存在于页签列表） */
  function setActive(path: string) {
    if (tabs.value.some((t) => t.path === path)) activePath.value = path
  }

  /**
   * 关闭指定页签；返回关闭后应当激活的 path（供调用方决定跳转）。
   * 关闭的是激活页签时优先切到右侧相邻、其次左侧相邻；
   * 一个不剩时返回空串 —— 无默认跳转目标，由调用方保持当前页面不动。
   */
  function closeTab(path: string): string {
    const idx = tabs.value.findIndex((t) => t.path === path)
    if (idx === -1) return activePath.value
    const wasActive = activePath.value === path
    tabs.value.splice(idx, 1)
    if (wasActive) {
      const next = tabs.value[idx] ?? tabs.value[idx - 1]
      activePath.value = next ? next.path : ''
    }
    return activePath.value
  }

  /** 关闭其他：仅保留指定页签；若当前激活不在保留集则切到指定页签 */
  function closeOthers(path: string) {
    tabs.value = tabs.value.filter((t) => t.path === path)
    if (!tabs.value.some((t) => t.path === activePath.value)) {
      activePath.value = path
    }
  }

  /** 关闭全部：清空页签（无兜底跳转，当前页面保持不变） */
  function closeAll() {
    tabs.value = []
    activePath.value = ''
  }

  /** 重置清空（登出 / 切换角色时清理越权页签，随后由路由变化重建） */
  function reset() {
    tabs.value = []
    activePath.value = ''
  }

  return {
    tabs,
    activePath,
    addTab,
    setActive,
    closeTab,
    closeOthers,
    closeAll,
    reset,
  }
})
