import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // micro-app 自定义元素，避免 Vue 解析报错
          isCustomElement: (tag) => tag.startsWith('micro-app'),
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  // 公共包以源码形式消费，排除预构建以避免 ESM 解析问题
  optimizeDeps: {
    exclude: ['@mic/components', '@mic/utils'],
  },
})
