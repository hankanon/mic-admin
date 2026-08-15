import { createRouter, createWebHistory } from 'vue-router'
import { isMicroEnv, hasToken, getBaseRoute } from '@mic/utils'
import { useUserStore } from '../store/user'
import Login from '../views/Login.vue'
import NewSession from '../views/NewSession.vue'
import SessionHistory from '../views/SessionHistory.vue'
import ModelConfig from '../views/ModelConfig.vue'

const router = createRouter({
  // 集成态用基座分配的 baseroute（/qa），独立运行用 '/'
  history: createWebHistory(getBaseRoute()),
  routes: [
    { path: '/login', name: 'qa-login', component: Login, meta: { public: true } },
    { path: '/new', name: 'new-session', component: NewSession, meta: { title: '新建会话' } },
    { path: '/history', name: 'session-history', component: SessionHistory, meta: { title: '历史会话' } },
    { path: '/config', name: 'model-config', component: ModelConfig, meta: { title: '模型配置' } },
    { path: '', redirect: '/new' },
  ],
})

// 独立运行时加登录守卫；微前端环境守卫交给主应用
if (!isMicroEnv()) {
  router.beforeEach((to) => {
    if (!to.meta.public && !hasToken()) {
      return { path: '/login' }
    }
    if (to.path === '/login' && hasToken()) {
      return { path: '/new' }
    }
    return true
  })
}

export default router
