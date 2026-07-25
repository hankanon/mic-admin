<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import AppMenu from '../menu/AppMenu.vue'
import { type MenuItem, matchMenuKey } from '../menu/config'
import { emitToMain, MicroMsgType } from '@mic/utils'
import UserAvatar from '../business/UserAvatar.vue'

const props = withDefaults(
  defineProps<{
    menus: MenuItem[]
    appTitle?: string
    logo?: string
    userInfo?: { name: string; avatar?: string }
    mode?: 'host' | 'standalone'
    accounts?: { username: string; name: string; current?: boolean }[]
  }>(),
  { appTitle: 'MIC Admin', mode: 'host' },
)

const emit = defineEmits<{
  (e: 'logout'): void
  (e: 'switch-account', username: string): void
}>()

const router = useRouter()
const route = useRoute()

const activeMenu = computed(() => matchMenuKey(props.menus, route.fullPath))

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出登录？', '提示', { type: 'warning' })
  } catch {
    return
  }
  // 独立运行：通知主应用（微前端环境有效），并跳转登录
  emitToMain({ type: MicroMsgType.Logout })
  if (props.mode === 'standalone') {
    router.push('/login')
  } else {
    // host：交由主应用处理登出
    emit('logout')
  }
}

function handleCommand(command: string) {
  if (command === '__logout') {
    handleLogout()
  } else {
    emit('switch-account', command)
  }
}
</script>

<template>
  <el-container class="basic-layout">
    <el-aside width="220px" class="basic-layout__aside">
      <div class="basic-layout__logo">
        <img v-if="logo" :src="logo" alt="logo" class="basic-layout__logo-img" />
        <span class="basic-layout__logo-text">{{ appTitle }}</span>
      </div>
      <div class="basic-layout__menu">
        <AppMenu :menus="menus" :active-menu="activeMenu" :mode="mode" />
      </div>
    </el-aside>

    <el-container>
      <el-header class="basic-layout__header">
        <div class="basic-layout__header-title">{{ appTitle }}</div>
        <div class="basic-layout__header-right">
          <el-dropdown v-if="accounts?.length" trigger="click" @command="handleCommand">
            <span class="basic-layout__user-trigger">
              <UserAvatar :name="userInfo?.name || '未登录'" :src="userInfo?.avatar" />
              <span class="basic-layout__caret">▾</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>切换角色</el-dropdown-item>
                <el-dropdown-item
                  v-for="acc in accounts"
                  :key="acc.username"
                  :command="acc.username"
                  :disabled="acc.current"
                >
                  <span>{{ acc.name }}</span>
                  <span v-if="acc.current" class="basic-layout__current-tag">（当前）</span>
                </el-dropdown-item>
                <el-dropdown-item divided command="__logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button v-else text type="primary" @click="handleLogout">退出登录</el-button>
        </div>
      </el-header>

      <el-main class="basic-layout__main">
        <slot />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.basic-layout {
  height: 100vh;
}
.basic-layout__aside {
  background: #001529;
  color: #fff;
  display: flex;
  flex-direction: column;
}
.basic-layout__logo {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  font-weight: 600;
  font-size: 16px;
  color: #fff;
  background: #000c17;
}
.basic-layout__logo-img {
  width: 28px;
  height: 28px;
}
.basic-layout__menu {
  flex: 1;
  overflow-y: auto;
}
.basic-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}
.basic-layout__header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.basic-layout__user-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  outline: none;
}
.basic-layout__caret {
  font-size: 12px;
  color: #999;
}
.basic-layout__current-tag {
  margin-left: 6px;
  color: #2a5298;
  font-size: 12px;
}
.basic-layout__main {
  background: #f0f2f5;
  padding: 16px;
}
</style>
