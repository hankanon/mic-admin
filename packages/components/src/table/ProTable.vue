<script setup lang="ts" generic="T = any">
import { computed, reactive, ref, watch, onMounted, onActivated } from 'vue'
import { ElTableColumn, ElPagination, ElButton, ElIcon } from 'element-plus'
import { Refresh, RefreshRight } from '@element-plus/icons-vue'
import type {
  ProTableColumn,
  ProTableRequest,
  ProTableRequestParams,
  ProTableResult,
  ProPaginationConfig,
  ProTableExpose,
  ProTableToolbarScope,
} from './types'

const props = withDefaults(
  defineProps<{
    /** 数据请求函数（必填） */
    request: ProTableRequest<T>
    /** 列配置 */
    columns?: ProTableColumn<T>[]
    /** 分页配置：false 关闭；对象覆盖默认项 */
    pagination?: boolean | ProPaginationConfig
    /** 是否开启多选列 */
    selection?: boolean
    /** 单选模式（与 selection 互斥，点击行即选中，高亮当前行） */
    singleSelect?: boolean
    /** 行数据的唯一键字段 */
    rowKey?: string
    /** 是否显示工具栏 */
    showToolbar?: boolean
    /** 外部查询条件（变化自动重请求） */
    query?: Record<string, unknown>
    /** 挂载后是否自动请求 */
    autoLoad?: boolean
    /** 分页参数命名风格 */
    pageScope?: 'page' | 'limit'
    /** 每页默认条数 */
    defaultPageSize?: number
  }>(),
  {
    columns: () => [],
    pagination: true,
    selection: false,
    singleSelect: false,
    rowKey: 'id',
    showToolbar: true,
    query: () => ({}),
    autoLoad: true,
    pageScope: 'page',
    defaultPageSize: 10,
  },
)

const emit = defineEmits<{
  'selection-change': [rows: any[]]
  'row-click': [row: any, column: any, event: MouseEvent]
  'sort-change': [data: { prop: string; order: 'ascending' | 'descending' | null }]
  'page-change': [data: { page: number; pageSize: number }]
  loaded: [data: { list: any[]; total: number }]
  error: [err: Error]
}>()

// Element Plus 的 ElTable 是泛型组件，vue-tsc 下 InstanceType 推断不稳定，
// 这里用宽松类型 + 可选链调用其内置方法（clearSelection / getSelectionRows / toggleRowSelection）
const tableRef = ref<{
  clearSelection?: () => void
  getSelectionRows?: () => any[]
  toggleRowSelection?: (row: any, selected?: boolean) => void
}>()

const state = reactive({
  loading: false,
  data: [] as any[],
  total: 0,
  page: 1,
  pageSize: props.defaultPageSize,
  sortProp: '' as string,
  sortOrder: null as 'ascending' | 'descending' | null,
  query: {} as Record<string, unknown>,
  error: null as Error | null,
  // 单选模式下当前高亮行 key
  currentRowKey: null as string | number | null,
})

const visibleColumns = computed(() =>
  props.columns.filter((c) => c.visible !== false),
)

const paginationEnabled = computed(() => props.pagination !== false)

const paginationConfig = computed<Required<Omit<ProPaginationConfig, 'align'>> & { align: string }>(
  () => ({
    pageSizes: [10, 20, 50, 100],
    layout: 'total, sizes, prev, pager, next, jumper',
    background: true,
    small: false,
    align: 'right',
    ...(typeof props.pagination === 'object' ? props.pagination : {}),
  }),
)

/** 构建请求参数（根据 pageScope 映射参数名） */
function buildParams(): ProTableRequestParams {
  const base: ProTableRequestParams = {
    page: state.page,
    pageSize: state.pageSize,
    sortProp: state.sortProp,
    sortOrder: state.sortOrder,
    ...props.query,
    ...state.query,
  }
  if (props.pageScope === 'limit') {
    // 映射为后端常见命名
    ;(base as any).currentPage = state.page
    ;(base as any).limit = state.pageSize
    delete (base as any).page
    delete (base as any).pageSize
  }
  return base
}

