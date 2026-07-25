import { Router } from 'express'
import { wrap } from '../middlewares/errorHandler'
import { ok } from '../response'
import { list, get, create, update, remove } from '../services/userService'
import { userCreateSchema, userUpdateSchema } from '../schemas'

const router = Router()

router.get(
  '/',
  wrap((_req, res) => ok(res, list())),
)
router.get(
  '/:id',
  wrap((req, res) => ok(res, get(Number(req.params.id)))),
)
router.post(
  '/',
  wrap((req, res) => ok(res, create(userCreateSchema.parse(req.body)), '创建成功')),
)
router.put(
  '/:id',
  wrap((req, res) =>
    ok(res, update(Number(req.params.id), userUpdateSchema.parse(req.body)), '更新成功'),
  ),
)
router.delete(
  '/:id',
  wrap((req, res) => {
    remove(Number(req.params.id))
    ok(res, null, '删除成功')
  }),
)

export default router
