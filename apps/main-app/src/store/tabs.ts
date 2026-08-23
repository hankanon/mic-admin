import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TabItem {
  /** 唯一标识，等于对应菜单项的 path（不含 query），用于重复校验与路由跳转 */
  path: string
  title: string
  key: string
  /** 常驻页签（如首页）不可被关闭 */
  affix?: boolean
}

const HOME_TAB: TabItem = { path: '/', title: '首页大盘', key: 'dashboard-overview', affix: true }

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<TabItem[]>([{ ...HOME_TAB }])
  const activePath = ref<string>('/')

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

  function isAffix(path: string): boolean {
    return tabs.value.find((t) => t.path === path)?.affix === true
  }

  /** 关闭指定页签；返回关闭后应当激活的 path（用于组件决定是否跳转） */
  function closeTab(path: string): string {
    const idx = tabs.value.findIndex((t) => t.path === path)
    if (idx === -1) return activePath.value
    if (tabs.value[idx].affix) return activePath.value // 常驻不可关
    const wasActive = activePath.value === path
    tabs.value.splice(idx, 1)
    if (wasActive) {
      // 优先右侧相邻，否则左侧相邻，最后回退首页
      const next = tabs.value[idx] ?? tabs.value[idx - 1]
      activePath.value = next ? next.path : HOME_TAB.path
    }
    return activePath.value
  }

  /** 关闭其他：保留常驻首页 + 指定页签；若当前激活不在保留集则切到指定页签 */
  function closeOthers(path: string) {
    tabs.value = tabs.value.filter((t) => t.affix || t.path === path)
    if (!tabs.value.some((t) => t.path === activePath.value)) {
      activePath.value = path
    }
  }

  /** 关闭全部：仅保留常驻首页 */
  function closeAll() {
    tabs.value = tabs.value.filter((t) => t.affix)
    activePath.value = HOME_TAB.path
  }

  /** 重置为仅首页（登出 / 切换角色时清理越权页签） */
  function reset() {
    tabs.value = [{ ...HOME_TAB }]
    activePath.value = HOME_TAB.path
  }

  return {
    tabs,
    activePath,
    addTab,
    setActive,
    isAffix,
    closeTab,
    closeOthers,
    closeAll,
    reset,
  }
})
