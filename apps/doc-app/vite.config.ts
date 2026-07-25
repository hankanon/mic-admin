import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE || '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3001,
    host: true,
    // 允许主应用跨域拉取资源
    cors: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
  preview: {
    port: 3001,
    host: true,
    // 生产预览下同样允许基座跨域加载子应用资源
    cors: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
  optimizeDeps: {
    exclude: ['@mic/components', '@mic/utils'],
  },
})
