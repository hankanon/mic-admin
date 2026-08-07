<script setup lang="ts">
defineProps<{ title?: string }>()
const emit = defineEmits<{ (e: 'search'): void; (e: 'reset'): void }>()
</script>

<template>
  <div class="search-form">
    <div v-if="title" class="search-form__title">{{ title }}</div>
    <el-form :inline="true" class="search-form__body" @submit.prevent>
      <slot />
      <el-form-item class="search-form__actions">
        <el-button type="primary" @click="emit('search')">查询</el-button>
        <el-button @click="emit('reset')">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.search-form {
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 16px 16px 0;
  margin-bottom: 16px;
}
.search-form__title {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}
.search-form__body {
  display: flex;
  flex-wrap: wrap;
  row-gap: 0;
  column-gap: 8px;
}
.search-form__actions {
  margin-right: 0;
}
</style>
