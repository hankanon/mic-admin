<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <el-card class="page-card" shadow="never">
    <template v-if="title || $slots.extra" #header>
      <div class="page-card__header">
        <span class="page-card__title">{{ title }}</span>
        <slot name="extra" />
      </div>
    </template>
    <slot />
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
</style>
