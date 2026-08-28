import { ApiError } from './errors'

/**
 * 从 Authorization 头解析 mock token 中的用户 id。
 * token 格式：`mock-token-{userId}-{timestamp}`
 */
export function parseTokenUserId(authorization?: string): number {
  const token = (authorization || '').replace(/^Bearer\s+/i, '')
  const matched = token.match(/^mock-token-(\d+)-\d+$/)
  if (!matched) throw new ApiError('登录已过期，请重新登录', 40100)
  return Number(matched[1])
}
