const PREFIX = 'mic_admin_'

export interface StorageOptions {
  /** 过期时间（毫秒） */
  expires?: number
}

function buildKey(key: string): string {
  return PREFIX + key
}

/** 写入带前缀与过期时间的 localStorage */
export function setStorage<T = unknown>(key: string, value: T, options?: StorageOptions): void {
  const item = {
    value,
    expireAt: options?.expires ? Date.now() + options.expires : undefined,
  }
  window.localStorage.setItem(buildKey(key), JSON.stringify(item))
}

/** 读取带过期校验的 localStorage，过期自动清理并返回 null */
export function getStorage<T = unknown>(key: string): T | null {
  const raw = window.localStorage.getItem(buildKey(key))
  if (!raw) return null
  try {
    const item = JSON.parse(raw) as { value: T; expireAt?: number }
    if (item.expireAt && item.expireAt < Date.now()) {
      removeStorage(key)
      return null
    }
    return item.value
  } catch {
    return null
  }
}

export function removeStorage(key: string): void {
  window.localStorage.removeItem(buildKey(key))
}

/** 清空本应用（前缀）下的所有 storage */
export function clearStorage(): void {
  const keys: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k && k.startsWith(PREFIX)) keys.push(k)
  }
  keys.forEach((k) => window.localStorage.removeItem(k))
}

export const storage = {
  set: setStorage,
  get: getStorage,
  remove: removeStorage,
  clear: clearStorage,
}
