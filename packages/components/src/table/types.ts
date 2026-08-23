import type { TableColumnCtx } from 'element-plus'
import type { VNode } from 'vue'

/** 请求参数：分页 + 排序 + 查询条件 */
export interface ProTableRequestParams {
  /** 当前页，从 1 开始 */
  page: number
  /** 每页条数 */
  pageSize: number
  /** 排序字段 */
  sortProp?: string
  /** 排序方向：ascending | descending | null */
  sortOrder?: 'ascending' | 'descending' | null
  /** 合并的外部查询条件 */
  [key: string]: unknown
}

/** 请求返回结果（兼容两种字段命名） */
export interface ProTableResult<T = any> {
  list?: T[]
  data?: T[]
  total?: number
  /** 兼容后端返回 { records, total } */
  records?: T[]
}

/** 请求函数签名 */
export type ProTableRequest<T = any> = (
  params: ProTableRequestParams,
) => Promise<ProTableResult<T>>

/** 列格式化函数（row 用 any，避免与 el-table-column 原生 formatter 的 DefaultRow 约束冲突） */
export type ColumnFormatter = (
  row: any,
  column: any,
  value: any,
  index: number,
) => string | VNode

/** 列配置项（原生 el-table-column 属性 + 扩展字段） */
export interface ProTableColumn<T = any> {
  /** 字段名；type 为 selection/index/actions 时可省略 */
  prop?: string
  label?: string
  /** 固定列：left / right */
  fixed?: 'left' | 'right' | boolean
  /** 内置类型列 */
  type?: 'default' | 'selection' | 'index' | 'expand' | 'actions'
  /** 是否服务端排序 */
  sortable?: boolean | 'custom'
  /** 自定义渲染函数（未提供 slot 时使用） */
  formatter?: ColumnFormatter
  /** 自定义插槽名；缺省时默认 column-{prop} */
  slot?: string
  /** 是否可见（用于动态列显隐），默认 true */
  visible?: boolean
  /** 是否作为多表头分组列（children 内嵌子列） */
  children?: ProTableColumn<T>[]
  /** 单元格合并函数（仅 root 列生效） */
  spanMethod?: (data: {
    row: any
    column: any
    rowIndex: number
    columnIndex: number
  }) => [number, number] | { rowspan: number; colspan: number }
  /** 透传其余原生 el-table-column 属性（width/minWidth/align/showOverflowTooltip...） */
  [key: string]: unknown
}

/** 分页配置（可被 pagination 对象覆盖的项） */
export interface ProPaginationConfig {
  /** 每页条数选项 */
  pageSizes?: number[]
  /** 布局 */
  layout?: string
  /** 是否带背景 */
  background?: boolean
  /** 是否隐藏总数文本外的部分（极简模式） */
  small?: boolean
  /** 对齐方式 */
  align?: 'left' | 'center' | 'right'
}

/** 工具栏作用域插槽参数 */
export interface ProTableToolbarScope {
  refresh: () => void
  getSelectionRows: () => any[]
  query: Record<string, unknown>
}

/** ProTable 实例暴露的方法 */
export interface ProTableExpose {
  /** 刷新当前页；keepPage=false 时回到第 1 页 */
  refresh: (keepPage?: boolean) => void
  /** 重置查询条件 + 回到第 1 页 + 重新请求 */
  reset: () => void
  /** 合并外部查询条件并重新请求 */
  setQuery: (query: Record<string, unknown>, opts?: { resetPage?: boolean }) => void
  /** 获取当前选中行 */
  getSelectionRows: () => any[]
  /** 清空多选 */
  clearSelection: () => void
  /** 编程式选中/取消 */
  toggleRowSelection: (row: any, selected?: boolean) => void
  /** 当前数据（不含分页壳） */
  getData: () => any[]
}
