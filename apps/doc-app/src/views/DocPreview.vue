<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { ElMessage, type UploadFile, type UploadRawFile } from 'element-plus'
import { PageCard, Breadcrumb } from '@mic/components'
import VuePdfEmbed from 'vue-pdf-embed'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// 显式指定 pdf.js worker，避免跨域/打包路径问题（pdfjs-dist@6 使用 .mjs worker）
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

defineOptions({ name: 'DocPreview' })

const MAX_SIZE = 100 * 1024 * 1024 // 100MB 上限，保障大文件也能稳定预览
const LOAD_TIMEOUT = 30_000 // 解析超时兜底，避免一直无反应

const file = ref<File | null>(null)
const fileName = ref('')
const fileSize = ref(0)
const source = ref<ArrayBuffer | null>(null) // vue-pdf-embed 直接消费 ArrayBuffer，最稳
const objectUrl = ref('')

const pageCount = ref(0)
const page = ref(1)
const scale = ref(1) // 显示倍率 0.4~3
const BASE_WIDTH = 900 // 100% 倍率下的基础渲染宽度(px)
const loading = ref(false)
const loadError = ref(false)
const errorMessage = ref('')
// 实际渲染宽度：vue-pdf-embed 通过 width(px) 控制显示尺寸，scale 仅提升清晰度
const displayWidth = computed(() => Math.round(BASE_WIDTH * scale.value))
// 清晰度倍率随缩放略增，保证放大后不模糊（值过大会拖慢大文件渲染）
const renderScale = computed(() => Math.min(2, Math.max(1, scale.value)))
let loadTimer: ReturnType<typeof setTimeout> | null = null

const hasFile = computed(() => source.value !== null)

// 让 PageCard body 占满父级高度，预览区内部再独立滚动
const cardBodyStyle = {
  flex: '1',
  'min-height': '0',
  display: 'flex',
  'flex-direction': 'column',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function resetState() {
  if (loadTimer) {
    clearTimeout(loadTimer)
    loadTimer = null
  }
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = ''
  }
  source.value = null
  file.value = null
  fileName.value = ''
  fileSize.value = 0
  pageCount.value = 0
  page.value = 1
  scale.value = 1
  loadError.value = false
  errorMessage.value = ''
}

// 内置最小合法示例 PDF（两页文本），用于快速验证预览功能，无需外部文件
// 标准 base64（仅含 A-Za-z0-9+/=），atob 可正确解码
const SAMPLE_PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUiA1IDAgUl0gL0NvdW50IDIgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvQ29udGVudHMgNiAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNTk1IDg0Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNCAwIFIgPj4gPj4gL0NvbnRlbnRzIDcgMCBSID4+CmVuZG9iago2IDAgb2JqCjw8IC9MZW5ndGggNjYgPj4Kc3RyZWFtCkJUIC9GMSAyNCBUZiA3MiA3NjAgVGQgKG1pYy1hZG1pbiBQREYgUHJldmlldyBEZW1vIC0gUGFnZSAxKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjcgMCBvYmoKPDwgL0xlbmd0aCA2NiA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDcyIDc2MCBUZCAobWljLWFkbWluIFBERiBQcmV2aWV3IERlbW8gLSBQYWdlIDIpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDgKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDEyMSAwMDAwMCBuIAowMDAwMDAwMjQ3IDAwMDAwIG4gCjAwMDAwMDAzMTcgMDAwMDAgbiAKMDAwMDAwMDQ0MyAwMDAwMCBuIAowMDAwMDAwNTU5IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgOCAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNjc1CiUlRU9G'

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const len = bin.length
  const buf = new ArrayBuffer(len)
  const view = new Uint8Array(buf)
  for (let i = 0; i < len; i++) view[i] = bin.charCodeAt(i)
  return buf
}

