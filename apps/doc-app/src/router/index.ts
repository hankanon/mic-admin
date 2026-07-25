import { createRouter, createWebHistory } from 'vue-router'
import { isMicroEnv, hasToken, getBaseRoute } from '@mic/utils'
import { useUserStore } from '../store/user'
import Login from '../views/Login.vue'
import DocList from '../views/DocList.vue'
import DocPublish from '../views/DocPublish.vue'

const router = createRouter({
  // 集成态用基座分配的 baseroute，独立运行用 '/'；iframe 沙箱下子应用须用 history 路由，
  // 避免与基座 hash 路由冲突导致基座菜单切换无法同步到子应用
  history: createWebHistory(getBaseRoute()),
  routes: [
    { path: '/login', name: 'doc-login', component: Login, meta: { public: true } },
    { path: '/list', name: 'doc-list', component: DocList, meta: { title: '文档列表' } },
    { path: '/publish', name: 'doc-publish', component: DocPublish, meta: { title: '发布管理' } },
    { path: '', redirect: '/list' },
  ],
})

// 独立运行时加登录守卫；微前端环境守卫交给主应用
if (!isMicroEnv()) {
  router.beforeEach((to) => {
    if (!to.meta.public && !hasToken()) {
      return { path: '/login' }
    }
    if (to.path === '/login' && hasToken()) {
      return { path: '/list' }
    }
    return true
  })
}

export default router
