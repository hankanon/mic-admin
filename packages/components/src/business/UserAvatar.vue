<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name?: string
  src?: string
}>()

const initials = computed(() => (props.name ? props.name.slice(0, 1).toUpperCase() : '?'))
</script>

<template>
  <div class="user-avatar">
    <el-avatar v-if="src" :size="32" :src="src" />
    <el-avatar v-else :size="32" style="background: #2a5298">{{ initials }}</el-avatar>
    <span class="user-avatar__name">{{ name }}</span>
  </div>
</template>

<style scoped>
.user-avatar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.user-avatar__name {
  font-size: 14px;
  color: #333;
}
</style>
