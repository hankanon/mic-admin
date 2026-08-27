<script setup lang="ts">
defineOptions({ name: 'UserManage' })
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { PageCard } from '@mic/components'
import { userApi } from '../api/user'
import { roleApi } from '../api/role'
import type { RoleView, UserPayload, UserView } from '../types'

const loading = ref(false)
const users = ref<UserView[]>([])
const roleOptions = ref<RoleView[]>([])

async function fetchUsers() {
  loading.value = true
  try {
    users.value = await userApi.list()
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  await fetchUsers()
  roleOptions.value = await roleApi.list()
})

// ---------------- 查询条件 ----------------
interface Query {
  keyword: string
  status: '' | 'active' | 'disabled'
  roleId: number | ''
}
const defaultQuery = (): Query => ({ keyword: '', status: '', roleId: '' })
const query = ref<Query>(defaultQuery())
/** 点击「查询」后才生效的条件快照 */
const activeQuery = ref<Query>(defaultQuery())

const filteredUsers = computed(() => {
  const q = activeQuery.value
  const kw = q.keyword.trim().toLowerCase()
  return users.value.filter((u) => {
    if (kw && !(u.username.toLowerCase().includes(kw) || u.name.toLowerCase().includes(kw))) return false
    if (q.status && u.status !== q.status) return false
    if (q.roleId && !u.roleIds.includes(q.roleId)) return false
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

// ---- 弹窗 ----
const dialogVisible = ref(false)
const dialogTitle = ref('')
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const form = reactive<UserPayload>({
  username: '',
  name: '',
  email: '',
  phone: '',
  status: 'active',
  roleIds: [],
  password: '',
})

const rules = computed<FormRules>(() => ({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_]+$/, message: '只能包含字母、数字和下划线', trigger: 'blur' },
  ],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  phone: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }],
  password: editingId.value
    ? []
    : [
        { required: true, message: '请输入登录密码', trigger: 'blur' },
        { min: 1, max: 100, message: '密码长度 1-100', trigger: 'blur' },
      ],
}))

function openCreate() {
  editingId.value = null
  dialogTitle.value = '新增人员'
  Object.assign(form, { username: '', name: '', email: '', phone: '', status: 'active', roleIds: [], password: '' })
  dialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

function openEdit(row: UserView) {
  editingId.value = row.id
  dialogTitle.value = '编辑人员'
  Object.assign(form, {
    username: row.username,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    status: row.status,
    roleIds: [...row.roleIds],
    password: '',
  })
  dialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

async function submit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    const payload: UserPayload = {
      username: form.username,
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      status: form.status,
      roleIds: form.roleIds,
    }
    // 编辑时仅当填写了密码才更新；新增时密码必填（由 rules 保证）
    if (form.password) payload.password = form.password
    try {
      if (editingId.value) {
        await userApi.update(editingId.value, payload)
        ElMessage.success('更新成功')
      } else {
        await userApi.create(payload)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      await fetchUsers()
    } catch {
      /* 业务错误已由 request 拦截器统一提示 */
    }
  })
}

async function removeUser(row: UserView) {
  try {
    await ElMessageBox.confirm(`确认删除人员「${row.name}」？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    await userApi.remove(row.id)
    ElMessage.success('删除成功')
    await fetchUsers()
  } catch {
    /* 业务错误已由拦截器提示 */
  }
}
</script>

<template>
  <div>
    <PageCard title="人员管理">
      <template #extra>
        <el-button type="primary" size="small" @click="openCreate">新增人员</el-button>
      </template>

      <!-- 查询条件 -->
      <el-form :model="query" inline class="search-form" @submit.prevent="handleSearch">
        <el-form-item label="关键词">
          <el-input
            v-model="query.keyword"
            placeholder="用户名 / 姓名"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px" @change="handleSearch">
            <el-option label="正常" value="active" />
            <el-option label="停用" value="disabled" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="query.roleId" placeholder="全部" clearable style="width: 160px" @change="handleSearch">
            <el-option v-for="r in roleOptions" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="filteredUsers" border v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="email" label="邮箱" min-width="200" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '正常' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="角色" min-width="200">
          <template #default="{ row }">
            <el-tag
              v-for="r in row.roleNames"
              :key="r"
              size="small"
              type="primary"
              style="margin: 2px"
            >
              {{ r }}
            </el-tag>
            <span v-if="!row.roleNames.length">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="removeUser(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </PageCard>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="登录用户名" autocomplete="username" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" autocomplete="off" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入邮箱" autocomplete="off" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="可选" autocomplete="tel" />
        </el-form-item>
        <el-form-item label="登录密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="editingId ? '留空表示不修改密码' : '请输入登录密码'"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="active">正常</el-radio>
            <el-radio value="disabled">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="分配角色">
          <el-select v-model="form.roleIds" multiple style="width: 100%" placeholder="请选择角色">
            <el-option v-for="r in roleOptions" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
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