function loadSample() {
  loading.value = true
  loadError.value = false
  errorMessage.value = ''
  try {
    resetState()
    fileName.value = '示例文档.pdf'
    fileSize.value = Math.round((SAMPLE_PDF_BASE64.length * 3) / 4)
    source.value = base64ToArrayBuffer(SAMPLE_PDF_BASE64)
  } catch {
    loadError.value = true
    errorMessage.value = '示例文档加载失败'
    ElMessage.error('示例文档加载失败')
  } finally {
    loading.value = false
  }
}

// before-upload 仅做类型/大小校验；文件真正被接受后由 on-change 触发读取，
// 这样无论 auto-upload 是否开启都能稳定触发解析（避免 return false 中断流程导致无反应）
function beforeUpload(raw: UploadRawFile) {
  if (raw.type && raw.type !== 'application/pdf') {
    ElMessage.error('仅支持 PDF 格式文档')
    return false
  }
  if (raw.size > MAX_SIZE) {
    ElMessage.error(`文件过大，单文件上限 ${formatSize(MAX_SIZE)}`)
    return false
  }
  return true
}

function onChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw
  if (!raw) return
  readFile(raw as unknown as UploadRawFile)
}

function readFile(raw: UploadRawFile) {
  loading.value = true
  loadError.value = false
  errorMessage.value = ''
  // 解析超时兜底：若 pdf.js 在限定时间内未回 @loaded/@loading-failed，给出明确提示
  if (loadTimer) clearTimeout(loadTimer)
  loadTimer = setTimeout(() => {
    if (loading.value && !loadError.value) {
      loading.value = false
      loadError.value = true
      errorMessage.value = 'PDF 解析超时，请确认文件完整后重试'
      ElMessage.error('PDF 解析超时')
    }
  }, LOAD_TIMEOUT)
  const reader = new FileReader()
  reader.onload = () => {
    resetState()
    file.value = raw as unknown as File
    fileName.value = raw.name
    fileSize.value = raw.size
    source.value = reader.result as ArrayBuffer
    loading.value = false
  }
  reader.onerror = () => {
    if (loadTimer) clearTimeout(loadTimer)
    loading.value = false
    loadError.value = true
    errorMessage.value = '文件读取失败，请重试'
    ElMessage.error('文件读取失败')
  }
  reader.readAsArrayBuffer(raw)
}

function onLoaded(doc: { numPages: number }) {
  if (loadTimer) clearTimeout(loadTimer)
  pageCount.value = doc.numPages
  page.value = 1
  loadError.value = false
  loading.value = false
}

function onExceed() {
  ElMessage.warning('请先移除当前文档，再选择新的 PDF')
}

function onLoadFailed() {
  loadError.value = true
  errorMessage.value = 'PDF 解析失败，请确认文件未损坏或受密码保护'
  ElMessage.error('PDF 解析失败')
}

function prevPage() {
  if (page.value > 1) page.value--
}

function nextPage() {
  if (page.value < pageCount.value) page.value++
}

function onPageInput(val: number | undefined) {
  if (!val) return
  const v = Math.min(Math.max(1, Math.floor(val)), pageCount.value || 1)
  page.value = v
}

function zoomIn() {
  if (scale.value < 3) scale.value = Math.round((scale.value + 0.1) * 10) / 10
}

function zoomOut() {
  if (scale.value > 0.4) scale.value = Math.round((scale.value - 0.1) * 10) / 10
}

function reChoose() {
  resetState()
}

function download() {
  if (!file.value) return
  if (!objectUrl.value) {
    objectUrl.value = URL.createObjectURL(file.value)
  }
  const a = document.createElement('a')
  a.href = objectUrl.value
  a.download = fileName.value || 'document.pdf'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

onBeforeUnmount(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
})

// 供 el-upload 拖拽区使用
</script>

