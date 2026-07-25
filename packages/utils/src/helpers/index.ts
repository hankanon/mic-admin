/** 日期格式化：fmt 支持 yyyy-MM-dd HH:mm:ss */
export function formatDate(date: Date | number | string, fmt = 'yyyy-MM-dd HH:mm:ss'): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => `${n}`.padStart(2, '0')
  const map: Record<string, string> = {
    yyyy: `${d.getFullYear()}`,
    MM: pad(d.getMonth() + 1),
    dd: pad(d.getDate()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds()),
  }
  return fmt.replace(/yyyy|MM|dd|HH|mm|ss/g, (k) => map[k])
}

/** 防抖 */
export function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

/** 节流 */
export function throttle<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let last = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - last >= wait) {
      last = now
      fn(...args)
    }
  }
}

/** 扁平树 → 树结构 */
export function listToTree<T extends { id: string | number; parentId: string | number | null }>(
  list: T[],
  rootId: string | number = '',
): T[] {
  const map = new Map<string | number, T[]>()
  list.forEach((item) => {
    const key = item.parentId ?? rootId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  })
  const build = (parentId: string | number): T[] =>
    (map.get(parentId) ?? []).map((item) => ({ ...item, children: build(item.id) }))
  return build(rootId)
}

/** 复制到剪贴板 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** 触发文件下载 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
