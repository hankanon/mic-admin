import { createRouter, createWebHashHistory } from 'vue-router'
import { getToken, hasAppPermission } from '@mic/utils'
import { useUserStore } from '../store/user'
import MainLayout from '../layout/MainLayout.vue'
import MicroContainer from '../views/MicroContainer.vue'
import Login from '../views/Login.vue'
import NotFound from '../views/NotFound.vue'

const router = createRouter({
  history: createWebHashHistory('/'),
  routes: [
    { path: '/login', name: 'login', component: Login, meta: { public: true } },
    {
      path: '/',
      component: MainLayout,
      children: [
        // 首页大盘（dashboard-app）：数据总览 / 及子页面（带 /dashboard 前缀）
        { path: '', name: 'dashboard', component: MicroContainer, meta: { title: '首页大盘' } },
        { path: 'dashboard/analytics', name: 'dashboard-analytics', component: MicroContainer },
        { path: 'dashboard/docs-stat', name: 'dashboard-docs', component: MicroContainer },
        { path: 'dashboard/users-stat', name: 'dashboard-users', component: MicroContainer },
        { path: 'dashboard/notice', name: 'dashboard-notice', component: MicroContainer },
        { path: 'doc', name: 'doc', component: MicroContainer, meta: { title: '文档发布' } },
        { path: 'doc/:pathMatch(.*)*', name: 'doc-wild', component: MicroContainer },
        { path: 'sys', name: 'sys', component: MicroContainer, meta: { title: '系统管理' } },
        { path: 'sys/:pathMatch(.*)*', name: 'sys-wild', component: MicroContainer },
        { path: 'profile', name: 'profile', component: MicroContainer, meta: { title: '个人中心' } },
        { path: 'profile/:pathMatch(.*)*', name: 'profile-wild', component: MicroContainer },
        { path: 'qa', name: 'qa', component: MicroContainer, meta: { title: '智能问答' } },
        { path: 'qa/:pathMatch(.*)*', name: 'qa-wild', component: MicroContainer },
        { path: '404', name: 'not-found', component: NotFound },
        { path: ':pathMatch(.*)*', redirect: '/404' },
      ],
    },
  ],
})

/** 根据当前用户权限，返回首个可访问的应用路由或首页 */
function firstAccessiblePath(permissions: string[] | undefined): string {
  // 首页大盘（dashboard）作为公共入口始终可访问
  if (hasAppPermission(permissions, 'doc')) return '/doc'
  if (hasAppPermission(permissions, 'sys')) return '/sys'
  return '/'
}

router.beforeEach((to) => {
  const token = getToken()
  if (!to.meta.public && !token) {
    return '/login'
  }
  if (to.path === '/login' && token) {
    return { path: '/' }
  }
  // 权限守卫：已登录用户访问越权应用（doc/sys）时重定向到首个可访问应用
  if (token) {
    const userStore = useUserStore()
    const appKey = to.path.startsWith('/doc') ? 'doc' : to.path.startsWith('/sys') ? 'sys' : null
    if (appKey && !hasAppPermission(userStore.userInfo?.permissions, appKey)) {
      return { path: firstAccessiblePath(userStore.userInfo?.permissions) }
    }
  }
  return true
})

export default router
