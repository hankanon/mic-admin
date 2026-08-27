<script setup lang="ts">
import { ref, computed } from 'vue'
import { PageCard } from '@mic/components'

defineOptions({ name: 'DocPublish' })

interface ChannelItem {
  name: string
  published: number
  pending: number
}

const channels = ref<ChannelItem[]>([
  { name: '官网帮助中心', published: 12, pending: 3 },
  { name: '内部知识库', published: 8, pending: 1 },
  { name: '移动端资讯', published: 5, pending: 0 },
])

/** 查询条件 */
interface Query {
  name: string
  /** '' 全部 | 'pending' 有待发布 | 'done' 无待发布 */
  pendingStatus: '' | 'pending' | 'done'
}

const defaultQuery = (): Query => ({ name: '', pendingStatus: '' })
const query = ref<Query>(defaultQuery())
/** 点击「查询」后才生效的条件快照 */
const activeQuery = ref<Query>(defaultQuery())

const pendingOptions = [
  { label: '有待发布', value: 'pending' },
  { label: '无待发布', value: 'done' },
]

const filteredChannels = computed(() => {
  const q = activeQuery.value
  return channels.value.filter((ch) => {
    if (q.name && !ch.name.toLowerCase().includes(q.name.trim().toLowerCase())) return false
    if (q.pendingStatus === 'pending' && ch.pending <= 0) return false
    if (q.pendingStatus === 'done' && ch.pending > 0) return false
    return true
  })
})

function handleSearch() {
  activeQuery.value = { ...query.value }
}

function handleReset() {
  query.value = defaultQuery()
  activeQuery.value = defaultQuery()
}
</script>

<template>
  <div>
    <PageCard title="发布管理">
      <el-steps :active="2" finish-status="success" style="margin-bottom: 24px">
        <el-step title="草稿" />
        <el-step title="审核" />
        <el-step title="发布" />
        <el-step title="完成" />
      </el-steps>

      <!-- 查询条件 -->
      <el-form :model="query" inline class="search-form" @submit.prevent="handleSearch">
        <el-form-item label="发布渠道">
          <el-input
            v-model="query.name"
            placeholder="按渠道名称搜索"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="待发布状态">
          <el-select
            v-model="query.pendingStatus"
            placeholder="全部"
            clearable
            style="width: 140px"
            @change="handleSearch"
          >
            <el-option v-for="opt in pendingOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="filteredChannels" border>
        <el-table-column prop="name" label="发布渠道" />
        <el-table-column prop="published" label="已发布" width="120" />
        <el-table-column label="待发布" width="120">
          <template #default="{ row }">
            <el-badge v-if="row.pending > 0" :value="row.pending" type="warning">
              <span style="margin-right: 12px">{{ row.pending }}</span>
            </el-badge>
            <span v-else>0</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default>
            <el-button link type="primary" size="small">发布</el-button>
            <el-button link type="warning" size="small">撤回</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="没有符合条件的渠道" :image-size="80" />
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
