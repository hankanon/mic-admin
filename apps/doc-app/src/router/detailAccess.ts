/**
 * 文章详情页的严格访问控制。
 *
 * 详情页只允许通过「文档列表 → 详情」按钮进入，禁止通过菜单、页签或直接输入 URL 访问。
 * 实现方式：列表点击「详情」时写入一次性的 sessionStorage 令牌（携带目标 id）；
 * 路由守卫在离开时校验：令牌匹配 或 直接来自文档列表路由，否则重定向到列表页。
 * sessionStorage 在同源 SPA 内跨路由保留、刷新即失效，天然实现「仅本此跳转有效」。
 */
const DETAIL_ACCESS_KEY = 'mic_doc_detail_access'

/** 列表点击「详情」时调用：授予一次性访问令牌 */
export function grantDetailAccess(id: number): void {
  try {
    sessionStorage.setItem(DETAIL_ACCESS_KEY, String(id))
  } catch {
    /* sessionStorage 不可用时降级为纯 from 校验 */
  }
}

/**
 * 校验是否允许进入详情页。会消费（清除）令牌，保证刷新或二次进入被拦截。
 * @returns true 允许进入；false 非法直接进入
 */
export function verifyDetailAccess(id: number, fromName: string | undefined | null): boolean {
  let tokenOk = false
  try {
    const token = sessionStorage.getItem(DETAIL_ACCESS_KEY)
    tokenOk = token === String(id)
    sessionStorage.removeItem(DETAIL_ACCESS_KEY)
  } catch {
    /* 忽略 */
  }
  // 允许：持有本次跳转令牌，或直接由文档列表路由进入
  return tokenOk || fromName === 'doc-list'
}
