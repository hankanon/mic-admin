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
    router.push('/list')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="doc-login">
    <LoginPage title="文档发布系统" :loading="loading" @submit="handleSubmit" />
  </div>
</template>

<style scoped>
.doc-login {
  height: 100vh;
}
</style>
