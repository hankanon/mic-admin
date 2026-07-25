import { request } from '@mic/utils'
import type { MenuNode, MenuPayload } from '../types'

export const menuApi = {
  /** 获取菜单树（可按子应用过滤） */
  tree: (appKey?: string) =>
    request
      .get<MenuNode[]>('/menus/tree' + (appKey ? `?appKey=${appKey}` : ''))
      .then((r) => r.data),
  create: (data: MenuPayload) =>
    request.post<MenuNode>('/menus', data).then((r) => r.data),
  update: (id: number, data: Partial<MenuPayload>) =>
    request.put<MenuNode>(`/menus/${id}`, data).then((r) => r.data),
  remove: (id: number) => request.delete(`/menus/${id}`).then((r) => r.data),
}
