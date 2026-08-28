<script setup lang="ts">
defineOptions({ name: 'RoleManage' })
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { PageCard, menuConfig } from '@mic/components'
import { MENU_PERMISSIONS, ROLE_PERMISSIONS, USER_PERMISSIONS } from '@mic/utils'
import { useRoleStore } from '../store/role'
import type {
  AppKey,
  MenuPermissionMap,
  PermissionOption,
  RolePayload,
  RoleView,
} from '../types'

/**
 * 菜单可授权的按钮权限点：菜单 path → 按钮点列表。
 * 与后端 server/src/common/permissions.ts 的 MENU_PERMISSION_OPTIONS 一一对应。
 */
const MENU_BUTTON_OPTIONS: Record<string, PermissionOption[]> = {
  '/sys/menu': [
    { code: MENU_PERMISSIONS.create, label: '新增' },
    { code: MENU_PERMISSIONS.update, label: '编辑' },
    { code: MENU_PERMISSIONS.remove, label: '删除' },
  ],
  '/sys/role': [
    { code: ROLE_PERMISSIONS.create, label: '新增' },
    { code: ROLE_PERMISSIONS.update, label: '编辑' },
    { code: ROLE_PERMISSIONS.remove, label: '删除' },
  ],
  '/sys/user': [
    { code: USER_PERMISSIONS.create, label: '新增' },
    { code: USER_PERMISSIONS.update, label: '编辑' },
    { code: USER_PERMISSIONS.remove, label: '删除' },
  ],
}

/** 取该菜单节点可授权的按钮点（无则返回空） */
function buttonOptionsOf(node: { path?: string }): PermissionOption[] {
  return node.path ? MENU_BUTTON_OPTIONS[node.path] ?? [] : []
}

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
  menuPermissions: {},
  description: '',
})

/** 当前编辑角色在各菜单下勾选的按钮权限点 */
const checkedButtons = ref<MenuPermissionMap>({})

/** 某菜单的按钮权限点是否已被勾选 */
function isButtonChecked(menuId: number, code: string): boolean {
  return !!checkedButtons.value[menuId]?.includes(code)
}

/** 勾选/取消某菜单下的一个按钮权限点 */
function toggleButton(menuId: number, code: string, checked: boolean): void {
  const cur = new Set(checkedButtons.value[menuId] ?? [])
  if (checked) cur.add(code)
  else cur.delete(code)
  if (cur.size) checkedButtons.value[menuId] = [...cur]
  else delete checkedButtons.value[menuId]
}

/** 全选/取消某菜单下的全部按钮权限点 */
function toggleAllButtons(menuId: number, path: string | undefined, checked: boolean): void {
  const opts = buttonOptionsOf({ path })
  if (!opts.length) return
  if (checked) checkedButtons.value[menuId] = opts.map((o) => o.code)
  else delete checkedButtons.value[menuId]
}

/** 该菜单的按钮权限点是否全部勾选（用于全选复选框的 indeterminate 态） */
function buttonCheckState(menuId: number, path: string | undefined): {
  all: boolean
  indeterminate: boolean
} {
  const opts = buttonOptionsOf({ path })
  if (!opts.length) return { all: false, indeterminate: false }
  const cur = checkedButtons.value[menuId] ?? []
  const hit = opts.filter((o) => cur.includes(o.code)).length
  return { all: hit === opts.length, indeterminate: hit > 0 && hit < opts.length }
}

/**
 * 提交时只保留「已勾选菜单」的按钮权限点：
 * 未勾选菜单若残留按钮点会导致权限集合中出现无入口的孤儿权限。
 */
function collectMenuPermissions(menuIds: number[]): MenuPermissionMap {
  const allowed = new Set(menuIds)
  const out: MenuPermissionMap = {}
  for (const [id, codes] of Object.entries(checkedButtons.value)) {
    if (allowed.has(Number(id)) && codes?.length) out[id] = codes
  }
  return out
}

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

/** 菜单树加载序号：拦截被取代的旧加载，避免其完成后覆盖新状态 */
let menuTreeSeq = 0

async function loadMenuTree(keys: AppKey[]) {
  const seq = ++menuTreeSeq
  await roleStore.fetchMenuTree(keys)
  if (seq !== menuTreeSeq) return
  await nextTick()
  treeRef.value?.setCheckedKeys(form.menuIds)
}

function resetForm() {
  Object.assign(form, {
    name: '',
    code: '',
    appKeys: [],
    menuIds: [],
    menuPermissions: {},
    description: '',
  })
  checkedButtons.value = {}
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
    menuPermissions: { ...(row.menuPermissions ?? {}) },
    description: row.description ?? '',
  })
  // 回显按钮权限点（深拷贝，避免编辑中途取消污染原数据）
  checkedButtons.value = Object.fromEntries(
    Object.entries(row.menuPermissions ?? {}).map(([k, v]) => [k, [...v]]),
  )
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
      menuPermissions: collectMenuPermissions(menuIds),
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

// ---------------- 菜单权限树形展示 ----------------
interface MenuTreeNode {
  id: number
  title: string
  appKey: AppKey
  depth: number
  children: MenuTreeNode[]
}

