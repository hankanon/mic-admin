<script setup lang="ts">
import { PageCard } from '@mic/components'

defineOptions({ name: 'UserStats' })
</script>

<template>
  <PageCard title="用户统计" subtitle="用户活跃度与增长">
    <el-empty description="用户统计图表（开发中）" />
  </PageCard>
</template>
