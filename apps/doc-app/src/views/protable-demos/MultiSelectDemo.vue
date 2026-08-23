<script setup lang="ts">
import { ref } from 'vue'
import { PageCard, ProTable, type ProTableColumn } from '@mic/components'
import { ElButton, ElMessage } from 'element-plus'
import { mockRequest, type DemoRow } from './mock'

const columns: ProTableColumn<DemoRow>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '项目名称', minWidth: 160 },
  { prop: 'dept', label: '部门', minWidth: 120 },
  { prop: 'owner', label: '负责人', width: 110 },
  { prop: 'amount', label: '金额(元)', minWidth: 130, align: 'right' },
]

const selected = ref<DemoRow[]>([])

function onSelectionChange(rows: DemoRow[]) {
  selected.value = rows
}

function batchDelete() {
  if (!selected.value.length) {
    ElMessage.warning('请先勾选要删除的数据')
    return
  }
  ElMessage.success(`将删除 ${selected.value.length} 条记录`)
}
</script>

<template>
  <PageCard
    title="多选模式示例"
    subtitle="selection 开启多选列，selection-change 实时回传选中行，配合工具栏批量操作"
  >
    <ProTable
      ref="tableRef"
      :request="mockRequest"
      :columns="columns"
      row-key="id"
      selection
      @selection-change="onSelectionChange"
    >
      <template #toolbar="{ getSelectionRows }">
        <el-button type="danger" :disabled="!getSelectionRows().length" @click="batchDelete">
          批量删除（{{ selected.length }}）
        </el-button>
      </template>
    </ProTable>
  </PageCard>
</template>
