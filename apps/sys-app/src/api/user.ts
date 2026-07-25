import { request } from '@mic/utils'
import type { UserView, UserPayload } from '../types'

export const userApi = {
  list: () => request.get<UserView[]>('/users').then((r) => r.data),
  create: (data: UserPayload) =>
    request.post<UserView>('/users', data).then((r) => r.data),
  update: (id: number, data: Partial<UserPayload>) =>
    request.put<UserView>(`/users/${id}`, data).then((r) => r.data),
  remove: (id: number) => request.delete(`/users/${id}`).then((r) => r.data),
}
