-- =============================================================================
-- mic-admin 后台服务（server）数据表结构
-- 数据库：admin（见 server/.env.development 的 MYSQL_DB）
-- 字符集：utf8mb4
-- 说明：将内存存储中的 JSON 数组字段（appKeys / menuIds / roleIds）
--       规范化为关联表，并补齐主键、外键与索引。
-- =============================================================================

SET NAMES utf8mb4;

-- -------------------------- 菜单表 --------------------------
CREATE TABLE IF NOT EXISTS `menus` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `app_key`    VARCHAR(20)  NOT NULL                COMMENT '所属子应用: doc / sys',
  `parent_id`  INT UNSIGNED DEFAULT NULL            COMMENT '父菜单 id, NULL 表示根级',
  `title`      VARCHAR(50)  NOT NULL                COMMENT '菜单名称',
  `icon`       VARCHAR(50)  DEFAULT NULL            COMMENT '图标名',
  `path`       VARCHAR(200) DEFAULT NULL            COMMENT '前端路由 path（目录可空）',
  `type`       VARCHAR(20)  NOT NULL DEFAULT 'menu' COMMENT '类型: catalog / menu',
  `order`      INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '同级排序，越小越靠前',
  `visible`    TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '是否可见: 1 是 / 0 否',
  `permission` VARCHAR(50)  DEFAULT NULL            COMMENT '权限标识（可选）',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_menus_parent` (`parent_id`),
  KEY `idx_menus_app` (`app_key`),
  CONSTRAINT `fk_menus_parent`
    FOREIGN KEY (`parent_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单表';

-- -------------------------- 角色表 --------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`        VARCHAR(50)  NOT NULL                COMMENT '角色名称',
  `code`        VARCHAR(50)  NOT NULL                COMMENT '角色唯一标识（字母/数字/下划线）',
  `description` VARCHAR(200) DEFAULT NULL            COMMENT '描述',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_roles_code` (`code`),
  UNIQUE KEY `uk_roles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- -------------------------- 人员表 --------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`   VARCHAR(50)  NOT NULL                COMMENT '登录用户名（唯一）',
  `name`       VARCHAR(50)  NOT NULL                COMMENT '姓名',
  `email`      VARCHAR(100) NOT NULL                COMMENT '邮箱（唯一）',
  `phone`      VARCHAR(20)  DEFAULT NULL            COMMENT '手机号',
  `status`     VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态: active / disabled',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  UNIQUE KEY `uk_users_email` (`email`),
  KEY `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='人员表';

-- -------------------- 角色-子应用权限关联表（替代 role.appKeys） --------------------
CREATE TABLE IF NOT EXISTS `role_apps` (
  `role_id` INT UNSIGNED NOT NULL,
  `app_key` VARCHAR(20)  NOT NULL,
  PRIMARY KEY (`role_id`, `app_key`),
  CONSTRAINT `fk_role_apps_role`
    FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色可访问的子应用';

-- -------------------- 角色-菜单关联表（替代 role.menuIds） --------------------
CREATE TABLE IF NOT EXISTS `role_menus` (
  `role_id` INT UNSIGNED NOT NULL,
  `menu_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`role_id`, `menu_id`),
  KEY `idx_role_menus_menu` (`menu_id`),
  CONSTRAINT `fk_role_menus_role`
    FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_menus_menu`
    FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色拥有的菜单权限';

-- -------------------- 用户-角色关联表（替代 user.roleIds） --------------------
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` INT UNSIGNED NOT NULL,
  `role_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  KEY `idx_user_roles_role` (`role_id`),
  CONSTRAINT `fk_user_roles_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_role`
    FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户关联的角色';
