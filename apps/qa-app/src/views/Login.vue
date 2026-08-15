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
    router.push('/new')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="qa-login">
    <LoginPage title="智能问答" :loading="loading" @submit="handleSubmit" />
  </div>
</template>

<style scoped>
.qa-login {
  height: 100vh;
}
</style>
