import type { Pool, RowDataPacket } from 'mysql2/promise'

/**
 * 生成 IN (...) 占位符片段。
 * 多处查询重复 `ids.map(() => '?').join(',')` 逻辑，统一收敛避免遗漏空格/逗号。
 * 空数组安全返回 `NULL`（合法 SQL：IN (NULL) 匹配为空，避免 `IN ()` 语法错误）。
 */
export function buildInClause(ids: unknown[]): { clause: string; params: unknown[] } {
  if (!ids.length) return { clause: 'NULL', params: [] }
  return {
    clause: ids.map(() => '?').join(', '),
    params: ids,
  }
}

/** 用 IN 占位符封装查询：组装 `WHERE col IN (?, ? ...)` 并返回结果行 */
export async function queryIn<T extends RowDataPacket>(
  pool: Pool,
  column: string,
  ids: number[],
  sql: string,
): Promise<[T[], unknown]> {
  const { clause, params } = buildInClause(ids)
  return pool.query<T[]>(sql.replace('__IN__', `(${clause})`), params)
}
