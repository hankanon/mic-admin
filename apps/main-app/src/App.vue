<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <!-- 缓存 MainLayout：登录/登出切换时保持其存活（含全部子应用 iframe），
       避免 MicroContainer 卸载触发 micro-app iframe 沙箱清理崩溃（Invalid URL）与状态残留 -->
  <router-view v-slot="{ Component }">
    <keep-alive :include="['MainLayout']">
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>
