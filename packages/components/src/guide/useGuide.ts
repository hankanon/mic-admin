import { driver } from 'driver.js'
import type { Config, DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import './guide.css'
import { defaultGuideSteps, type GuideStep } from './steps'

/** 高亮色 / 动画等可定制项 */
export interface GuideOptions {
  /** 步骤列表，默认使用 defaultGuideSteps */
  steps?: GuideStep[]
  /** 遮罩（高亮区域外）颜色，默认半透明黑 */
  overlayColor?: string
  /** 高亮区域与圆角元素的间距(px) */
  stagePadding?: number
  /** 高亮区域圆角(px) */
  stageRadius?: number
  /** 是否启用过渡动画 */
  animate?: boolean
  /** 动画时长(ms) */
  duration?: number
  /** 高亮描边颜色（聚焦元素的彩色光环） */
  highlightColor?: string
  /** 完成 / 跳过 / 关闭后触发 */
  onClose?: () => void
}

/**
 * 基于 driver.js 的分步式页面引导。
 * - 多步骤顺序引导，每步聚焦一个 DOM 元素并高亮 + 弹出文字提示框；
 * - 内置「下一步 / 上一步 / 跳过」控制（跳过按钮在 onPopoverRender 中注入为中文标签）；
 * - 完成后（完成或跳过）触发 onClose 回调；
 * - 自适应：driver.js 自动把提示框限制在可视区域内并翻转方向；提示框宽度做了响应式约束；
 * - 支持自定义高亮色、提示框位置（每步 side/align）、动画过渡。
 */
export function useGuide(options: GuideOptions = {}) {
  const {
    steps = defaultGuideSteps,
    overlayColor = 'rgb(0 0 0 / 0.55)',
    stagePadding = 8,
    stageRadius = 8,
    animate = true,
    duration = 300,
    highlightColor = 'var(--el-color-primary)',
    onClose,
  } = options

  /** 将业务步骤映射为 driver.js 步骤 */
  const driveSteps: DriveStep[] = steps.map((s) => {
    const description = s.features?.length
      ? `${s.description}\n\n${s.features.map((f) => `· ${f}`).join('\n')}`
      : s.description
    return {
      element: s.selector,
      popover: {
        title: s.title,
        description,
        side: s.side ?? 'bottom',
        align: s.align ?? 'center',
      },
    }
  })

  const config: Config = {
    steps: driveSteps,
    animate,
    duration,
    overlayColor,
    overlayOpacity: 1, // 透明度由 overlayColor 的 alpha 控制
    stagePadding,
    stageRadius,
    allowClose: true,
    overlayClickBehavior: 'close',
    smoothScroll: true,
    // 元素缺失时不中断引导（如菜单处于收起态），由调用方保证展开
    skipMissingElement: true,
    waitForElement: 300,
    showButtons: ['previous', 'next'],
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    doneBtnText: '完成',
    onPopoverRender: (popover) => {
      // 注入中文「跳过」按钮（driver 默认关闭按钮为 × 图标，这里提供显式标签）
      const footer = popover.footer as HTMLElement
      if (footer.querySelector('[data-guide-skip]')) return
      const skip = document.createElement('button')
      skip.className = 'driver-popover-skip-btn'
      skip.setAttribute('data-guide-skip', '')
      skip.type = 'button'
      skip.textContent = '跳过'
      skip.addEventListener('click', () => instance?.destroy())
      footer.insertBefore(skip, footer.firstChild)
    },
    onDestroyed: () => {
      document.documentElement.style.removeProperty('--mic-guide-highlight')
      document.body.classList.remove('mic-guide-active')
      onClose?.()
    },
  }

  let instance: ReturnType<typeof driver> | null = null

  function start() {
    // 写入高亮色 CSS 变量，供 guide.css 使用
    document.documentElement.style.setProperty('--mic-guide-highlight', highlightColor)
    document.body.classList.add('mic-guide-active')
    if (instance && instance.isActive()) {
      instance.refresh()
      return
    }
    instance = driver(config)
    instance.drive()
  }

  function destroy() {
    instance?.destroy()
    instance = null
  }

  return { start, destroy }
}
