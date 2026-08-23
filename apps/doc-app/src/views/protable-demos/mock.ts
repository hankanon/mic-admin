import type { ProTableRequest, ProTableRequestParams } from '@mic/components'

export interface DemoRow {
  id: number
  name: string
  dept: string
  group: string
  status: 'active' | 'disabled'
  amount: number
  date: string
  region: string
  owner: string
}

function genRows(n: number): DemoRow[] {
  const depts = ['研发部', '市场部', '财务部', '运营部']
  const groups = ['一组', '二组', '三组']
  const regions = ['华东', '华北', '华南', '西部']
  const statuses: DemoRow['status'][] = ['active', 'disabled']
  const rows: DemoRow[] = []
  for (let i = 0; i < n; i++) {
    rows.push({
      id: i + 1,
      name: `项目-${String(i + 1).padStart(3, '0')}`,
      dept: depts[i % depts.length],
      group: groups[i % groups.length],
      status: statuses[i % 3 === 0 ? 1 : 0],
      amount: Math.round(Math.random() * 100000) / 100,
      date: `2026-0${(i % 9) + 1}-1${i % 9}`,
      region: regions[i % regions.length],
      owner: `user${i % 5}`,
    })
  }
  return rows
}

const ALL = genRows(186)

/** 通用 mock 请求：支持分页 + 排序 + 模糊查询 */
export const mockRequest: ProTableRequest<DemoRow> = (params: ProTableRequestParams) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const { page, pageSize, sortProp, sortOrder, keyword } = params as any
      let list = ALL.slice()
      if (keyword) {
        list = list.filter(
          (r) =>
            r.name.includes(keyword) ||
            r.owner.includes(keyword) ||
            r.dept.includes(keyword),
        )
      }
      if (sortProp) {
        list.sort((a, b) => {
          const av = (a as any)[sortProp]
          const bv = (b as any)[sortProp]
          if (av == null) return 1
          if (bv == null) return -1
          const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
          return sortOrder === 'descending' ? -cmp : cmp
        })
      }
      const start = (page - 1) * pageSize
      resolve({ list: list.slice(start, start + pageSize), total: list.length })
    }, 300)
  })
}
