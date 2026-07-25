<script setup lang="ts">
defineOptions({ name: 'RoleManage' })
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { PageCard, Breadcrumb, menuConfig } from '@mic/components'
import { useRoleStore } from '../store/role'
import type { AppKey, RolePayload, RoleView } from '../types'

const roleStore = useRoleStore()

/** 子应用列表：由公共菜单配置推导（含 appKey 的顶级项即一个子应用），不写死 */
const appOptions = computed(() =>
  menuConfig
    .filter((m) => m.appKey)
    .map((m) => ({ value: m.appKey as AppKey, label: m.title, icon: m.icon })),
)
const appLabel = (key: AppKey) => appOptions.value.find((a) => a.value === key)?.label || key

onMounted(roleStore.fetchRoles)

// ---------------- 查询条件 ----------------
interface Query {
  name: string
  code: string
  appKey: '' | AppKey
}
const defaultQuery = (): Query => ({ name: '', code: '', appKey: '' })
const query = ref<Query>(defaultQuery())
/** 点击「查询」后才生效的条件快照 */
const activeQuery = ref<Query>(defaultQuery())

const filteredRoles = computed(() => {
  const q = activeQuery.value
  const name = q.name.trim().toLowerCase()
  const code = q.code.trim().toLowerCase()
  return roleStore.roles.filter((r) => {
    if (name && !r.name.toLowerCase().includes(name)) return false
    if (code && !r.code.toLowerCase().includes(code)) return false
    if (q.appKey && !r.appKeys.includes(q.appKey)) return false
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

// ---------------- 新增 / 编辑 ----------------
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const treeRef = ref()

const form = reactive<RolePayload>({
  name: '',
  code: '',
  appKeys: [],
  menuIds: [],
  description: '',
})

const dialogTitle = computed(() => (editingId.value ? '编辑角色' : '新增角色'))

/** 角色标识允许字母/数字/下划线/中划线（兼容 super-admin 等） */
const rules: FormRules = {
  name: [
    { required: true, message: '请输入角色名称', trigger: 'blur' },
    { min: 2, max: 20, message: '长度 2-20 个字符', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入角色标识', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_-]+$/, message: '仅支持字母、数字、下划线、中划线', trigger: 'blur' },
  ],
  appKeys: [
    {
      validator: (_r, v: AppKey[], cb) =>
        v && v.length ? cb() : cb(new Error('请至少关联一个子应用')),
      trigger: 'change',
    },
  ],
}

// 弹窗内勾选的应用变化时，重新加载对应菜单树并回显已选菜单
watch(
  () => form.appKeys,
  (keys) => {
    if (dialogVisible.value) loadMenuTree(keys)
  },
)

async function loadMenuTree(keys: AppKey[]) {
  await roleStore.fetchMenuTree(keys)
  await nextTick()
  treeRef.value?.setCheckedKeys(form.menuIds)
}

function resetForm() {
  Object.assign(form, { name: '', code: '', appKeys: [], menuIds: [], description: '' })
  roleStore.menuTree = []
}

function openCreate() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

async function openEdit(row: RoleView) {
  editingId.value = row.id
  Object.assign(form, {
    name: row.name,
    code: row.code,
    appKeys: [...row.appKeys],
    menuIds: [...row.menuIds],
    description: row.description ?? '',
  })
  dialogVisible.value = true
  await loadMenuTree(form.appKeys)
  nextTick(() => formRef.value?.clearValidate())
}

async function submit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    const menuIds = (treeRef.value?.getCheckedKeys() || []) as number[]
    const payload: RolePayload = {
      name: form.name,
      code: form.code,
      appKeys: form.appKeys,
      menuIds,
      description: form.description || undefined,
    }
    try {
      if (editingId.value) {
        await roleStore.updateRole(editingId.value, payload)
        ElMessage.success('更新成功')
      } else {
        await roleStore.createRole(payload)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
    } catch {
      /* 业务错误已由 request 拦截器统一提示 */
    }
  })
}

// ---------------- 删除 ----------------
async function removeRole(row: RoleView) {
  try {
    await ElMessageBox.confirm(
      `确认删除角色「${row.name}」？删除后分配该角色的人员将失去对应权限。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await roleStore.removeRole(row.id)
    ElMessage.success('删除成功')
  } catch {
    /* 关联冲突等已由拦截器提示 */
  }
}

// ---------------- 查看详情 ----------------
const detailVisible = ref(false)
const detail = ref<RoleView | null>(null)
function openDetail(row: RoleView) {
  detail.value = row
  detailVisible.value = true
}

const formatTime = (t?: string) => (t ? t.slice(0, 19).replace('T', ' ') : '-')
/** 菜单树根节点（parentId=0）展示所属应用 tag */
const isRootNode = (data: { parentId: number }) => data.parentId === 0
</script>

<template>
  <div>
    <Breadcrumb />
    <PageCard title="角色管理">
      <template #extra>
        <el-button size="small" :loading="roleStore.loading" @click="roleStore.fetchRoles()">
          刷新
        </el-button>
        <el-button type="primary" size="small" @click="openCreate">新增角色</el-button>
      </template>

      <!-- 查询条件 -->
      <el-form :model="query" inline class="search-form" @submit.prevent="handleSearch">
        <el-form-item label="角色名称">
          <el-input
            v-model="query.name"
            placeholder="按名称搜索"
            clearable
            style="width: 180px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="角色标识">
          <el-input
            v-model="query.code"
            placeholder="按标识搜索"
            clearable
            style="width: 160px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="可访问子应用">
          <el-select v-model="query.appKey" placeholder="全部" clearable style="width: 150px" @change="handleSearch">
            <el-option v-for="a in appOptions" :key="a.value" :label="a.label" :value="a.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="filteredRoles" border v-loading="roleStore.loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="角色名称" min-width="120" />
        <el-table-column prop="code" label="标识" width="150">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="可访问子应用" min-width="170">
          <template #default="{ row }">
            <el-tag
              v-for="k in row.appKeys"
              :key="k"
              size="small"
              style="margin-right: 4px"
            >
              {{ appLabel(k) }}
            </el-tag>
            <span v-if="!row.appKeys.length" class="cell-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column label="菜单权限" min-width="220">
          <template #default="{ row }">
            <el-tag
              v-for="t in row.menuTitles"
              :key="t"
              size="small"
              type="info"
              style="margin: 2px"
            >
              {{ t }}
            </el-tag>
            <span v-if="!row.menuTitles.length" class="cell-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">查看</el-button>
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button
              link
              type="danger"
              size="small"
              :loading="roleStore.removingId === row.id"
              @click="removeRole(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无角色，点击右上角「新增角色」创建" />
        </template>
      </el-table>
    </PageCard>

    <!-- 新增 / 编辑 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="form.name" placeholder="如：系统管理员" maxlength="20" show-word-limit />
        </el-form-item>
        <el-form-item label="角色标识" prop="code">
          <el-input
            v-model="form.code"
            placeholder="如：sys-admin"
            :disabled="!!editingId"
          />
          <div v-if="editingId" class="form-tip">标识创建后不可修改</div>
        </el-form-item>

        <el-form-item label="可访问子应用" prop="appKeys">
          <el-checkbox-group v-model="form.appKeys" class="app-group">
            <el-checkbox
              v-for="a in appOptions"
              :key="a.value"
              :value="a.value"
              class="app-item"
              border
            >
              <el-icon v-if="a.icon" style="vertical-align: -2px; margin-right: 4px">
                <component :is="a.icon" />
              </el-icon>
              {{ a.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="菜单权限">
          <div class="menu-tree-wrap" v-loading="roleStore.menuTreeLoading">
            <el-empty
              v-if="!form.appKeys.length"
              description="请先勾选可访问子应用，再分配菜单权限"
              :image-size="60"
            />
            <el-tree
              v-else
              ref="treeRef"
              :data="roleStore.menuTree"
              show-checkbox
              node-key="id"
              :check-strictly="true"
              :props="{ label: 'title', children: 'children' }"
            >
              <template #default="{ data }">
                <span>{{ data.title }}</span>
                <el-tag
                  v-if="isRootNode(data)"
                  size="small"
                  type="warning"
                  effect="plain"
                  style="margin-left: 6px"
                >
                  {{ appLabel(data.appKey) }}
                </el-tag>
              </template>
            </el-tree>
            <div v-if="form.appKeys.length" class="form-tip">
              勾选该角色可访问的菜单（按所选子应用过滤，父子独立勾选）
            </div>
          </div>
        </el-form-item>

        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="100" show-word-limit placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="roleStore.saving" @click="submit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 查看详情 -->
    <el-drawer v-model="detailVisible" title="角色详情" size="420px">
      <el-descriptions v-if="detail" :column="1" border>
        <el-descriptions-item label="角色名称">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="角色标识">
          <el-tag size="small" effect="plain">{{ detail.code }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="可访问子应用">
          <el-tag v-for="k in detail.appKeys" :key="k" size="small" style="margin-right: 4px">
            {{ appLabel(k) }}
          </el-tag>
          <span v-if="!detail.appKeys.length" class="cell-empty">-</span>
        </el-descriptions-item>
        <el-descriptions-item label="菜单权限">
          <el-tag
            v-for="t in detail.menuTitles"
            :key="t"
            size="small"
            type="info"
            style="margin: 2px"
          >
            {{ t }}
          </el-tag>
          <span v-if="!detail.menuTitles.length" class="cell-empty">-</span>
        </el-descriptions-item>
        <el-descriptions-item label="描述">{{ detail.description || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatTime(detail.updatedAt) }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<style scoped>
.cell-empty {
  color: var(--el-text-color-secondary);
}
.form-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
}
.app-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.app-item {
  margin-right: 0;
}
.menu-tree-wrap {
  width: 100%;
  min-height: 120px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 8px;
}
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
