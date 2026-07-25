/** 业务错误：携带可返回给前端的 code 与 HTTP status */
export class ApiError extends Error {
  code: number
  status: number
  constructor(message: string, code = 40000, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}
