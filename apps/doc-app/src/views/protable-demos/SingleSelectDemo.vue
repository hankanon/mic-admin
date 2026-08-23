<script setup lang="ts">
import { ref } from 'vue'
import { PageCard, ProTable, type ProTableColumn } from '@mic/components'
import { mockRequest, type DemoRow } from './mock'

const columns: ProTableColumn<DemoRow>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '项目名称', minWidth: 160 },
  { prop: 'dept', label: '部门', minWidth: 120 },
  { prop: 'owner', label: '负责人', width: 110 },
  { prop: 'amount', label: '金额(元)', minWidth: 130, align: 'right' },
]

const current = ref<DemoRow | null>(null)
</script>

<template>
  <PageCard
    title="单选模式示例"
    subtitle="single-select 开启后点击行高亮当前行（highlight-current-row），通过 row-click 取选中数据"
  >
    <ProTable
      :request="mockRequest"
      :columns="columns"
      row-key="id"
      single-select
      @row-click="(row) => (current = row)"
    />
    <div v-if="current" class="single-demo__result">
      已选：{{ current.name }}（ID: {{ current.id }}）— 负责人 {{ current.owner }}
    </div>
  </PageCard>
</template>

<style scoped>
.single-demo__result {
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--el-color-primary-light-9);
  border-radius: 6px;
  font-size: 13px;
}
</style>
