import mitt from 'mitt'
import { isMicroEnv } from './env'

type Events = {
  'mic:global': Record<string, any>
}

const localBus = mitt<Events>()

/**
 * 获取主应用下发的全局数据。
 * 集成运行：来自 microApp.getData()；独立运行：返回 null。
 */
export function getGlobalData<T = any>(): T | null {
  if (isMicroEnv()) {
    return (window as any).microApp?.getData?.() ?? null
  }
  return null
}

/**
 * 子 → 主 通信。
 * 集成运行：microApp.dispatch；独立运行：降级为自定义事件总线。
 */
export function emitToMain(payload: Record<string, any>): void {
  if (isMicroEnv()) {
    ;(window as any).microApp?.dispatch?.(payload)
  } else {
    window.dispatchEvent(new CustomEvent('mic:global', { detail: payload }))
    localBus.emit('mic:global', payload)
  }
}

/**
 * 监听通信事件（主应用监听子应用 dispatch，或独立运行降级监听）。
 * 返回取消监听函数。
 */
export function onMicroMessage(handler: (payload: Record<string, any>) => void): () => void {
  if (isMicroEnv()) {
    const cb = (data: Record<string, any>) => handler(data)
    ;(window as any).microApp?.addDataListener?.(cb)
    return () => (window as any).microApp?.removeDataListener?.(cb)
  }
  const listener = (e: Event) => handler((e as CustomEvent).detail)
  window.addEventListener('mic:global', listener)
  localBus.on('mic:global', handler)
  return () => {
    window.removeEventListener('mic:global', listener)
    localBus.off('mic:global', handler)
  }
}

/**
 * 子应用监听主应用下发的全局数据（setGlobalData）变化。
 * 集成运行：microApp.addDataListener；独立运行：返回 noop。
 * 返回取消监听函数。
 */
export function onGlobalData(handler: (data: Record<string, any>) => void): () => void {
  if (isMicroEnv()) {
    const cb = (data: Record<string, any>) => handler(data)
    ;(window as any).microApp?.addDataListener?.(cb)
    return () => (window as any).microApp?.removeDataListener?.(cb)
  }
  return () => {}
}

export { localBus }
