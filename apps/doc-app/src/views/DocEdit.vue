<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { PageCard } from '@mic/components'
import { MdPreview } from 'md-editor-v3'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import CoverUpload from '../components/CoverUpload.vue'
import { DOC_CATEGORIES, useDocStore, type DocStatus } from '../store/doc'
import { useUserStore } from '../store/user'

defineOptions({ name: 'DocEdit' })

const route = useRoute()
const router = useRouter()
const docStore = useDocStore()
const userStore = useUserStore()

const editId = computed<number | null>(() =>
  route.params.id ? Number(route.params.id) : null,
)
const isEdit = computed(() => editId.value !== null)

const form = reactive({
  title: '',
  category: DOC_CATEGORIES[0],
  content: '',
  cover: '',
})

const rules: FormRules = {
  title: [{ required: true, message: '请输入文档标题', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
}

const formRef = ref<FormInstance>()
const previewVisible = ref(false)

/** 记录初始快照用于「取消」时脏检查 */
const snapshot = ref('')

const isDirty = computed(() => JSON.stringify(form) !== snapshot.value)

function loadDoc() {
  if (!editId.value) return
  const doc = docStore.getById(editId.value)
  if (doc) {
    form.title = doc.title
    form.category = doc.category
    form.content = doc.content
    form.cover = doc.cover
  }
  snapshot.value = JSON.stringify(form)
}

onMounted(loadDoc)

async function onSave() {
  if (!formRef.value) return
  await formRef.value.validate((valid) => {
    if (!valid) return
    const status: DocStatus = isEdit.value ? docStore.getById(editId.value!)?.status ?? 'draft' : 'draft'
      docStore.save({
      id: editId.value ?? undefined,
      title: form.title.trim(),
      category: form.category,
      content: form.content,
      cover: form.cover,
      status,
      author: userStore.userInfo?.name || '未知',
    })
    ElMessage.success(isEdit.value ? '文档已更新' : '文档已创建')
    router.push('/list')
  })
}

async function onCancel() {
  if (isDirty.value) {
    try {
      await ElMessageBox.confirm('当前内容尚未保存，确定要离开吗？', '提示', {
        confirmButtonText: '离开',
        cancelButtonText: '继续编辑',
        type: 'warning',
      })
    } catch {
      return
    }
  }
  router.push('/list')
}

function openPreview() {
  if (!form.title.trim()) {
    ElMessage.warning('请先填写标题再预览')
    return
  }
  previewVisible.value = true
}
</script>

<template>
  <div class="doc-edit">
    <PageCard :title="isEdit ? '编辑文档' : '新增文档'">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="doc-edit__form"
      >
        <div class="doc-edit__meta">
          <el-form-item label="标题" prop="title" class="doc-edit__title">
            <el-input
              v-model="form.title"
              placeholder="请输入文档标题"
              maxlength="80"
              show-word-limit
              clearable
            />
          </el-form-item>
          <el-form-item label="分类" prop="category" class="doc-edit__category">
            <el-select v-model="form.category" placeholder="请选择分类" style="width: 100%">
              <el-option v-for="c in DOC_CATEGORIES" :key="c" :label="c" :value="c" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="主题配图" class="doc-edit__cover">
          <CoverUpload v-model="form.cover" />
        </el-form-item>

        <el-form-item label="内容" prop="content" class="doc-edit__content">
          <MarkdownEditor v-model="form.content" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="doc-edit__actions">
          <el-button @click="onCancel">取消</el-button>
          <el-button type="primary" plain @click="openPreview">预览</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
        </div>
      </template>
    </PageCard>

    <el-dialog
      v-model="previewVisible"
      title="文档预览"
      width="min(920px, 92vw)"
      append-to-body
      destroy-on-close
      class="doc-edit__preview-dialog"
    >
      <div class="doc-edit__preview-head">
        <h2 class="doc-edit__preview-title">{{ form.title || '未命名文档' }}</h2>
        <el-tag size="small" effect="plain">{{ form.category }}</el-tag>
      </div>
      <div class="doc-edit__preview-body markdown-body">
        <MdPreview :model-value="form.content || '_暂无内容_'" />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.doc-edit {
  width: 100%;
}

.doc-edit__form {
  padding: 4px 0 0;
}

.doc-edit__meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.doc-edit__title {
  flex: 1 1 360px;
  min-width: 240px;
}

.doc-edit__category {
  flex: 0 0 220px;
  min-width: 180px;
}

.doc-edit__content {
  margin-bottom: 8px;
}

.doc-edit__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.doc-edit__preview-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.doc-edit__preview-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.doc-edit__preview-body {
  max-height: 64vh;
  overflow: auto;
  padding: 4px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

@media (max-width: 640px) {
  .doc-edit__meta {
    flex-direction: column;
    gap: 0;
  }

  .doc-edit__category {
    flex-basis: auto;
  }

  .doc-edit__form {
    padding: 16px 14px 4px;
  }

  .doc-edit__actions {
    justify-content: stretch;
  }

  .doc-edit__actions .el-button {
    flex: 1 1 auto;
  }
}
</style>
