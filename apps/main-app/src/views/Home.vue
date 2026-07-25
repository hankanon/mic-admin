<script setup lang="ts">
import { PageCard } from '@mic/components'
import { useUserStore } from '../store/user'

const userStore = useUserStore()
</script>

<template>
  <div class="home">
    <PageCard title="欢迎使用 MIC Admin">
      <p>当前用户：{{ userStore.userInfo?.name || '未登录' }}</p>
      <p>这是一个基于 micro-app 的微前端后台基座演示。左侧菜单可切换到「文档发布」「权限管理」子应用。</p>
    </PageCard>
  </div>
</template>

<style scoped>
.home p {
  line-height: 1.8;
}
</style>
