import { Body, Controller, Get, Post } from '@nestjs/common'
import { z } from 'zod'
import { NotificationService } from './notification.service'

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

@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /** 发布通知（广播或按 targets/recipient 定向） */
  @Post('publish')
  publish(@Body() body: unknown) {
    const parsed = publishSchema.parse(body)
    return this.notificationService.publish(parsed)
  }

  /** 发布给指定用户 */
  @Post('publish-to-user')
  publishToUser(@Body() body: unknown) {
    const schema = publishSchema.extend({ userId: z.string().min(1) })
    const parsed = schema.parse(body)
    const { userId, ...rest } = parsed
    return this.notificationService.publishToUser(userId, rest)
  }

  /** 查询历史通知 */
  @Get('history')
  history() {
    return this.notificationService.getHistory()
  }
}
