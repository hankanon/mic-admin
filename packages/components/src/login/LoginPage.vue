<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { SWITCHABLE_ACCOUNTS, DEMO_PASSWORD } from '@mic/utils'

interface LoginForm {
  username: string
  password: string
  remember: boolean
}

const props = withDefaults(
  defineProps<{
    title?: string
    loading?: boolean
  }>(),
  { title: 'MIC Admin 后台管理', loading: false },
)

const emit = defineEmits<{
  (e: 'submit', payload: LoginForm): void
}>()

const formRef = ref()
const form = reactive<LoginForm>({
  username: '',
  password: '',
  remember: true,
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    ElMessage.warning('请填写完整的登录信息')
    return
  }
  emit('submit', { ...form })
}

/** 演示账号一键登录 */
function quickLogin(username: string) {
  form.username = username
  form.password = DEMO_PASSWORD
  handleSubmit()
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-page__card" shadow="always">
      <div class="login-page__title">{{ title }}</div>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleSubmit">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="'User'" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            show-password
            :prefix-icon="'Lock'"
          />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="form.remember">记住我</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="login-page__btn" :loading="loading" @click="handleSubmit">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
      <div class="login-page__demo">
        <span class="login-page__demo-label">演示账号：</span>
        <el-tag
          v-for="acc in SWITCHABLE_ACCOUNTS"
          :key="acc.username"
          class="login-page__demo-tag"
          type="info"
          effect="plain"
          @click="quickLogin(acc.username)"
        >
          {{ acc.name }}
        </el-tag>
        <div class="login-page__demo-hint">密码均为 12345，点击标签直接登录</div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
}
.login-page__card {
  width: 380px;
  border-radius: 10px;
}
.login-page__title {
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #1e3c72;
}
.login-page__btn {
  width: 100%;
}
.login-page__demo {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px dashed #ebeef5;
}
.login-page__demo-label {
  font-size: 13px;
  color: #888;
  margin-right: 4px;
}
.login-page__demo-tag {
  cursor: pointer;
  margin: 0 6px 6px 0;
}
.login-page__demo-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #aaa;
}

/* 暗黑模式：登录页整体协调与对比度 */
html.dark .login-page {
  background: linear-gradient(135deg, #0b1a33 0%, #14233f 100%);
}
html.dark .login-page__title {
  color: var(--mic-text-inverse);
}
html.dark .login-page__demo {
  border-top-color: var(--mic-border);
}
html.dark .login-page__demo-label,
html.dark .login-page__demo-hint {
  color: var(--mic-text);
}
</style>
