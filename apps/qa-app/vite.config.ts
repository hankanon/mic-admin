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
    port: 3005,
    host: true,
    cors: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
  preview: {
    port: 3005,
    host: true,
    cors: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
  optimizeDeps: {
    exclude: ['@mic/components', '@mic/utils'],
  },
})
