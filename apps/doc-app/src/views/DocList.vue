<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type UploadUserFile } from 'element-plus'
import { PageCard, SearchForm, Breadcrumb } from '@mic/components'
import { DOC_CATEGORIES, DOC_DEFAULT_COVER, useDocStore, type DocItem, type DocStatus } from '../store/doc'
import { grantDetailAccess } from '../router/detailAccess'

defineOptions({ name: 'DocList' })

const router = useRouter()
const docStore = useDocStore()

const categories = DOC_CATEGORIES

const query = reactive({ title: '', category: '', status: '' as DocStatus | '' })
const activeQuery = reactive({ title: '', category: '', status: '' as DocStatus | '' })

const docs = computed(() => docStore.docs)

const filteredDocs = computed(() => {
  return docs.value.filter((d) => {
    const okTitle = !activeQuery.title || d.title.includes(activeQuery.title)
    const okCat = !activeQuery.category || d.category === activeQuery.category
    const okStatus = !activeQuery.status || d.status === activeQuery.status
    return okTitle && okCat && okStatus
  })
})

function onSearch() {
  activeQuery.title = query.title.trim()
  activeQuery.category = query.category
  activeQuery.status = query.status
}

function onReset() {
  query.title = ''
  query.category = ''
  query.status = ''
  activeQuery.title = ''
  activeQuery.category = ''
  activeQuery.status = ''
}

const STATUS_TEXT: Record<DocStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}

function statusTagType(status: DocStatus): 'info' | 'success' | 'warning' {
  if (status === 'published') return 'success'
  if (status === 'archived') return 'warning'
  return 'info'
}

function translateStatus(status: DocStatus): string {
  return STATUS_TEXT[status]
}

function goCreate() {
  router.push('/edit')
}

function goEdit(row: DocItem) {
  router.push(`/edit/${row.id}`)
}

function goDetail(row: DocItem) {
  // 授予一次性访问令牌，详情页守卫据此放行进访问问
  grantDetailAccess(row.id)
  router.push(`/detail/${row.id}`)
}

async function onDelete(row: DocItem) {
  try {
    await ElMessageBox.confirm(`确定删除文档「${row.title}」吗？`, '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  docStore.remove(row.id)
  ElMessage.success('已删除')
}

// 占位：保留上传/导入入口交互（当前为演示）
const fileList = computed<UploadUserFile[]>(() => [])
</script>

<template>
  <div class="doc-list">
    <Breadcrumb />

    <SearchForm title="文档筛选" @search="onSearch" @reset="onReset">
      <el-form-item label="标题">
        <el-input v-model="query.title" placeholder="按标题搜索" clearable />
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="query.category" placeholder="全部分类" clearable style="width: 160px">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 140px">
          <el-option label="草稿" value="draft" />
          <el-option label="已发布" value="published" />
          <el-option label="已归档" value="archived" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <PageCard title="文档列表">
      <template #extra>
        <div class="doc-list__toolbar">
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            :file-list="fileList"
            accept=".md"
            disabled
          >
            <el-button type="default">导入</el-button>
          </el-upload>
          <el-button type="primary" @click="goCreate">新增文档</el-button>
        </div>
      </template>

      <el-table :data="filteredDocs" stripe border height="100%" class="doc-list__table">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="主题配图" width="120">
          <template #default="{ row }">
            <img
              :src="row.cover || DOC_DEFAULT_COVER"
              alt="主题配图"
              class="doc-list__cover"
            />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="author" label="作者" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" effect="light">
              {{ translateStatus(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="goDetail(row)">详情</el-button>
            <el-button link type="primary" @click="goEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无文档" />
        </template>
      </el-table>
    </PageCard>
  </div>
</template>

<style scoped>
.doc-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.doc-list__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
}

.doc-list__table {
  width: 100%;
}

.doc-list__cover {
  width: 96px;
  height: 56px;
  object-fit: cover;
  border-radius: 4px;
  display: block;
}
</style>
