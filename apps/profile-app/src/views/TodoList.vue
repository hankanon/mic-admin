<script setup lang="ts">
import { PageCard } from '@mic/components'

defineOptions({ name: 'TodoList' })
</script>

<template>
  <PageCard title="待办事项" subtitle="个人待办与任务跟踪">
    <el-empty description="待办事项（开发中）" />
  </PageCard>
</template>