async function fetchData(opts: { resetPage?: boolean } = {}) {
  if (opts.resetPage) state.page = 1
  state.loading = true
  state.error = null
  try {
    const res: ProTableResult<T> = await props.request(buildParams())
    const list = res.list ?? res.data ?? res.records ?? []
    state.data = list
    state.total = res.total ?? 0
    emit('loaded', { list, total: state.total })
  } catch (e) {
    const err = e as Error
    state.error = err
    state.data = []
    state.total = 0
    emit('error', err)
  } finally {
    state.loading = false
  }
}

function onPageChange(p: number) {
  state.page = p
  fetchData()
  emit('page-change', { page: p, pageSize: state.pageSize })
}

function onSizeChange(s: number) {
  state.pageSize = s
  state.page = 1
  fetchData()
  emit('page-change', { page: 1, pageSize: s })
}

function onSortChange({
  prop,
  order,
}: {
  prop: string | null
  order: 'ascending' | 'descending' | null
}) {
  state.sortProp = prop ?? ''
  state.sortOrder = order
  fetchData()
  emit('sort-change', { prop: state.sortProp, order })
}

// 弹性列：合并外部 query 变化自动刷新
watch(
  () => props.query,
  () => fetchData({ resetPage: true }),
  { deep: true },
)

onMounted(() => {
  if (props.autoLoad) fetchData()
})
// keep-alive 场景下重新激活时刷新（契合本项目 App.vue keep-alive）
onActivated(() => {
  if (props.autoLoad) fetchData()
})

// ---- 事件透传 ----
function onSelectionChange(rows: any[]) {
  emit('selection-change', rows)
}
function onRowClick(row: any, column: any, event: MouseEvent) {
  if (props.singleSelect) {
    state.currentRowKey = row[props.rowKey]
    emit('row-click', row, column, event)
    return
  }
  emit('row-click', row, column, event)
}

// ---- Expose ----
function refresh(keepPage = true) {
  fetchData({ resetPage: !keepPage })
}
function reset() {
  state.query = {}
  state.page = 1
  fetchData()
}
function setQuery(query: Record<string, unknown>, opts: { resetPage?: boolean } = {}) {
  state.query = { ...state.query, ...query }
  fetchData({ resetPage: opts.resetPage ?? true })
}
function getSelectionRows(): any[] {
  return tableRef.value?.getSelectionRows?.() ?? []
}
function clearSelection() {
  tableRef.value?.clearSelection?.()
}
function toggleRowSelection(row: any, selected?: boolean) {
  tableRef.value?.toggleRowSelection?.(row, selected)
}
function getData(): any[] {
  return state.data
}

const toolbarScope = computed<ProTableToolbarScope>(() => ({
  refresh: () => refresh(false),
  getSelectionRows,
  query: state.query,
}))

defineExpose<ProTableExpose>({
  refresh,
  reset,
  setQuery,
  getSelectionRows,
  clearSelection,
  toggleRowSelection,
  getData,
})

// 单元格合并：取 root 列上第一个声明 spanMethod 的列，table 级 spanMethod 只对匹配列生效
const spanTargetProp = computed(() => {
  const col = props.columns.find((c) => c.spanMethod)
  return col?.prop
})
const rootSpanMethod = computed(() => {
  const col = props.columns.find((c) => c.spanMethod)
  return col?.spanMethod
})

function handleSpanMethod({
  row,
  column,
  rowIndex,
  columnIndex,
}: {
  row: any
  column: any
  rowIndex: number
  columnIndex: number
}) {
  // el-table 的 span-method 会对每一格调用一次，必须按 column 过滤，否则合并逻辑会
  // 误伤其他列（导致整行被隐藏、表格看上去只剩少数行）
  if (!rootSpanMethod.value) return { rowspan: 1, colspan: 1 }
  if (spanTargetProp.value && column?.property !== spanTargetProp.value) {
    return { rowspan: 1, colspan: 1 }
  }
  const r = rootSpanMethod.value({ row, column, rowIndex, columnIndex })
  if (Array.isArray(r)) return { rowspan: r[0], colspan: r[1] }
  return r
}

