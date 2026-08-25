import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import type { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface ApiSuccess<T> {
  code: number
  message: string
  data: T
}

/**
 * 统一成功响应拦截器：将 Controller 返回值包装为
 *   { code: 0, message: 'ok', data: <返回值> }
 * 与前端 @mic/utils 的 request 拦截器约定一致（code===0 为成功，业务数据在 data 字段）。
 * 失败响应由 AllExceptionsFilter 单独处理，不在此包装。
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiSuccess<T>> {
    return next.handle().pipe(map((data) => ({ code: 0, message: 'ok', data })))
  }
}
