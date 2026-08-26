import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import '@mic/components/theme'
import './style.css'
import { initTheme } from '@mic/utils'

import App from './App.vue'
import router from './router'
import { useUserStore } from './store/user'

// 在渲染前应用主题，避免首屏闪烁
initTheme()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component as any)
}

const userStore = useUserStore()
userStore.init()

app.mount('#app')
