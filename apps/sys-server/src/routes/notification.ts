import { Router } from 'express'
import { z } from 'zod'
import { ok, fail } from '../response'
import { notificationService } from '../notification/notificationService'

const router = Router()

/** 发布通知（演示用，无需鉴权的内部接口） */
const publishSchema = z.object({
  type: z.enum(['announcement', 'reminder', 'alert']),
  title: z.string().min(1),
  content: z.string().min(1),
  module: z.string().optional(),
  alertLevel: z.enum(['info', 'warning', 'critical']).optional(),
  targets: z.array(z.string()).default([]),
  recipient: z.string().optional(),
  link: z.string().optional(),
})

router.post('/publish', (req, res) => {
  const parsed = publishSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, '参数错误：' + parsed.error.message)
  }
  const msg = notificationService.publish(parsed.data)
  return ok(res, msg, '已发布')
})

/** 发布给指定用户 */
router.post('/publish-to-user', (req, res) => {
  const schema = publishSchema.extend({ userId: z.string().min(1) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, '参数错误：' + parsed.error.message)
  }
  const { userId, ...rest } = parsed.data
  const msg = notificationService.publishToUser(userId, rest)
  return ok(res, msg, '已发送')
})

/** 查询历史通知 */
router.get('/history', (_req, res) => {
  return ok(res, notificationService.getHistory())
})

export default router