/** 将角色的菜单权限按子应用分组并构建层级树 */
function roleMenuGroups(
  role: RoleView,
): { appKey: AppKey; label: string; roots: MenuTreeNode[] }[] {
  const list = role.menus || []
  const byApp = new Map<AppKey, { id: number; title: string; parentId: number; appKey: AppKey }[]>()
  for (const m of list) {
    if (!byApp.has(m.appKey)) byApp.set(m.appKey, [])
    byApp.get(m.appKey)!.push(m)
  }
  const groups: { appKey: AppKey; label: string; roots: MenuTreeNode[] }[] = []
  for (const [appKey, items] of byApp) {
    const map = new Map<number, MenuTreeNode>()
    items.forEach((m) =>
      map.set(m.id, { id: m.id, title: m.title, appKey, depth: 0, children: [] }),
    )
    const roots: MenuTreeNode[] = []
    for (const m of items) {
      const node = map.get(m.id)!
      const parent = map.get(m.parentId)
      if (parent && m.parentId !== 0) parent.children.push(node)
      else roots.push(node)
    }
    const setDepth = (ns: MenuTreeNode[], d: number) =>
      ns.forEach((n) => {
        n.depth = d
        setDepth(n.children, d + 1)
      })
    setDepth(roots, 0)
    groups.push({ appKey, label: appLabel(appKey), roots })
  }
  return groups
}

/** 详情展示：把 menuPermissions 拍平为「菜单名 · 按钮」标签 */
function buttonPermissionTags(role: RoleView): string[] {
  const titleById = new Map((role.menus || []).map((m) => [m.id, m.title]))
  return Object.entries(role.menuPermissions ?? {}).flatMap(([menuId, codes]) => {
    const prefix = titleById.get(Number(menuId))
    return (codes ?? []).map((c) => (prefix ? `${prefix} · ${c}` : c))
  })
}

/** 先序拍平树，便于模板按层级缩进渲染 */
function flattenMenuNodes(nodes: MenuTreeNode[]): MenuTreeNode[] {
  const out: MenuTreeNode[] = []
  const walk = (ns: MenuTreeNode[]) =>
    ns.forEach((n) => {
      out.push(n)
      walk(n.children)
    })
  walk(nodes)
  return out
}
</script>

<template>
  <div>
    <PageCard title="角色管理">
      <template #extra>
        <el-button size="small" :loading="roleStore.loading" @click="roleStore.fetchRoles()">
          刷新
        </el-button>
        <el-button
          v-permission="ROLE_PERMISSIONS.create"
          type="primary"
          size="small"
          @click="openCreate"
        >
          新增角色
        </el-button>
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
        <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">查看</el-button>
            <el-button
              v-permission="ROLE_PERMISSIONS.update"
              link
              type="primary"
              size="small"
              @click="openEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-permission="ROLE_PERMISSIONS.remove"
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
                <!-- 按钮级权限：该菜单声明了可授权按钮时，展开为操作勾选区 -->
                <span
                  v-if="buttonOptionsOf(data).length"
                  class="btn-perm"
                  @click.stop
                >
                  <el-checkbox
                    :model-value="buttonCheckState(data.id, data.path).all"
                    :indeterminate="buttonCheckState(data.id, data.path).indeterminate"
                    size="small"
                    @change="(v: boolean) => toggleAllButtons(data.id, data.path, v)"
                  >
                    全选
                  </el-checkbox>
                  <el-checkbox
                    v-for="opt in buttonOptionsOf(data)"
                    :key="opt.code"
                    :model-value="isButtonChecked(data.id, opt.code)"
                    size="small"
                    @change="(v: boolean) => toggleButton(data.id, opt.code, v)"
                  >
                    {{ opt.label }}
                  </el-checkbox>
                </span>
              </template>
            </el-tree>
            <div v-if="form.appKeys.length" class="form-tip">
              勾选该角色可访问的菜单（按所选子应用过滤，勾选父级自动包含其下子菜单）；
              带「全选 / 新增 / 编辑 / 删除」的菜单可进一步授权按钮级操作权限
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
    <el-drawer v-model="detailVisible" title="角色详情" size="560px">
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
          <div v-if="detail && roleMenuGroups(detail).length" class="role-menu-cells">
            <div v-for="g in roleMenuGroups(detail)" :key="g.appKey" class="menu-group-cell">
              <el-tag size="small" type="warning" effect="plain" class="menu-group-tag">
                {{ g.label }}
              </el-tag>
              <div class="menu-tree-list">
                <div
                  v-for="n in flattenMenuNodes(g.roots)"
                  :key="n.id"
                  class="menu-tree-node"
                  :style="{ paddingLeft: n.depth * 14 + 4 + 'px' }"
                >
                  <span v-if="n.depth > 0" class="tree-prefix">└ </span>{{ n.title }}
                </div>
              </div>
            </div>
          </div>
          <span v-else class="cell-empty">-</span>
        </el-descriptions-item>
        <el-descriptions-item label="按钮权限">
          <div v-if="detail && buttonPermissionTags(detail).length" class="btn-perm-cells">
            <el-tag
              v-for="t in buttonPermissionTags(detail)"
              :key="t"
              size="small"
              type="success"
              effect="plain"
              style="margin: 0 4px 4px 0"
            >
              {{ t }}
            </el-tag>
          </div>
          <span v-else class="cell-empty">-</span>
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
/* 菜单权限树形展示 */
.role-menu-cells {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.menu-group-cell {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 6px;
}
.menu-group-tag {
  flex: none;
  margin-top: 2px;
}
.menu-tree-list {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.menu-tree-node {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}
.tree-prefix {
  color: var(--el-text-color-secondary);
}
/* 菜单树节点内的按钮级权限勾选区 */
.btn-perm {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  margin-left: 12px;
  padding-left: 10px;
  border-left: 1px solid var(--el-border-color-lighter);
}
.btn-perm :deep(.el-checkbox) {
  margin-right: 0;
}
.btn-perm :deep(.el-checkbox__label) {
  padding-left: 4px;
  font-size: 12px;
}
</style>
