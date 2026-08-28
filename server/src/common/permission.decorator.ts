import { SetMetadata } from '@nestjs/common'

/** 声明该接口所需的按钮级权限点（存储用于 PermissionGuard 读取的元数据） */
export const PERMISSION_KEY = 'required_permission'

/**
 * 接口级按钮权限守卫声明。
 * @param code 权限点标识，如 `sys:user:create`
 */
export const RequirePermission = (code: string) => SetMetadata(PERMISSION_KEY, code)
