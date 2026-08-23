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
    router.push('/view')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="profile-login">
    <LoginPage title="个人中心" :loading="loading" @submit="handleSubmit" />
  </div>
</template>

<style scoped>
.profile-login {
  height: 100vh;
}
</style>
