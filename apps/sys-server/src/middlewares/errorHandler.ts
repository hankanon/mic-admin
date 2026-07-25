import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { ApiError } from '../errors'
import { fail } from '../response'

/** 包裹路由处理函数，将同步/异步抛出的错误统一交给 next */
export function wrap(
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = handler(req, res, next)
      if (result instanceof Promise) {
        result.catch(next)
      }
    } catch (err) {
      next(err)
    }
  }
}

/** 404 兜底 */
export function notFound(_req: Request, res: Response) {
  fail(res, 40400, '接口不存在')
}

/** 统一异常处理：业务错误、参数校验错误、服务器错误分别映射到约定结构 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    return fail(res, err.code, err.message, err.status)
  }
  if (err instanceof ZodError) {
    const detail = err.errors
      .map((e) => `${e.path.join('.') || '字段'}: ${e.message}`)
      .join('; ')
    return fail(res, 42200, `参数校验失败 - ${detail}`)
  }
  console.error('[Unhandled Error]', err)
  return fail(res, 50000, '服务器内部错误')
}
