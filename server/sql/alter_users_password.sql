:setvar:    SQL脚本：为 users 表新增 password 列并批量设置默认密码 123456
-- 执行方式（必须指定 utf8mb4 客户端字符集，否则中文注释会乱码）：
-- mysql --default-character-set=utf8mb4 -u <user> -p<pass> admin < alter_users_password.sql

SET NAMES utf8mb4;

SET @db = 'admin';
SET @tbl = 'users';
SET @col = 'password';
SET @exist = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = @tbl AND COLUMN_NAME = @col
);
SET @sql = IF(
  @exist = 0,
  'ALTER TABLE users ADD COLUMN password VARCHAR(100) DEFAULT NULL COMMENT ''登录密码（明文，初始默认 123456）''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 修复已存在列的注释字符集（解决乱码）
ALTER TABLE `users`
  MODIFY COLUMN `password` VARCHAR(100) DEFAULT NULL
  COMMENT '登录密码（明文，初始默认 123456）';

UPDATE `users` SET `password` = '123456' WHERE `password` IS NULL OR `password` = '';
