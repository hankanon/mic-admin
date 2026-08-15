export interface MicroAppItem {
  name: string
  url: string
  baseroute: string
  appKey: 'dashboard' | 'doc' | 'profile' | 'qa' | 'sys'
}

/** 子应用注册表（配置化） */
export const microApps: MicroAppItem[] = [
  {
    name: 'dashboard-app',
    url: import.meta.env.VITE_DASHBOARD_APP_URL,
    baseroute: '/dashboard',
    appKey: 'dashboard',
  },
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
  {
    name: 'profile-app',
    url: import.meta.env.VITE_PROFILE_APP_URL,
    baseroute: '/profile',
    appKey: 'profile',
  },
  {
    name: 'qa-app',
    url: import.meta.env.VITE_QA_APP_URL,
    baseroute: '/qa',
    appKey: 'qa',
  },
]

export function getMicroApp(name: string): MicroAppItem | undefined {
  return microApps.find((a) => a.name === name)
}
