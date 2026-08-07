<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    /** 是否保留卡片 body 的默认内边距（false 时用于内部自带 padding 的表单场景） */
    bodyPadding?: boolean
  }>(),
  { bodyPadding: true },
)

const bodyStyle = computed(() => (props.bodyPadding ? {} : { padding: '0' }))
</script>

<template>
  <el-card class="page-card" shadow="never" :body-style="bodyStyle">
    <template v-if="title || $slots.extra" #header>
      <div class="page-card__header">
        <span class="page-card__title">{{ title }}</span>
        <slot name="extra" />
      </div>
    </template>
    <slot />
    <div v-if="$slots.footer" class="page-card__footer">
      <slot name="footer" />
    </div>
  </el-card>
</template>

<style scoped>
.page-card {
  margin-bottom: 16px;
}
.page-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-card__title {
  font-weight: 600;
  font-size: 15px;
}
.page-card__footer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
