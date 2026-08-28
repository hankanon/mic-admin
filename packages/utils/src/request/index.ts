import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { ElMessage } from 'element-plus'
import { getToken, getRefreshToken, setTokens } from '../auth'
import { isMicroEnv } from '../micro/env'
import { emitToMain } from '../micro/bridge'

export interface RequestOptions {
  baseURL?: string
  /** 401 / 未授权时的回调，应用可注入跳转逻辑 */
  onUnauthorized?: () => void
  /** 是否自动用 ElMessage 提示业务错误，默认 true */
  showError?: boolean
}

export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

const pendingMap = new Map<string, AbortController>()

function getPendingKey(config: AxiosRequestConfig): string {
  return [config.method, config.url, JSON.stringify(config.params), JSON.stringify(config.data)].join('&')
}

function addPending(config: AxiosRequestConfig): void {
  const key = getPendingKey(config)
  if (pendingMap.has(key)) {
    pendingMap.get(key)?.abort()
  }
  const controller = new AbortController()
  config.signal = controller.signal
  pendingMap.set(key, controller)
}

function removePending(config: AxiosRequestConfig): void {
  const key = getPendingKey(config)
  pendingMap.delete(key)
}

class HttpClient {
  instance: AxiosInstance
  private onUnauthorized?: () => void
  private showError: boolean

  constructor(options: RequestOptions = {}) {
    this.showError = options.showError ?? true
    this.onUnauthorized = options.onUnauthorized

    this.instance = axios.create({
      baseURL: options.baseURL ?? import.meta.env.VITE_API_BASE_URL ?? '/api',
      timeout: 15000,
    })

    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        addPending(config)
        const token = getToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error),
    )

    this.instance.interceptors.response.use(
      (response: AxiosResponse<ApiResult>) => {
        removePending(response.config)
        const res = response.data
        // 约定后端返回结构 { code, message, data }，code === 0 为成功
        if (res && typeof res.code === 'number' && res.code !== 0) {
          if (this.showError) ElMessage.error(res.message || '请求失败')
          return Promise.reject(new Error(res.message || 'Error'))
        }
        return response
      },
      (error) => {
        removePending(error.config || {})
        if (axios.isCancel(error)) return Promise.reject(error)
        const status = error.response?.status
        if (status === 401) {
          const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
          const url = config?.url ?? ''
          // 登录/刷新接口本身的 401 不做无感刷新（无 refresh 或已失效）
          const isAuthEndpoint = url.includes('/auth/refresh') || url.includes('/users/login')
          if (config && !config._retried && !isAuthEndpoint) {
            config._retried = true
            // 无感刷新：单飞换新 access → 重放原请求；刷新失败走登出流程
            return silentRefresh()
              .then((token) => {
                config.headers = config.headers ?? {}
                config.headers.Authorization = `Bearer ${token}`
                return this.instance(config)
              })
              .catch(() => {
                this.handleUnauthorized()
                return Promise.reject(error)
              })
          }
          this.handleUnauthorized()
        } else if (this.showError) {
          ElMessage.error(error.response?.data?.message || error.message || '网络异常')
        }
        return Promise.reject(error)
      },
    )
  }

  private handleUnauthorized(): void {
    // 集成运行：通知主应用跳转登录；独立运行：调用应用注入的回调
    if (isMicroEnv()) {
      emitToMain({ type: 'unauthorized' })
    } else if (this.onUnauthorized) {
      this.onUnauthorized()
    } else {
      ElMessage.error('登录已过期，请重新登录')
    }
  }

  setUnauthorizedHandler(handler: () => void): void {
    this.onUnauthorized = handler
  }

  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    return this.instance.get(url, config).then((r) => r.data)
  }

  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    return this.instance.post(url, data, config).then((r) => r.data)
  }

  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    return this.instance.put(url, data, config).then((r) => r.data)
  }

  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    return this.instance.delete(url, config).then((r) => r.data)
  }
}

/** 默认请求实例（baseURL 取环境变量，可选注入 onUnauthorized） */
export const request = new HttpClient()

export function createRequest(options?: RequestOptions): HttpClient {
  return new HttpClient(options)
}

/**
 * 判断错误是否为请求取消（axios isCancel）。
 * 请求层对相同 key 的在途请求做去重（addPending 会 abort 旧请求），
 * 被取代的请求以 CanceledError 拒绝，调用方需用此工具区分「主动取消」与「真实失败」。
 */
export const isCancel = axios.isCancel

// ---- 无感刷新：access 过期后经 refresh token 换新并重放原请求 ----

/** 刷新专用实例：不走主实例拦截器（避免 401 → 刷新 → 401 循环） */
const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 15000,
})

/** 刷新令牌对结构（与后端 /auth/refresh 返回一致） */
interface RefreshResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/** 单飞刷新锁：并发多个 401 只发起一次刷新请求，其余复用同一 Promise */
let refreshPromise: Promise<string> | null = null

/**
 * 静默刷新 access token（单飞）。
 * 成功后更新本地令牌对并返回新 access；失败抛出（调用方负责登出/兜底）。
 * 注意：刷新失败时后端会吊销该 refresh，此处返回的拒绝即为最终状态。
 */
export function silentRefresh(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken()
      if (!refreshToken) throw new Error('无刷新令牌，请重新登录')
      const res = await refreshClient.post<ApiResult<RefreshResult>>('/auth/refresh', {
        refreshToken,
      })
      const body = res.data
      if (!body || body.code !== 0) throw new Error(body?.message || '刷新令牌失败')
      setTokens(body.data.accessToken, body.data.refreshToken)
      return body.data.accessToken
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export default request
