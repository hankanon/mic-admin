-- =============================================================================
-- mic-admin 后台服务 测试数据
-- 覆盖场景：
--   菜单：全部 5 个子应用（dashboard / doc / qa / profile / sys），按最新层级结构
--         采用「层级编码 ID」规则写入（应用段 + L1 + L2 + L3，未用层级补 0）。
--   角色：超级管理员(全权限) / 文档编辑(doc) / 系统管理员(sys)
--   人员：admin / editor / sysop（启用）+ guest（禁用）
--   关联：角色->子应用、角色->菜单、用户->角色
-- 注意：
--   1. 先执行 schema.sql 建表。
--   2. 重复执行本文件安全（INSERT IGNORE）。
--   3. 公共入口应用（dashboard / qa / profile）菜单入库仅供菜单管理查看/维护，
--      其展示由前端 publicApps 保证始终可见，故不写入 role_menus。
-- =============================================================================

USE `admin`;
SET NAMES utf8mb4;

-- -------------------------- 菜单（层级编码 ID） --------------------------
-- ID 规则：应用段(2) + L1(2) + L2(2) + L3(2)
--   应用段：dashboard=01, doc=02, qa=03, profile=04, sys=05
--   未用层级补 00；按数值序即展示顺序（父级先于子级、同级按 order）。
INSERT IGNORE INTO `menus`
  (`id`, `app_key`, `parent_id`, `title`, `icon`, `path`, `type`, `order`, `visible`)
VALUES
  -- 首页大盘 dashboard
  (1010000, 'dashboard', NULL, '首页大盘', 'HomeFilled',    NULL,               'catalog', 1, 1),
  (1010100, 'dashboard', 1010000, '数据总览', NULL,         '/',                'menu',    1, 1),
  (1010200, 'dashboard', 1010000, '访问分析', NULL,         '/dashboard/analytics', 'menu', 2, 1),
  (1010300, 'dashboard', 1010000, '文档统计', NULL,         '/dashboard/docs-stat', 'menu', 3, 1),
  (1010400, 'dashboard', 1010000, '用户统计', NULL,         '/dashboard/users-stat', 'menu', 4, 1),
  (1010500, 'dashboard', 1010000, '系统公告', NULL,         '/dashboard/notice', 'menu',    5, 1),

  -- 文档管理 doc
  (2010000, 'doc', NULL, '文档管理', 'Document',           NULL,               'catalog', 1, 1),
  (2010100, 'doc', 2010000, '文档列表', NULL,              '/doc/list',        'menu',    1, 1),
  (2010200, 'doc', 2010000, '发布管理', NULL,              '/doc/publish',     'menu',    2, 1),
  (2010300, 'doc', 2010000, '新增文档', NULL,              '/doc/edit',        'menu',    3, 1),
  (2010400, 'doc', 2010000, '文档预览', NULL,              '/doc/preview',     'menu',    4, 1),
  (2010500, 'doc', 2010000, '示例展示', NULL,              NULL,               'catalog', 5, 1),
  (2010501, 'doc', 2010500, '示例总览',       NULL,         '/doc/protable',          'menu', 1, 1),
  (2010502, 'doc', 2010500, '多表头示例',     NULL,         '/doc/protable/multi-header','menu', 2, 1),
  (2010503, 'doc', 2010500, '自定义插槽示例', NULL,         '/doc/protable/slot',     'menu', 3, 1),
  (2010504, 'doc', 2010500, '单选模式示例',   NULL,         '/doc/protable/single',   'menu', 4, 1),
  (2010505, 'doc', 2010500, '多选模式示例',   NULL,         '/doc/protable/multi',    'menu', 5, 1),
  (2010506, 'doc', 2010500, '单元格合并示例', NULL,         '/doc/protable/span',     'menu', 6, 1),

  -- 智能问答 qa
  (3010000, 'qa', NULL, '智能问答', 'ChatDotRound',        NULL,               'catalog', 1, 1),
  (3010100, 'qa', 3010000, '新建会话', NULL,               '/qa/new',          'menu',    1, 1),
  (3010200, 'qa', 3010000, '历史会话', NULL,               '/qa/history',      'menu',    2, 1),
  (3010300, 'qa', 3010000, '模型配置', NULL,               '/qa/config',       'menu',    3, 1),

  -- 个人中心 profile
  (4010000, 'profile', NULL, '个人中心', 'User',           NULL,               'catalog', 1, 1),
  (4010100, 'profile', 4010000, '个人视图', NULL,         '/profile/view',    'menu',    1, 1),
  (4010200, 'profile', 4010000, '待办事项', NULL,          '/profile/todo',    'menu',    2, 1),

  -- 系统管理 sys
  (5010000, 'sys', NULL, '系统管理', 'Setting',            NULL,               'catalog', 1, 1),
  (5010100, 'sys', 5010000, '菜单管理', NULL,              '/sys/menu',        'menu',    1, 1),
  (5010200, 'sys', 5010000, '角色管理', NULL,              '/sys/role',        'menu',    2, 1),
  (5010300, 'sys', 5010000, '人员管理', NULL,              '/sys/user',        'menu',    3, 1);

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

-- -------------------- 角色-菜单权限（仅 doc / sys 授权） --------------------
-- 公共入口应用（dashboard / qa / profile）始终可见，不在此写入。
INSERT IGNORE INTO `role_menus` (`role_id`, `menu_id`)
VALUES
  -- 超级管理员：doc 全部(含目录) + sys 全部(含目录)
  (1, 2010000), (1, 2010100), (1, 2010200), (1, 2010300), (1, 2010400),
  (1, 2010500), (1, 2010501), (1, 2010502), (1, 2010503), (1, 2010504),
  (1, 2010505), (1, 2010506),
  (1, 5010000), (1, 5010100), (1, 5010200), (1, 5010300),
  -- 文档编辑：仅 doc
  (2, 2010000), (2, 2010100), (2, 2010200), (2, 2010300), (2, 2010400),
  (2, 2010500), (2, 2010501), (2, 2010502), (2, 2010503), (2, 2010504),
  (2, 2010505), (2, 2010506),
  -- 系统管理员：仅 sys
  (3, 5010000), (3, 5010100), (3, 5010200), (3, 5010300);

-- -------------------- 用户-角色 --------------------
INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`)
VALUES
  (1, 1),   -- admin -> 超级管理员
  (2, 2),   -- editor -> 文档编辑
  (3, 3),   -- sysop -> 系统管理员
  (4, 3);   -- guest -> 系统管理员（账号禁用，用于验证禁用态）
