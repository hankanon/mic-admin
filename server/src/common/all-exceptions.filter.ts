import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common'
import type { Response } from 'express'
import { ZodError } from 'zod'
import { ApiError } from './errors'

/**
 * 统一异常过滤器：将业务错误 / 参数校验错误 / 标准 HttpException / 未知错误
 * 映射为与原 sys-server 一致的响应结构：
 *   { code, message, data: null }
 * 约定 code !== 0 为失败，与前端 @mic/utils 的 request 拦截器一致。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()

    if (exception instanceof ApiError) {
      return res
        .status(exception.status)
        .json({ code: exception.code, message: exception.message, data: null })
    }

    if (exception instanceof ZodError) {
      const detail = exception.errors
        .map((e) => `${e.path.join('.') || '字段'}: ${e.message}`)
        .join('; ')
      return res.status(200).json({ code: 42200, message: `参数校验失败 - ${detail}`, data: null })
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      // 未匹配路由：统一提示「接口不存在」，业务码 40400
      if (exception instanceof NotFoundException) {
        return res.status(404).json({ code: 40400, message: '接口不存在', data: null })
      }
      const payload = exception.getResponse()
      const message =
        typeof payload === 'string'
          ? payload
          : (payload as { message?: string | string[] }).message
      return res.status(status).json({
        code: status * 100,
        message: Array.isArray(message) ? message.join('; ') : message ?? exception.message,
        data: null,
      })
    }

    console.error('[Unhandled Error]', exception)
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ code: 50000, message: '服务器内部错误', data: null })
  }
}
