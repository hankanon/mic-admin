export interface MicroAppItem {
  name: string
  url: string
  baseroute: string
  appKey: 'doc' | 'sys'
}

/** 子应用注册表（配置化） */
export const microApps: MicroAppItem[] = [
  {
    name: 'doc-app',
    url: import.meta.env.VITE_DOC_APP_URL,
    baseroute: '/doc',
    appKey: 'doc',
  },
  {
    name: 'sys-app',
    url: import.meta.env.VITE_SYS_APP_URL,
    baseroute: '/sys',
    appKey: 'sys',
  },
]

export function getMicroApp(name: string): MicroAppItem | undefined {
  return microApps.find((a) => a.name === name)
}
