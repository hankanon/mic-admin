/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_DOC_APP_URL: string
  readonly VITE_SYS_APP_URL: string
  readonly VITE_SYS_SERVER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
