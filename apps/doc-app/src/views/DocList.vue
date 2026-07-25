<script setup lang="ts">
import { ref, computed } from 'vue'
import { PageCard, Breadcrumb } from '@mic/components'
import { formatDate } from '@mic/utils'

defineOptions({ name: 'DocList' })

interface DocItem {
  id: number
  title: string
  author: string
  status: 'draft' | 'published' | 'archived'
  updatedAt: string
}

const docs = ref<DocItem[]>([
  { id: 1, title: '微前端接入指南', author: '张三', status: 'published', updatedAt: '2026-07-20 10:00:00' },
  { id: 2, title: '组件库使用手册', author: '李四', status: 'draft', updatedAt: '2026-07-21 14:30:00' },
  { id: 3, title: '权限模型设计', author: '王五', status: 'archived', updatedAt: '2026-07-22 09:15:00' },
])

const statusMap: Record<DocItem['status'], { text: string; type: 'success' | 'info' | 'warning' }> = {
  published: { text: '已发布', type: 'success' },
  draft: { text: '草稿', type: 'warning' },
  archived: { text: '已归档', type: 'info' },
}

const statusOptions = [
  { label: '已发布', value: 'published' },
  { label: '草稿', value: 'draft' },
  { label: '已归档', value: 'archived' },
]

/** 查询条件 */
interface Query {
  keyword: string
  author: string
  status: DocItem['status'] | ''
  dateRange: [string, string] | null
}

const defaultQuery = (): Query => ({ keyword: '', author: '', status: '', dateRange: null })
const query = ref<Query>(defaultQuery())
/** 点击「查询」后才生效的条件快照 */
const activeQuery = ref<Query>(defaultQuery())

const filteredDocs = computed(() => {
  const q = activeQuery.value
  return docs.value.filter((doc) => {
    if (q.keyword && !doc.title.toLowerCase().includes(q.keyword.trim().toLowerCase())) return false
    if (q.author && !doc.author.includes(q.author.trim())) return false
    if (q.status && doc.status !== q.status) return false
    if (q.dateRange && q.dateRange.length === 2) {
      const t = new Date(doc.updatedAt).getTime()
      const start = new Date(`${q.dateRange[0]} 00:00:00`).getTime()
      const end = new Date(`${q.dateRange[1]} 23:59:59`).getTime()
      if (t < start || t > end) return false
    }
    return true
  })
})

function handleSearch() {
  activeQuery.value = { ...query.value, dateRange: query.value.dateRange ? [...query.value.dateRange] : null }
}

function handleReset() {
  query.value = defaultQuery()
  activeQuery.value = defaultQuery()
}
</script>

<template>
  <div>
    <Breadcrumb />
    <PageCard title="文档列表">
      <template #extra>
        <el-button type="primary" size="small">新建文档</el-button>
      </template>

      <!-- 查询条件 -->
      <el-form :model="query" inline class="search-form" @submit.prevent="handleSearch">
        <el-form-item label="标题">
          <el-input
            v-model="query.keyword"
            placeholder="按标题关键词搜索"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="作者">
          <el-input
            v-model="query.author"
            placeholder="按作者搜索"
            clearable
            style="width: 140px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 140px" @change="handleSearch">
            <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="更新时间">
          <el-date-picker
            v-model="query.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 260px"
            @change="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="filteredDocs" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="author" label="作者" width="120" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.status as DocItem['status']].type">
              {{ statusMap[row.status as DocItem['status']].text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="200">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default>
            <el-button link type="primary" size="small">编辑</el-button>
            <el-button link type="danger" size="small">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="没有符合条件的文档" :image-size="80" />
        </template>
      </el-table>
    </PageCard>
  </div>
</template>

<style scoped>
.search-form {
  padding: 16px 16px 0;
  margin-bottom: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}
</style>
