import { z } from 'zod'

export const appKeyEnum = z.enum(['dashboard', 'doc', 'qa', 'profile', 'sys'])
export const menuTypeEnum = z.enum(['catalog', 'menu'])
export const userStatusEnum = z.enum(['active', 'disabled'])

const optionalPhone = z
  .string()
  .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
  .optional()
  .or(z.literal('').transform(() => undefined))

/** 菜单创建校验 */
export const menuCreateSchema = z.object({
  appKey: appKeyEnum,
  parentId: z.number().int().min(0, '父级 id 不能为负'),
  title: z.string().min(1, '标题必填').max(50, '标题过长'),
  icon: z.string().max(50).optional(),
  path: z.string().max(200).optional(),
  type: menuTypeEnum,
  order: z.number().int().min(0).default(0),
  visible: z.boolean().default(true),
  permission: z.string().max(50).optional(),
})

/** 菜单更新校验（全字段可选，但 parentId 仍受 int 约束） */
export const menuUpdateSchema = z.object({
  appKey: appKeyEnum.optional(),
  parentId: z.number().int().min(0).optional(),
  title: z.string().min(1).max(50).optional(),
  icon: z.string().max(50).optional(),
  path: z.string().max(200).optional(),
  type: menuTypeEnum.optional(),
  order: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
  permission: z.string().max(50).optional(),
})

/** 角色创建校验 */
export const roleCreateSchema = z.object({
  name: z.string().min(1, '角色名称必填').max(50, '名称过长'),
  code: z
    .string()
    .min(1, '角色标识必填')
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, '标识只能包含字母、数字、下划线和短横线'),
  appKeys: z.array(appKeyEnum).default([]),
  menuIds: z.array(z.number().int().positive()).default([]),
  description: z.string().max(200).optional(),
})

export const roleUpdateSchema = roleCreateSchema.partial()

/** 人员创建校验 */
export const userCreateSchema = z.object({
  username: z
    .string()
    .min(1, '用户名必填')
    .max(50)
    .regex(/^[A-Za-z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
  name: z.string().min(1, '姓名必填').max(50, '姓名过长'),
  email: z.string().email('邮箱格式不正确').max(100),
  phone: optionalPhone,
  status: userStatusEnum.default('active'),
  roleIds: z.array(z.number().int().positive()).default([]),
  password: z.string().min(1, '登录密码必填').max(100, '密码过长'),
})

export const userUpdateSchema = userCreateSchema.partial()

/** 登录校验 */
export const loginSchema = z.object({
  username: z.string().min(1, '用户名必填').max(50),
  password: z.string().min(1, '密码必填').max(100),
})

export type MenuCreateInput = z.infer<typeof menuCreateSchema>
export type MenuUpdateInput = z.infer<typeof menuUpdateSchema>
export type RoleCreateInput = z.infer<typeof roleCreateSchema>
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>
export type UserCreateInput = z.infer<typeof userCreateSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
export type LoginInput = z.infer<typeof loginSchema>
