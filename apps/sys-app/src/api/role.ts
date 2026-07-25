import { request } from '@mic/utils'
import type { RoleView, RolePayload } from '../types'

export const roleApi = {
  list: () => request.get<RoleView[]>('/roles').then((r) => r.data),
  create: (data: RolePayload) =>
    request.post<RoleView>('/roles', data).then((r) => r.data),
  update: (id: number, data: Partial<RolePayload>) =>
    request.put<RoleView>(`/roles/${id}`, data).then((r) => r.data),
  remove: (id: number) => request.delete(`/roles/${id}`).then((r) => r.data),
}
