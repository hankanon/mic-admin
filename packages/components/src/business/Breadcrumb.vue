<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = withDefaults(defineProps<{ items?: { title: string; path?: string }[] }>(), {
  items: () => [],
})

const route = useRoute()

const crumbs = computed(() => {
  if (props.items.length) return props.items
  return route.matched
    .filter((r) => r.meta?.title)
    .map((r) => ({ title: r.meta.title as string, path: r.path }))
})
</script>

<template>
  <el-breadcrumb separator="/" class="mic-breadcrumb">
    <el-breadcrumb-item v-for="(c, i) in crumbs" :key="i" :to="c.path ? { path: c.path } : undefined">
      {{ c.title }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<style scoped>
.mic-breadcrumb {
  margin-bottom: 12px;
}
</style>
