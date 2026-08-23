import mitt from 'mitt'
import { isMicroEnv } from './env'
import { APP_BASEROUTES, MicroMsgType, type AppKey } from '../constants'

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

/** 跳转请求自增计数：确保每次 dispatch 的数据唯一 */
let navigateSeq = 0

/**
 * 跨子应用跳转（公共方法，供各子应用使用）。
 *
 * @param appKey 目标子应用 key（dashboard / doc / profile / qa / sys）
 * @param path   目标应用内的路由路径（如 '/list'，不含 baseroute 前缀）
 *
 * 集成运行：向基座 dispatch Navigate 消息，基座切换到对应完整路由（baseroute + path）。
 * 独立运行：无法跨应用跳转（单应用环境），仅打印警告，调用方需自行降级处理。
 *
 * 注意：micro-app 的 datachange 仅在数据变化时触发，重复 dispatch 相同数据不会再次触发。
 * 因此每次请求附加自增 seq 保证数据唯一，确保「跳转→返回→再次跳转」能重复触发。
 */
export function navigateToApp(appKey: AppKey, path: string): void {
  const subPath = path.startsWith('/') ? path : `/${path}`
  if (isMicroEnv()) {
    emitToMain({ type: MicroMsgType.Navigate, appKey, path: subPath, seq: ++navigateSeq })
  } else {
    // 独立运行时无基座，无法跨应用跳转；给出提示便于调试
    console.warn(
      `[navigateToApp] 独立运行环境不支持跨应用跳转：${appKey} ${subPath}（baseroute ${APP_BASEROUTES[appKey]}）`,
    )
  }
}

/** 计算目标应用在基座的完整路由路径（baseroute + 子路径），供基座或需要完整路径的场景使用 */
export function resolveAppRoute(appKey: AppKey, path: string): string {
  const base = APP_BASEROUTES[appKey]
  const sub = path.startsWith('/') ? path : `/${path}`
  return sub === '/' ? base : `${base}${sub}`
}
