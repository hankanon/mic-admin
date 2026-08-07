<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { DOC_DEFAULT_COVER } from '../store/doc'

const props = withDefaults(
  defineProps<{
    modelValue: string
    /** 单张图片最大体积（字节），默认 2MB */
    maxSize?: number
    width?: string
    height?: string
  }>(),
  { maxSize: 2 * 1024 * 1024, width: '160px', height: '100px' },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'error', msg: string): void
}>()

const ACCEPT = 'image/jpeg,image/png'
const previewSrc = computed(() => props.modelValue || DOC_DEFAULT_COVER)

function beforeUpload(rawFile: File): boolean {
  if (!ACCEPT.split(',').includes(rawFile.type)) {
    ElMessage.error('仅支持 JPG / PNG 格式的图片')
    emit('error', '格式不支持')
    return false
  }
  if (rawFile.size > props.maxSize) {
    ElMessage.error(`图片大小不能超过 ${Math.round(props.maxSize / 1024 / 1024)}MB`)
    emit('error', '超出大小限制')
    return false
  }
  const reader = new FileReader()
  reader.onload = () => emit('update:modelValue', reader.result as string)
  reader.onerror = () => ElMessage.error('图片读取失败')
  reader.readAsDataURL(rawFile)
  return false // 阻止 el-upload 自动上传
}

function onUrlInput(value: string) {
  emit('update:modelValue', value.trim())
}

function onRemove() {
  emit('update:modelValue', '')
}

const inputStyle = computed(() => ({ width: props.width, height: props.height }))
</script>

<template>
  <div class="cover-upload">
    <div class="cover-upload__preview" :style="inputStyle">
      <img :src="previewSrc" alt="主题配图" class="cover-upload__img" />
      <div v-if="modelValue" class="cover-upload__mask">
        <el-button
          text
          bg
          size="small"
          type="danger"
          @click.stop="onRemove"
        >移除</el-button>
      </div>
    </div>

    <div class="cover-upload__side">
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        accept=".jpg,.jpeg,.png"
        :before-upload="beforeUpload as any"
      >
        <el-button type="primary" plain>上传图片</el-button>
      </el-upload>

      <div class="cover-upload__url">
        <span class="cover-upload__url-label">或通过图片 URL 配置</span>
        <el-input
          :model-value="modelValue && !modelValue.startsWith('data:') ? modelValue : ''"
          placeholder="https://example.com/cover.jpg"
          clearable
          size="default"
          @update:model-value="onUrlInput"
        />
      </div>

      <p class="cover-upload__hint">支持 JPG / PNG，大小不超过 {{ Math.round(maxSize / 1024 / 1024) }}MB</p>
    </div>
  </div>
</template>

<style scoped>
.cover-upload {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.cover-upload__preview {
  position: relative;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-fill-color-light);
  flex: 0 0 auto;
}

.cover-upload__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-upload__mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cover-upload__preview:hover .cover-upload__mask {
  opacity: 1;
}

.cover-upload__side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 240px;
  flex: 1 1 240px;
}

.cover-upload__url-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
  display: block;
}

.cover-upload__hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

@media (max-width: 640px) {
  .cover-upload__side {
    min-width: 100%;
  }
}
</style>