<template>
  <div class="doc-preview">
    <Breadcrumb />

    <PageCard title="文档预览" subtitle="上传 PDF 文档，在线预览、翻页与缩放" :body-style="cardBodyStyle">
      <template #extra>
        <el-button
          v-if="hasFile"
          :disabled="loading"
          @click="reChoose"
        >
          重新选择
        </el-button>
        <el-button
          v-if="hasFile"
          type="primary"
          :disabled="loading"
          @click="download"
        >
          下载
        </el-button>
      </template>

      <!-- 未选文件：上传区 -->
      <div v-if="!hasFile" class="doc-preview__upload">
        <el-upload
          drag
          :auto-upload="false"
          :show-file-list="false"
          accept="application/pdf,.pdf"
          :limit="1"
          :on-exceed="onExceed"
          :before-upload="beforeUpload"
          :on-change="onChange"
        >
          <el-icon class="el-icon--upload"><i class="upload-icon">📄</i></el-icon>
          <div class="el-upload__text">
            将 PDF 文件拖到此处，或<em>点击选择</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              仅支持 PDF 格式，单文件不超过 {{ formatSize(MAX_SIZE) }}
            </div>
          </template>
        </el-upload>
        <div class="doc-preview__sample">
          <span>没有文件？可先加载内置示例快速体验</span>
          <el-button type="primary" link :disabled="loading" @click="loadSample">
            加载示例文档
          </el-button>
        </div>
      </div>

      <!-- 已选文件：工具栏 + 预览 -->
      <div v-else class="doc-preview__viewer">
        <div class="doc-preview__meta">
          <span class="doc-preview__name" :title="fileName">{{ fileName }}</span>
          <span class="doc-preview__size">{{ formatSize(fileSize) }}</span>
        </div>

        <div class="doc-preview__toolbar">
          <el-button-group>
            <el-button :disabled="page <= 1" @click="prevPage">上一页</el-button>
            <el-button :disabled="page >= pageCount" @click="nextPage">下一页</el-button>
          </el-button-group>
          <span class="doc-preview__page">
            <el-input
              :model-value="page"
              size="small"
              class="doc-preview__page-input"
              @update:model-value="onPageInput"
            />
            <span class="doc-preview__page-total">/ {{ pageCount || 1 }}</span>
          </span>
          <el-divider direction="vertical" />
          <el-button-group>
            <el-button :disabled="scale <= 0.4" @click="zoomOut">缩小</el-button>
            <el-button :disabled="scale >= 3" @click="zoomIn">放大</el-button>
          </el-button-group>
          <span class="doc-preview__scale">{{ Math.round(scale * 100) }}%</span>
        </div>

        <div v-loading="loading" class="doc-preview__canvas">
          <el-alert
            v-if="loadError"
            type="error"
            :title="errorMessage"
            show-icon
            :closable="false"
            style="margin-bottom: 12px"
          />
          <VuePdfEmbed
            v-if="source && !loadError"
            :source="source"
            :page="page"
            :width="displayWidth"
            :scale="renderScale"
            @loaded="onLoaded"
            @loading-failed="onLoadFailed"
          />
        </div>
      </div>
    </PageCard>
  </div>
</template>

<style scoped>
.doc-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

/* 让 PageCard 根 el-card 占满父级高度，body 才能 flex 撑开（高度链条贯通） */
.doc-preview :deep(.page-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}

.doc-preview__upload {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.doc-preview__upload :deep(.el-upload-dragger) {
  padding: 40px;
}

.upload-icon {
  font-size: 48px;
  font-style: normal;
  line-height: 1;
}

.doc-preview__sample {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.doc-preview__viewer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.doc-preview__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.doc-preview__name {
  font-weight: 600;
  color: var(--el-text-color-primary);
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-preview__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  position: sticky;
  top: 0;
  z-index: 10;
}

.doc-preview__page {
  display: flex;
  align-items: center;
  gap: 6px;
}

.doc-preview__page-input {
  width: 64px;
}

.doc-preview__page-total {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.doc-preview__scale {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  min-width: 44px;
}

.doc-preview__canvas {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  justify-content: center;
  padding: 12px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

@media (max-width: 576px) {
  .doc-preview__toolbar {
    gap: 8px;
    padding: 8px;
  }
  .doc-preview__page-input {
    width: 52px;
  }
}
</style>
