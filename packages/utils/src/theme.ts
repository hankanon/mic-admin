import { ref } from 'vue'
import { getStorage, setStorage } from './storage'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const DARK_CLASS = 'dark'

/** 模块级单例：当前主题，跨组件共享（同一文档内） */
const currentTheme = ref<ThemeMode>('light')

/** 读取操作系统色彩偏好 */
function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 将主题类（<html> 的 dark 类）应用到当前文档，不改变响应式状态 */
function applyThemeClass(mode: ThemeMode) {
  const html = document.documentElement
  if (mode === 'dark') html.classList.add(DARK_CLASS)
  else html.classList.remove(DARK_CLASS)
}

/** 将主题应用到当前文档：切换 <html> 的 dark 类并同步响应式状态 */
function applyTheme(mode: ThemeMode) {
  applyThemeClass(mode)
  currentTheme.value = mode
}

/** 用户是否手动保存过偏好（localStorage 有值） */
function hasSavedChoice(): boolean {
  return getStorage<ThemeMode>(STORAGE_KEY) !== null
}

/** 主题切换时水波纹遮罩使用的目标背景色（取页面主背景 --mic-bg 的明暗对应值） */
const RIPPLE_BG: Record<ThemeMode, string> = {
  light: '#f0f2f5',
  dark: '#141414',
}

/** 动画进行中标记：避免连续点击叠加多个遮罩/过渡 */
let rippleBusy = false

/** 是否支持 View Transitions API（Chrome/Edge/Safari 18+ 等现代浏览器） */
function supportsViewTransition(): boolean {
  return typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition === 'function'
}

/**
 * 以鼠标点击位置为圆心，水波纹扩散切换主题：
 * - 支持 View Transitions API：直接对真实「旧/新页面」做 clip-path 圆形揭示，
 *   无缝且性能最佳（由浏览器合成层处理）。动画结束清除注入的临时样式。
 * - 不支持（如部分 Firefox）：回退到 transform: scale 圆形遮罩，
 *   完全覆盖后再提交真实主题并移除临时节点。
 */
function runRipple(next: ThemeMode, x: number, y: number) {
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // 路径一：View Transitions —— 真实页面圆形揭示，无缝
  if (supportsViewTransition() && !reduceMotion) {
    const w = window.innerWidth
    const h = window.innerHeight
    const maxRadius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y))
    rippleBusy = true

    const styleId = 'mic-vt-ripple-style'
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = `
      ::view-transition-old(root) { animation: none; mix-blend-mode: normal; }
      ::view-transition-new(root) {
        animation: mic-ripple-reveal 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
        clip-path: circle(0px at ${x}px ${y}px);
      }
      @keyframes mic-ripple-reveal {
        to { clip-path: circle(${maxRadius}px at ${x}px ${y}px); }
      }
    `

    const vt = (document as unknown as {
      startViewTransition: (cb: () => void) => { finished?: Promise<void> }
    }).startViewTransition(() => {
      applyTheme(next)
      setStorage(STORAGE_KEY, next)
    })

    const done = () => {
      styleEl?.remove()
      rippleBusy = false
    }
    if (vt?.finished && typeof vt.finished.finally === 'function') {
      vt.finished.finally(done)
    } else {
      done()
    }
    return
  }

  // 路径二：回退 —— scale 圆形遮罩覆盖后提交主题
  const html = document.documentElement
  const w = window.innerWidth
  const hgt = window.innerHeight
  // 到四个角的最大距离，保证圆形完全覆盖整个视口
  const radius = Math.hypot(Math.max(x, w - x), Math.max(y, hgt - y))

  const ripple = document.createElement('div')
  ripple.setAttribute('aria-hidden', 'true')
  Object.assign(ripple.style, {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    width: `${radius * 2}px`,
    height: `${radius * 2}px`,
    marginLeft: `${-radius}px`,
    marginTop: `${-radius}px`,
    borderRadius: '50%',
    background: RIPPLE_BG[next],
    transform: 'scale(0)',
    zIndex: '99999',
    pointerEvents: 'none',
    willChange: 'transform',
  } as Partial<CSSStyleDeclaration>)

  // 临时禁用全局色彩过渡，避免提交主题时页面自身再闪一下
  const NO_TRANS = 'mic-no-theme-transition'
  html.classList.add(NO_TRANS)

  document.body.appendChild(ripple)
  rippleBusy = true

  const cleanup = () => {
    applyTheme(next) // 整页在遮罩下切换为真实新主题
    setStorage(STORAGE_KEY, next)
    // 下一帧移除遮罩并恢复过渡，避免暴露提交瞬间的差异
    requestAnimationFrame(() => {
      ripple.remove()
      html.classList.remove(NO_TRANS)
      rippleBusy = false
    })
  }

  if (reduceMotion || typeof ripple.animate !== 'function') {
    ripple.style.transform = 'scale(1)'
    cleanup()
    return
  }

  const anim = ripple.animate(
    [{ transform: 'scale(0)' }, { transform: 'scale(1)' }],
    { duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  )
  anim.onfinish = cleanup
  anim.oncancel = cleanup
}

/**
 * 初始化主题：localStorage 优先；未手动选择则跟随系统色彩偏好。
 * 仅在应用启动早期调用（在渲染前），避免首屏闪烁；此处不主动持久化。
 */
export function initTheme() {
  const saved = getStorage<ThemeMode>(STORAGE_KEY)
  const mode: ThemeMode = saved ?? (systemPrefersDark() ? 'dark' : 'light')
  applyTheme(mode)
}

/**
 * 切换主题并持久化用户选择（返回切换后的模式）。
 * 若传入点击事件，则以点击位置为圆心播放水波纹扩散过渡；
 * 否则（无坐标 / 动画占线 / 不支持）直接切换。
 */
export function toggleTheme(event?: MouseEvent): ThemeMode {
  const next: ThemeMode = currentTheme.value === 'dark' ? 'light' : 'dark'
  if (event && !rippleBusy && typeof document !== 'undefined' && document.body) {
    runRipple(next, event.clientX, event.clientY)
  } else {
    applyTheme(next)
    setStorage(STORAGE_KEY, next)
  }
  return next
}

/** 显式设定主题并持久化（用于子应用接收主应用下发的主题） */
export function setTheme(mode: ThemeMode) {
  applyTheme(mode)
  setStorage(STORAGE_KEY, mode)
}

/** 组合式 API：返回共享的主题状态与操作方法 */
export function useTheme() {
  return {
    currentTheme,
    initTheme,
    toggleTheme,
    setTheme,
    hasSavedChoice,
    systemPrefersDark,
  }
}
