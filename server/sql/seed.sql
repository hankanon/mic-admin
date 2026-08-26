-- =============================================================================
-- mic-admin 后台服务 测试数据
-- 与 server/src/common/store.ts 的种子数据保持一致，并规范化为关联表。
-- 覆盖场景：
--   菜单：文档发布(doc) 2 项 + 系统管理(sys) 5 项（含目录/子菜单）
--   角色：超级管理员(全权限) / 文档编辑(doc) / 系统管理员(sys)
--   人员：admin / editor / sysop（启用）+ guest（禁用）
--   关联：角色->子应用、角色->菜单、用户->角色
-- 注意：先执行 schema.sql 建表。重复执行本文件安全（INSERT IGNORE）。
-- =============================================================================

USE `admin`;
SET NAMES utf8mb4;

-- -------------------------- 菜单 --------------------------
INSERT IGNORE INTO `menus`
  (`id`, `app_key`, `parent_id`, `title`, `icon`, `path`, `type`, `order`, `visible`)
VALUES
  (1, 'doc', NULL, '文档列表',  NULL,      '/doc/list',   'menu',   1, 1),
  (2, 'doc', NULL, '发布管理',  NULL,      '/doc/publish','menu',   2, 1),
  (5, 'sys', NULL, '菜单管理',  NULL,      '/sys/menu',   'menu',   1, 1),
  (6, 'sys', NULL, '角色管理',  NULL,      '/sys/role',   'menu',   2, 1),
  (7, 'sys', NULL, '人员管理',  NULL,      '/sys/user',   'menu',   3, 1),
  (8, 'sys', NULL, '系统配置',  NULL,      NULL,          'catalog',0, 1),
  (9, 'sys', 8,    '基础设置',  NULL,      '/sys/setting', 'menu',  1, 1);

-- -------------------------- 角色 --------------------------
INSERT IGNORE INTO `roles` (`id`, `name`, `code`, `description`)
VALUES
  (1, '超级管理员', 'super-admin', '拥有全部子应用与菜单权限'),
  (2, '文档编辑',   'doc-editor',  '仅可访问文档发布应用'),
  (3, '系统管理员', 'sys-admin',   '管理菜单/角色/人员');

-- -------------------------- 人员 --------------------------
INSERT IGNORE INTO `users` (`id`, `username`, `name`, `email`, `phone`, `status`)
VALUES
  (1, 'admin', '管理员',   'admin@example.com',   '13800000000', 'active'),
  (2, 'editor','编辑小李', 'editor@example.com',  '13800000001', 'active'),
  (3, 'sysop', '系统运维', 'sysop@example.com',   '13800000002', 'active'),
  (4, 'guest', '访客',     'guest@example.com',   NULL,          'disabled');

-- -------------------- 角色-子应用权限 --------------------
INSERT IGNORE INTO `role_apps` (`role_id`, `app_key`)
VALUES
  (1, 'doc'), (1, 'sys'),   -- 超级管理员：全部
  (2, 'doc'),               -- 文档编辑：仅文档
  (3, 'sys');               -- 系统管理员：仅系统

-- -------------------- 角色-菜单权限 --------------------
INSERT IGNORE INTO `role_menus` (`role_id`, `menu_id`)
VALUES
  -- 超级管理员：全部菜单
  (1, 1), (1, 2), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9),
  -- 文档编辑：仅文档相关
  (2, 1), (2, 2),
  -- 系统管理员：系统管理相关
  (3, 5), (3, 6), (3, 7), (3, 8), (3, 9);

-- -------------------- 用户-角色 --------------------
INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`)
VALUES
  (1, 1),   -- admin -> 超级管理员
  (2, 2),   -- editor -> 文档编辑
  (3, 3),   -- sysop -> 系统管理员
  (4, 3);   -- guest -> 系统管理员（账号禁用，用于验证禁用态）
