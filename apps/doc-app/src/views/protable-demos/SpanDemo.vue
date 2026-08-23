<script setup lang="ts">
import { PageCard, ProTable, type ProTableColumn } from '@mic/components'
import { mockRequest, type DemoRow } from './mock'

// 单元格合并演示：在部门列上，把"每连续的 4 行"纵向合并为一个单元格。
// 真实业务中通常依据某分组字段（如 dept）判断是否与前一行相同，
// 通过 rowIndex 与前一行数据比较即可，这里用固定步长便于演示效果。
const columns: ProTableColumn<DemoRow>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  {
    prop: 'dept',
    label: '部门',
    minWidth: 120,
    spanMethod: ({ rowIndex }) => {
      if (rowIndex % 4 === 0) return [4, 1] // 从此行起合并 4 行 1 列
      return [0, 0] // 其余行被合并（不渲染）
    },
  },
  { prop: 'group', label: '小组', minWidth: 100 },
  { prop: 'name', label: '项目名称', minWidth: 160 },
  {
    prop: 'amount',
    label: '金额(元)',
    minWidth: 130,
    align: 'right',
    formatter: (_r, _c, v) => `¥${(v as number).toFixed(2)}`,
  },
  { prop: 'owner', label: '负责人', width: 110 },
]
</script>

<template>
  <PageCard
    title="单元格合并复杂示例"
    subtitle="在 columns 根列声明 spanMethod，实现相邻相同内容的单元格纵向合并"
  >
    <ProTable :request="mockRequest" :columns="columns" row-key="id" :default-page-size="8" />
  </PageCard>
</template>
