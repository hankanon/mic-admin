<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { LoginPage } from '@mic/components'
import { useUserStore } from '../store/user'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)

async function handleSubmit(payload: { username: string; password: string }) {
  loading.value = true
  try {
    await userStore.login(payload)
    router.push('/')
  } catch (err) {
    ElMessage.error((err as Error)?.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-view">
    <LoginPage title="MIC Admin 控制台" :loading="loading" @submit="handleSubmit" />
  </div>
</template>

<style scoped>
.login-view {
  height: 100vh;
}
</style>
