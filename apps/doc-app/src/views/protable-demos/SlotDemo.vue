<script setup lang="ts">
import { PageCard, ProTable, type ProTableColumn } from '@mic/components'
import { ElTag, ElButton, ElIcon } from 'element-plus'
import { View, Edit, Delete } from '@element-plus/icons-vue'
import { mockRequest, type DemoRow } from './mock'

const columns: ProTableColumn<DemoRow>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '项目名称', minWidth: 160 },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    // 使用具名插槽 column-status 自定义渲染
    slot: 'column-status',
  },
  {
    prop: 'amount',
    label: '金额(元)',
    minWidth: 130,
    align: 'right',
    formatter: (_row, _c, v) => `¥${(v as number).toFixed(2)}`,
  },
  { prop: 'owner', label: '负责人', width: 110 },
  { type: 'actions', label: '操作', width: 180, fixed: 'right' },
]
</script>

<template>
  <PageCard title="自定义插槽示例" subtitle="状态列用 column-status 插槽渲染 Tag；操作列用 actions 插槽">
    <ProTable :request="mockRequest" :columns="columns" row-key="id">
      <!-- 状态列：自定义插槽 -->
      <template #column-status="{ row }">
        <el-tag :type="row.status === 'active' ? 'success' : 'info'">
          {{ row.status === 'active' ? '启用' : '停用' }}
        </el-tag>
      </template>

      <!-- 操作列：actions 插槽 -->
      <template #actions="{ row }">
        <el-button link type="primary" :icon="View" @click="console.log('view', row)">查看</el-button>
        <el-button link type="primary" :icon="Edit" @click="console.log('edit', row)">编辑</el-button>
        <el-button link type="danger" :icon="Delete" @click="console.log('del', row)">删除</el-button>
      </template>
    </ProTable>
  </PageCard>
</template>
