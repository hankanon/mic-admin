import { createRouter, createWebHistory } from 'vue-router'
import { isMicroEnv, hasToken, getBaseRoute } from '@mic/utils'
import { useUserStore } from '../store/user'
import Login from '../views/Login.vue'
import DataOverview from '../views/DataOverview.vue'
import AccessAnalytics from '../views/AccessAnalytics.vue'
import DocStats from '../views/DocStats.vue'
import UserStats from '../views/UserStats.vue'
import SystemNotice from '../views/SystemNotice.vue'

const router = createRouter({
  // 集成态用基座分配的 baseroute（/），独立运行用 '/'
  history: createWebHistory(getBaseRoute()),
  routes: [
    { path: '/login', name: 'dashboard-login', component: Login, meta: { public: true } },
    { path: '/', name: 'data-overview', component: DataOverview, meta: { title: '数据总览' } },
    { path: '/dashboard/analytics', name: 'access-analytics', component: AccessAnalytics, meta: { title: '访问分析' } },
    { path: '/dashboard/docs-stat', name: 'doc-stats', component: DocStats, meta: { title: '文档统计' } },
    { path: '/dashboard/users-stat', name: 'user-stats', component: UserStats, meta: { title: '用户统计' } },
    { path: '/dashboard/notice', name: 'system-notice', component: SystemNotice, meta: { title: '系统公告' } },
  ],
})

// 独立运行时加登录守卫；微前端环境守卫交给主应用
if (!isMicroEnv()) {
  router.beforeEach((to) => {
    if (!to.meta.public && !hasToken()) {
      return { path: '/login' }
    }
    if (to.path === '/login' && hasToken()) {
      return { path: '/' }
    }
    return true
  })
}

export default router
