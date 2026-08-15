import { createRouter, createWebHistory } from 'vue-router'
import { isMicroEnv, hasToken, getBaseRoute } from '@mic/utils'
import { useUserStore } from '../store/user'
import Login from '../views/Login.vue'
import PersonalView from '../views/PersonalView.vue'
import TodoList from '../views/TodoList.vue'

const router = createRouter({
  // 集成态用基座分配的 baseroute（/profile），独立运行用 '/'
  history: createWebHistory(getBaseRoute()),
  routes: [
    { path: '/login', name: 'profile-login', component: Login, meta: { public: true } },
    { path: '/view', name: 'personal-view', component: PersonalView, meta: { title: '个人视图' } },
    { path: '/todo', name: 'todo-list', component: TodoList, meta: { title: '待办事项' } },
    { path: '', redirect: '/view' },
  ],
})

// 独立运行时加登录守卫；微前端环境守卫交给主应用
if (!isMicroEnv()) {
  router.beforeEach((to) => {
    if (!to.meta.public && !hasToken()) {
      return { path: '/login' }
    }
    if (to.path === '/login' && hasToken()) {
      return { path: '/view' }
    }
    return true
  })
}

export default router
