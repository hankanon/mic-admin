import { defineStore } from 'pinia'
import { ref } from 'vue'

export type DocStatus = 'draft' | 'published' | 'archived'

export interface DocItem {
  id: number
  title: string
  category: string
  author: string
  status: DocStatus
  content: string
  /** 主题配图：本地上传的 base64 dataURL 或远程图片 URL，为空表示未配置 */
  cover: string
  updatedAt: string
}

/** 文档可选分类 */
export const DOC_CATEGORIES = ['产品文档', '技术文档', '运营文档', '其他']

/** 未配置主题配图时显示的默认占位图（内联 SVG，避免外链依赖） */
export const DOC_DEFAULT_COVER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
      <rect width="320" height="180" fill="#f0f2f5"/>
      <g fill="none" stroke="#c0c4cc" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="110" y="58" width="100" height="74" rx="6"/>
        <circle cx="138" cy="86" r="10"/>
        <path d="M118 126 L150 96 L172 116 L188 100 L202 126"/>
      </g>
      <text x="160" y="156" font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="#909399" text-anchor="middle">暂无主题配图</text>
    </svg>`,
  )

interface DocDraft {
  id?: number
  title: string
  category: string
  content: string
  cover?: string
  status?: DocStatus
  author?: string
}

function now(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const SEED: DocItem[] = [
  {
    id: 1,
    title: '快速开始指南',
    category: '产品文档',
    author: '超级管理员',
    status: 'published',
    content:
      '# 快速开始\n\n欢迎使用 **文档管理** 平台。\n\n- 支持 *Markdown* 编辑\n- 支持实时预览\n- 支持分类管理\n',
    cover: '',
    updatedAt: now(),
  },
  {
    id: 2,
    title: 'API 接入说明',
    category: '技术文档',
    author: '文档发布员',
    status: 'draft',
    content: '## API 接入\n\n请参考下方示例代码：\n\n```ts\nfetch("/api/docs")\n```\n',
    cover: '',
    updatedAt: now(),
  },
]

export const useDocStore = defineStore('doc', () => {
  const docs = ref<DocItem[]>(SEED.map((d) => ({ ...d })))
  let seq = docs.value.reduce((m, d) => Math.max(m, d.id), 0)

  function getById(id: number): DocItem | undefined {
    return docs.value.find((d) => d.id === id)
  }

  function save(draft: DocDraft): DocItem {
    const ts = now()
    if (draft.id) {
      const item = docs.value.find((d) => d.id === draft.id)
      if (item) {
        item.title = draft.title
        item.category = draft.category
        item.content = draft.content
        item.cover = draft.cover ?? ''
        if (draft.status) item.status = draft.status
        item.updatedAt = ts
        return item
      }
    }
    const created: DocItem = {
      id: ++seq,
      title: draft.title,
      category: draft.category,
      author: draft.author || '未知',
      status: draft.status || 'draft',
      content: draft.content,
      cover: draft.cover ?? '',
      updatedAt: ts,
    }
    docs.value.unshift(created)
    return created
  }

  function remove(id: number) {
    const i = docs.value.findIndex((d) => d.id === id)
    if (i >= 0) docs.value.splice(i, 1)
  }

  function updateStatus(id: number, status: DocStatus) {
    const item = docs.value.find((d) => d.id === id)
    if (item) {
      item.status = status
      item.updatedAt = now()
    }
  }

  return { docs, getById, save, remove, updateStatus }
})
