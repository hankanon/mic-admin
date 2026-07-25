import { createRouter, createWebHashHistory } from 'vue-router'
import { getToken, hasAppPermission } from '@mic/utils'
import { useUserStore } from '../store/user'
import MainLayout from '../layout/MainLayout.vue'
import MicroContainer from '../views/MicroContainer.vue'
import Login from '../views/Login.vue'
import Home from '../views/Home.vue'
import NotFound from '../views/NotFound.vue'

const router = createRouter({
  history: createWebHashHistory('/'),
  routes: [
    { path: '/login', name: 'login', component: Login, meta: { public: true } },
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', name: 'home', component: Home, meta: { title: '首页' } },
        { path: 'doc', name: 'doc', component: MicroContainer, meta: { title: '文档发布' } },
        { path: 'doc/:pathMatch(.*)*', name: 'doc-wild', component: MicroContainer },
        { path: 'sys', name: 'sys', component: MicroContainer, meta: { title: '系统管理' } },
        { path: 'sys/:pathMatch(.*)*', name: 'sys-wild', component: MicroContainer },
        { path: '404', name: 'not-found', component: NotFound },
        { path: ':pathMatch(.*)*', redirect: '/404' },
      ],
    },
  ],
})

/** 根据当前用户权限，返回首个可访问的应用路由或首页 */
function firstAccessiblePath(permissions: string[] | undefined): string {
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
