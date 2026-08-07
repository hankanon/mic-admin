import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { isMicroEnv, hasToken, getBaseRoute } from '@mic/utils'
import { useUserStore } from '../store/user'
import Login from '../views/Login.vue'
import DocList from '../views/DocList.vue'
import DocPublish from '../views/DocPublish.vue'
import DocEdit from '../views/DocEdit.vue'
import DocDetail from '../views/DocDetail.vue'
import { verifyDetailAccess } from './detailAccess'

const router = createRouter({
  // 集成态用基座分配的 baseroute，独立运行用 '/'；iframe 沙箱下子应用须用 history 路由，
  // 避免与基座 hash 路由冲突导致基座菜单切换无法同步到子应用
  history: createWebHistory(getBaseRoute()),
  routes: [
    { path: '/login', name: 'doc-login', component: Login, meta: { public: true } },
    { path: '/list', name: 'doc-list', component: DocList, meta: { title: '文档列表' } },
    { path: '/publish', name: 'doc-publish', component: DocPublish, meta: { title: '发布管理' } },
    { path: '/edit', name: 'doc-edit-new', component: DocEdit, meta: { title: '新增文档' } },
    { path: '/edit/:id', name: 'doc-edit', component: DocEdit, meta: { title: '编辑文档' } },
    { path: '/detail/:id', name: 'doc-detail', component: DocDetail, meta: { title: '文章详情' } },
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

// 文章详情页严格访问控制：仅允许从文档列表进入，禁止直接 URL / 菜单 / 页签进入
router.beforeEach((to, from) => {
  if (to.name !== 'doc-detail') return true
  const id = Number(to.params.id)
  const fromName = typeof from.name === 'string' ? from.name : undefined
  if (!verifyDetailAccess(id, fromName)) {
    ElMessage.error('无权限访问，请通过文档列表进入')
    return { name: 'doc-list' }
  }
  return true
})

export default router
