-- =============================================================================
-- 按钮级权限：role_menus 增加 permissions 列
-- 用途：存储该角色在该菜单下可执行的按钮/操作权限点（逗号分隔）
-- 示例：'sys:user:create,sys:user:edit,sys:user:delete'
-- =============================================================================

ALTER TABLE `role_menus`
  ADD COLUMN `permissions` VARCHAR(255) DEFAULT NULL
  COMMENT '按钮级权限点，逗号分隔，如 sys:user:create,sys:user:edit'
  AFTER `menu_id`;
