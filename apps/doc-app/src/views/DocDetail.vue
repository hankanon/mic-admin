<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Breadcrumb, PageCard } from '@mic/components'
import { MdPreview } from 'md-editor-v3'
import { DOC_DEFAULT_COVER, useDocStore } from '../store/doc'

defineOptions({ name: 'DocDetail' })

const route = useRoute()
const router = useRouter()
const docStore = useDocStore()

const doc = computed(() => {
  const id = Number(route.params.id)
  return docStore.getById(id)
})

const STATUS_TEXT: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}

function goBack() {
  router.push('/list')
}

function goEdit() {
  if (!doc.value) return
  router.push(`/edit/${doc.value.id}`)
}
</script>

<template>
  <div class="doc-detail">
    <Breadcrumb
      :items="[
        { title: '文档管理', path: '/list' },
        { title: doc ? doc.title : '文章详情' },
      ]"
    />

    <PageCard v-if="doc" :title="doc.title">
      <template #extra>
        <div class="doc-detail__actions">
          <el-button @click="goBack">返回列表</el-button>
          <el-button type="primary" @click="goEdit">编辑</el-button>
        </div>
      </template>

      <div class="doc-detail__meta">
        <el-tag effect="plain">{{ doc.category }}</el-tag>
        <span class="doc-detail__meta-text">作者：{{ doc.author }}</span>
        <span class="doc-detail__meta-text">状态：{{ STATUS_TEXT[doc.status] }}</span>
        <span class="doc-detail__meta-text">更新：{{ doc.updatedAt }}</span>
      </div>

      <div class="doc-detail__cover">
        <img :src="doc.cover || DOC_DEFAULT_COVER" alt="主题配图" class="doc-detail__cover-img" />
      </div>

      <div class="doc-detail__body markdown-body">
        <MdPreview :model-value="doc.content || '_暂无内容_'" />
      </div>
    </PageCard>

    <el-empty v-else description="未找到该文档">
      <el-button type="primary" @click="goBack">返回列表</el-button>
    </el-empty>
  </div>
</template>

<style scoped>
.doc-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.doc-detail__actions {
  display: flex;
  gap: 12px;
}

.doc-detail__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.doc-detail__cover {
  margin-bottom: 16px;
}

.doc-detail__cover-img {
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
  border: 1px solid var(--el-border-color-lighter);
}

.doc-detail__body {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 8px 16px;
  min-height: 120px;
}

@media (max-width: 640px) {
  .doc-detail__meta {
    gap: 10px;
  }
}
</style>
