<script setup lang="ts">
defineOptions({ name: 'MenuManage' })
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { PageCard } from '@mic/components'
import { menuApi } from '../api/menu'
import type { AppKey, MenuNode, MenuPayload } from '../types'

const appKeys: { label: string; value: AppKey }[] = [
  { label: '首页大盘', value: 'dashboard' },
  { label: '文档管理', value: 'doc' },
  { label: '智能问答', value: 'qa' },
  { label: '个人中心', value: 'profile' },
  { label: '系统管理', value: 'sys' },
]

const loading = ref(false)
const treeData = ref<MenuNode[]>([])

/** 查询条件 */
interface Query {
  appKey: AppKey
  keyword: string
  type: '' | 'menu' | 'catalog'
  visible: '' | 'visible' | 'hidden'
}
const defaultQuery = (): Query => ({ appKey: 'sys', keyword: '', type: '', visible: '' })
const query = ref<Query>(defaultQuery())
/** 点击「查询」后才生效的条件快照 */
const activeQuery = ref<Query>(defaultQuery())

async function fetchTree() {
  loading.value = true
  try {
    treeData.value = await menuApi.tree(activeQuery.value.appKey)
  } finally {
    loading.value = false
  }
}
onMounted(fetchTree)

/** 树形过滤：命中节点保留整棵子树；未命中则保留命中后代的祖先链 */
const filteredTree = computed<MenuNode[]>(() => {
  const q = activeQuery.value
  const kw = q.keyword.trim().toLowerCase()
  const matchSelf = (n: MenuNode) =>
    (!kw || n.title.toLowerCase().includes(kw)) &&
    (!q.type || n.type === q.type) &&
    (!q.visible || (q.visible === 'visible' ? n.visible : !n.visible))
  const filterNode = (node: MenuNode): MenuNode | null => {
    if (matchSelf(node)) return node
    const children = (node.children ?? []).map(filterNode).filter(Boolean) as MenuNode[]
    return children.length ? { ...node, children } : null
  }
  return treeData.value.map(filterNode).filter(Boolean) as MenuNode[]
})

function handleSearch() {
  activeQuery.value = { ...query.value }
  fetchTree()
}

function handleReset() {
  query.value = defaultQuery()
  activeQuery.value = defaultQuery()
  fetchTree()
}

// ---- 弹窗表单 ----
const dialogVisible = ref(false)
const dialogTitle = ref('')
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const parentTree = ref<MenuNode[]>([])

const form = reactive<MenuPayload>({
  appKey: 'sys',
  parentId: 0,
  title: '',
  icon: '',
  path: '',
  type: 'menu',
  order: 0,
  visible: true,
  permission: '',
})

const rules: FormRules = {
  appKey: [{ required: true, message: '请选择所属子应用', trigger: 'change' }],
  title: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择菜单类型', trigger: 'change' }],
  path: [
    {
      validator: (_rule, _value, callback) => {
        // 目录(catalog)无路由，叶子菜单(menu)必须填写路由路径
        if (form.type === 'catalog') return callback()
        if (!form.path || !form.path.trim()) return callback(new Error('请输入路由路径'))
        callback()
      },
      trigger: ['blur', 'change'],
    },
  ],
}

// 菜单类型切换时联动处理路由路径校验
// catalog 类型不需要路由路径，清空旧错误；menu 类型需要必填，触发校验
watch(
  () => form.type,
  (type) => {
    if (type === 'catalog') {
      formRef.value?.clearValidate('path')
    } else {
      formRef.value?.validateField('path').catch(() => {})
    }
  },
)

// 父菜单可选项（排除自身及其子树，防止循环引用）
const parentOptions = computed(() => {
  const opts: { id: number; label: string }[] = [{ id: 0, label: '根菜单（顶级）' }]
  const walk = (list: MenuNode[], depth: number) => {
    for (const n of list) {
      if (editingId.value && n.id === editingId.value) continue
      opts.push({ id: n.id, label: '　'.repeat(depth) + n.title })
      if (n.children?.length) walk(n.children, depth + 1)
    }
  }
  walk(parentTree.value, 0)
  return opts
})

async function openCreate(parentId = 0) {
  editingId.value = null
  dialogTitle.value = parentId ? '新增子菜单' : '新增菜单'
    Object.assign(form, {
    appKey: query.value.appKey,
    parentId,
    title: '',
    icon: '',
    path: '',
    type: 'menu',
    order: 0,
    visible: true,
    permission: '',
  })
  parentTree.value = await menuApi.tree(form.appKey)
  dialogVisible.value = true
}

async function openEdit(row: MenuNode) {
  editingId.value = row.id
  dialogTitle.value = '编辑菜单'
  Object.assign(form, {
    appKey: row.appKey,
    parentId: row.parentId,
    title: row.title,
    icon: row.icon ?? '',
    path: row.path ?? '',
    type: row.type,
    order: row.order,
    visible: row.visible,
    permission: row.permission ?? '',
  })
  parentTree.value = await menuApi.tree(form.appKey)
  dialogVisible.value = true
}

async function submit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    const payload: MenuPayload = {
      appKey: form.appKey,
      parentId: form.parentId,
      title: form.title,
      icon: form.icon || undefined,
      // 目录类型 path 可空：显式传空字符串，确保后端清空旧值；菜单类型必填
      path: form.type === 'catalog' ? '' : form.path,
      type: form.type,
      order: form.order,
      visible: form.visible,
      permission: form.permission || undefined,
    }
    try {
      if (editingId.value) {
        await menuApi.update(editingId.value, payload)
        ElMessage.success('更新成功')
      } else {
        await menuApi.create(payload)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      await fetchTree()
    } catch {
      /* 业务错误已由 request 拦截器统一提示 */
    }
  })
}

