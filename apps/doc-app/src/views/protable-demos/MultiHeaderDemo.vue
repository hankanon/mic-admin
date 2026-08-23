<script setup lang="ts">
import { PageCard, ProTable, type ProTableColumn } from '@mic/components'
import { mockRequest, type DemoRow } from './mock'

const columns: ProTableColumn<DemoRow>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  {
    label: '组织信息',
    children: [
      { prop: 'dept', label: '部门', minWidth: 120 },
      { prop: 'group', label: '小组', minWidth: 100 },
      { prop: 'region', label: '大区', minWidth: 100 },
    ],
  },
  {
    label: '业务信息',
    children: [
      { prop: 'name', label: '项目名称', minWidth: 160 },
      {
        prop: 'amount',
        label: '金额(元)',
        minWidth: 130,
        align: 'right',
        formatter: (_row, _c, v) => (v as number).toFixed(2),
      },
      { prop: 'date', label: '日期', minWidth: 120, sortable: 'custom' },
    ],
  },
  { prop: 'owner', label: '负责人', width: 110 },
]
</script>

<template>
  <PageCard title="多表头示例" subtitle="通过 columns 的 children 配置实现多级表头分组">
    <ProTable :request="mockRequest" :columns="columns" :default-page-size="10" row-key="id" />
  </PageCard>
</template>
