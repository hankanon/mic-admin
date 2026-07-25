<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { LoginPage } from '@mic/components'
import { useUserStore } from '../store/user'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)

async function handleSubmit(payload: { username: string; password: string }) {
  loading.value = true
  try {
    await userStore.login(payload)
    router.push('/menu')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="sys-login">
    <LoginPage title="系统管理" :loading="loading" @submit="handleSubmit" />
  </div>
</template>

<style scoped>
.sys-login {
  height: 100vh;
}
</style>
