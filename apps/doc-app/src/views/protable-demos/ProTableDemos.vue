<script setup lang="ts">
import { useRouter } from 'vue-router'
import { PageCard } from '@mic/components'

const router = useRouter()

const demos = [
  { path: '/protable/multi-header', title: '多表头示例', desc: '通过 columns.children 实现多级表头分组' },
  { path: '/protable/slot', title: '自定义插槽示例', desc: '状态列 Tag 渲染 + 操作列 actions 插槽' },
  { path: '/protable/single', title: '单选模式示例', desc: 'single-select 点击行高亮并回传当前行' },
  { path: '/protable/multi', title: '多选模式示例', desc: 'selection 多选 + 工具栏批量操作' },
  { path: '/protable/span', title: '单元格合并复杂示例', desc: '根列声明 spanMethod 实现纵向合并' },
]
</script>

<template>
  <PageCard title="ProTable 使用示例" subtitle="基于 Element Plus 的统一表格分页组件">
    <el-row :gutter="16">
      <el-col v-for="d in demos" :key="d.path" :span="8" style="margin-bottom: 16px">
        <el-card shadow="hover" class="demo-card" @click="router.push(d.path)">
          <div class="demo-card__title">{{ d.title }}</div>
          <div class="demo-card__desc">{{ d.desc }}</div>
        </el-card>
      </el-col>
    </el-row>
  </PageCard>
</template>

<style scoped>
.demo-card {
  cursor: pointer;
}
.demo-card__title {
  font-weight: 600;
  margin-bottom: 6px;
}
.demo-card__desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
