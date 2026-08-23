<script setup lang="ts">
import { PageCard } from '@mic/components'

defineOptions({ name: 'SystemNotice' })
</script>

<template>
  <PageCard title="系统公告" subtitle="平台通知与维护信息">
    <el-empty description="暂无系统公告" />
  </PageCard>
</template>
