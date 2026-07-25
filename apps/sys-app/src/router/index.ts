import { createRouter, createWebHistory } from 'vue-router'
import { isMicroEnv, hasToken, getBaseRoute } from '@mic/utils'
import { useUserStore } from '../store/user'
import Login from '../views/Login.vue'
import MenuManage from '../views/MenuManage.vue'
import RoleManage from '../views/RoleManage.vue'
import UserManage from '../views/UserManage.vue'

const router = createRouter({
  // 集成态用基座分配的 baseroute，独立运行用 '/'；iframe 沙箱下子应用须用 history 路由，
  // 避免与基座 hash 路由冲突导致基座菜单切换无法同步到子应用
  history: createWebHistory(getBaseRoute()),
  routes: [
    { path: '/login', name: 'sys-login', component: Login, meta: { public: true } },
    { path: '/menu', name: 'sys-menu', component: MenuManage, meta: { title: '菜单管理' } },
    { path: '/role', name: 'sys-role', component: RoleManage, meta: { title: '角色管理' } },
    { path: '/user', name: 'sys-user', component: UserManage, meta: { title: '人员管理' } },
    { path: '', redirect: '/menu' },
  ],
})

if (!isMicroEnv()) {
  router.beforeEach((to) => {
    if (!to.meta.public && !hasToken()) {
      return { path: '/login' }
    }
    if (to.path === '/login' && hasToken()) {
      return { path: '/menu' }
    }
    return true
  })
}

export default router
