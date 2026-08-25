import type { Response } from 'express'

export interface ApiResult<T> {
  code: number
  message: string
  data: T
}

/** 成功响应：约定 code === 0 为成功，与前端 @mic/utils 的 request 拦截器一致 */
export function ok<T>(res: Response, data: T, message = 'ok'): void {
  res.json({ code: 0, message, data })
}

/** 失败响应：code !== 0，由前端拦截器提示 message */
export function fail(
  res: Response,
  code: number,
  message: string,
  status = 200,
): void {
  res.status(status).json({ code, message, data: null })
}
