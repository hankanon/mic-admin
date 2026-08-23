import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import microApp from '@micro-zoe/micro-app'
import '@mic/components/theme'
import { initTheme } from '@mic/utils'

import App from './App.vue'
import router from './router'
import { useUserStore } from './store/user'

// 在渲染前应用主题，避免首屏闪烁（localStorage 优先，否则跟随系统偏好）
initTheme()

// 全局开启 iframe 沙箱，解决 Vite ESM 子应用跨域与脚本执行问题
// router-mode 使用 'state'：子应用路由同步写入 history.state 而非 URL query，
// 使基座 URL 保持纯 hash path（不再出现 ?doc-app=...），同时保留菜单切换与刷新恢复能力
microApp.start({ iframe: true, 'router-mode': 'state' })

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component as any)
}

const userStore = useUserStore()
userStore.init()
// 主应用全局下发数据（token / 用户信息），子应用可通过 getData 获取
microApp.setGlobalData({ token: userStore.token, userInfo: userStore.userInfo })

app.mount('#app')
