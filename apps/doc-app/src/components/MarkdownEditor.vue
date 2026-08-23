<script setup lang="ts">
import { computed } from 'vue'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { useTheme } from '@mic/utils'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    height?: string
  }>(),
  {
    placeholder: '请输入 Markdown 内容，支持实时预览…',
    height: '520px',
  },
)

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const { currentTheme } = useTheme()
const editorTheme = computed(() => (currentTheme.value === 'dark' ? 'dark' : 'light'))

function onUpdate(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <MdEditor
    :model-value="props.modelValue"
    :theme="editorTheme"
    :placeholder="props.placeholder"
    :style="{ height: props.height }"
    language="zh-CN"
    :no-mermaid="true"
    :toolbars="[
      'bold', 'underline', 'italic', 'strikeThrough', 'title', 'sub', 'sup', 'quote',
      'unorderedList', 'orderedList', 'task', 'codeRow', 'code', 'link', 'image',
      'table', 'previewOnly', 'catalog', 'preview', 'htmlPreview', 'fullscreen',
    ]"
    @update:model-value="onUpdate"
  />
</template>

<style scoped>
:deep(.md-editor) {
  border-radius: 6px;
}
</style>
