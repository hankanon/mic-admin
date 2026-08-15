<script setup lang="ts">
import { PageCard } from '@mic/components'
import { navigateToApp } from '@mic/utils'

defineOptions({ name: 'DocStats' })

/** 跳转到文档管理应用下的文档列表 */
function goDocList() {
  navigateToApp('doc', '/list')
}
</script>

<template>
  <PageCard title="文档统计" subtitle="文档分类与发布趋势">
    <template #extra>
      <el-button type="primary" @click="goDocList">
        <el-icon><Document /></el-icon>
        查看文档列表
      </el-button>
    </template>
    <el-empty description="文档统计图表（开发中）" />
  </PageCard>
</template>
