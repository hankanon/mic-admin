<script setup lang="ts">
import { PageCard } from '@mic/components'

defineOptions({ name: 'SessionHistory' })
</script>

<template>
  <PageCard title="历史会话" subtitle="查看与管理过往问答记录">
    <el-empty description="历史会话（开发中）" />
  </PageCard>
</template>