async function removeMenu(row: MenuNode) {
  try {
    await ElMessageBox.confirm(`确认删除菜单「${row.title}」？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    await menuApi.remove(row.id)
    ElMessage.success('删除成功')
    await fetchTree()
  } catch {
    /* 关联冲突等已由拦截器提示 */
  }
}

// 排序：内联编辑 order + 上移/下移
async function saveOrder(row: MenuNode) {
  try {
    await menuApi.update(row.id, { order: row.order })
  } catch {
    /* ignore */
  }
}

function getSiblings(id: number): MenuNode[] {
  if (treeData.value.some((n) => n.id === id)) return treeData.value
  let result: MenuNode[] | null = null
  const dfs = (list: MenuNode[]) => {
    if (result) return
    for (const n of list) {
      if (n.children?.some((c) => c.id === id)) {
        result = n.children
        return
      }
      if (n.children) dfs(n.children)
    }
  }
  dfs(treeData.value)
  return result || []
}

async function move(row: MenuNode, dir: -1 | 1) {
  const siblings = getSiblings(row.id)
  const sorted = [...siblings].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex((s) => s.id === row.id)
  const target = sorted[idx + dir]
  if (!target) return
  const aOrder = row.order
  const bOrder = target.order
  try {
    await Promise.all([
      menuApi.update(row.id, { order: bOrder }),
      menuApi.update(target.id, { order: aOrder }),
    ])
    await fetchTree()
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div>
    <PageCard title="菜单管理">
      <template #extra>
        <el-button type="primary" size="small" @click="openCreate(0)">新增菜单</el-button>
      </template>

      <!-- 查询条件 -->
      <el-form :model="query" inline class="search-form" @submit.prevent="handleSearch">
        <el-form-item label="所属应用">
          <el-select v-model="query.appKey" placeholder="所属应用" style="width: 140px" @change="handleSearch">
            <el-option v-for="a in appKeys" :key="a.value" :label="a.label" :value="a.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="菜单名称">
          <el-input
            v-model="query.keyword"
            placeholder="按名称搜索"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="query.type" placeholder="全部类型" clearable style="width: 120px" @change="handleSearch">
            <el-option label="菜单" value="menu" />
            <el-option label="目录" value="catalog" />
          </el-select>
        </el-form-item>
        <el-form-item label="可见">
          <el-select v-model="query.visible" placeholder="全部" clearable style="width: 120px" @change="handleSearch">
            <el-option label="可见" value="visible" />
            <el-option label="隐藏" value="hidden" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table
        :data="filteredTree"
        row-key="id"
        :tree-props="{ children: 'children' }"
        default-expand-all
        border
        v-loading="loading"
      >
        <el-table-column label="菜单名称" min-width="200">
          <template #default="{ row }">
            <el-icon v-if="row.icon"><component :is="row.icon" /></el-icon>
            <span style="margin-left: 4px">{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'catalog' ? 'warning' : 'info'" size="small">
              {{ row.type === 'catalog' ? '目录' : '菜单' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="所属应用" width="120">
          <template #default="{ row }">
            {{ appKeys.find((a) => a.value === row.appKey)?.label || row.appKey }}
          </template>
        </el-table-column>
        <el-table-column label="路径" prop="path" min-width="160" />
        <el-table-column label="排序" width="80" align="center">
          <template #default="{ row }">
            <span class="menu-order">{{ row.order }}</span>
          </template>
        </el-table-column>
        <el-table-column label="可见" width="80">
          <template #default="{ row }">
            <el-tag :type="row.visible ? 'success' : 'info'" size="small">
              {{ row.visible ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openCreate(row.id)">新增子级</el-button>
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="move(row, -1)">上移</el-button>
            <el-button link type="primary" size="small" @click="move(row, 1)">下移</el-button>
            <el-button link type="danger" size="small" @click="removeMenu(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </PageCard>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="所属应用" prop="appKey">
          <el-select v-model="form.appKey" style="width: 100%">
            <el-option v-for="a in appKeys" :key="a.value" :label="a.label" :value="a.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="父菜单">
          <el-select v-model="form.parentId" style="width: 100%">
            <el-option v-for="o in parentOptions" :key="o.id" :label="o.label" :value="o.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="菜单名称" prop="title">
          <el-input v-model="form.title" placeholder="请输入菜单名称" />
        </el-form-item>
        <el-form-item label="菜单类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio value="menu">菜单</el-radio>
            <el-radio value="catalog">目录</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="form.icon" placeholder="Element Plus 图标名，如 Document" />
        </el-form-item>
        <el-form-item label="路由路径" prop="path" :required="form.type === 'menu'">
          <el-input v-model="form.path" placeholder="如 /sys/menu（目录可留空）" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.order" :min="0" />
        </el-form-item>
        <el-form-item label="是否可见">
          <el-switch v-model="form.visible" />
        </el-form-item>
        <el-form-item label="权限标识">
          <el-input v-model="form.permission" placeholder="如 sys:menu:view（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.search-form {
  padding: 16px 16px 0;
  margin-bottom: 16px;
  background: var(--el-fill-color-light, #f5f7fa);
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 8px;
}
.search-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
</style>