// 渲染某一列的默认内容（formatter 或 文本）
function renderCellValue(col: ProTableColumn<T>, row: any, index: number) {
  const raw = col.prop ? row[col.prop] : ''
  if (col.formatter) return col.formatter(row, {} as any, raw, index)
  return raw
}
</script>

<template>
  <div class="pro-table">
    <!-- 工具栏 -->
    <div v-if="showToolbar" class="pro-table__toolbar">
      <div class="pro-table__toolbar-left">
        <slot name="toolbar-left" v-bind="toolbarScope" />
      </div>
      <div class="pro-table__toolbar-right">
        <slot name="toolbar" v-bind="toolbarScope" />
        <el-button :icon="RefreshRight" circle title="刷新" @click="refresh(false)" />
      </div>
    </div>

    <!-- 表格 -->
    <el-table
      ref="tableRef"
      v-loading="state.loading"
      :data="state.data"
      :row-key="rowKey"
      :highlight-current-row="singleSelect"
      :span-method="rootSpanMethod ? handleSpanMethod : undefined"
      v-bind="$attrs"
      @selection-change="onSelectionChange"
      @row-click="onRowClick"
      @sort-change="onSortChange"
    >
      <!-- 多选列 -->
      <el-table-column v-if="selection" type="selection" width="48" reserve-selection />

      <!-- 动态列 -->
      <template v-for="col in visibleColumns" :key="col.prop || col.type || col.label">
        <!-- 多表头分组 -->
        <el-table-column
          v-if="col.children?.length"
          :label="col.label"
          :prop="col.prop"
          v-bind="col"
        >
          <el-table-column
            v-for="child in col.children"
            :key="child.prop || child.label"
            v-bind="child"
          >
            <template #default="{ row, $index }">
              <slot
                v-if="$slots[child.slot || `column-${child.prop}`]"
                :name="child.slot || `column-${child.prop}`"
                :row="row"
                :index="$index"
              />
              <span v-else>{{ renderCellValue(child, row, $index) }}</span>
            </template>
          </el-table-column>
        </el-table-column>

        <!-- 操作列 -->
        <el-table-column
          v-else-if="col.type === 'actions'"
          :label="col.label || '操作'"
          v-bind="col"
        >
          <template #default="{ row, $index }">
            <slot name="actions" :row="row" :index="$index" />
          </template>
        </el-table-column>

        <!-- 普通列 -->
        <el-table-column v-else :prop="col.prop" :label="col.label" v-bind="col">
          <template #default="{ row, $index }">
            <slot
              v-if="$slots[col.slot || `column-${col.prop}`]"
              :name="col.slot || `column-${col.prop}`"
              :row="row"
              :index="$index"
            />
            <span v-else>{{ renderCellValue(col, row, $index) }}</span>
          </template>
        </el-table-column>
      </template>

      <!-- 空状态 -->
      <template #empty>
        <slot name="empty">
          <div v-if="state.error" class="pro-table__error">
            <p>加载失败：{{ state.error.message }}</p>
            <el-button :icon="Refresh" size="small" @click="refresh(false)">重试</el-button>
          </div>
          <span v-else>暂无数据</span>
        </slot>
      </template>
    </el-table>

    <!-- 分页 -->
    <div
      v-if="paginationEnabled"
      class="pro-table__pagination"
      :style="{ textAlign: paginationConfig.align as any }"
    >
      <el-pagination
        :current-page="state.page"
        :page-size="state.pageSize"
        :total="state.total"
        :page-sizes="paginationConfig.pageSizes"
        :layout="paginationConfig.layout"
        :background="paginationConfig.background"
        :small="paginationConfig.small"
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.pro-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pro-table__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.pro-table__toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pro-table__pagination {
  display: flex;
}
.pro-table__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--el-color-danger);
}
</style>
