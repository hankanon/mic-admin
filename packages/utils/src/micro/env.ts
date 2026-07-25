/** 是否运行在 micro-app 微前端环境中 */
export function isMicroEnv(): boolean {
  return (window as any).__MICRO_APP_ENVIRONMENT__ === true
}

/** 微前端环境下主应用分配的 baseroute，独立运行时为 '/' */
export function getBaseRoute(): string {
  return isMicroEnv() ? (window as any).__MICRO_APP_BASE_ROUTE__ || '/' : '/'
}

/** 子应用 appName（micro-app 注入），独立运行时为空 */
export function getMicroAppName(): string | undefined {
  return (window as any).__MICRO_APP_NAME__
}
