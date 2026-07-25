import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { ElMessage } from 'element-plus'
import { getToken } from '../auth'
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

export default request
