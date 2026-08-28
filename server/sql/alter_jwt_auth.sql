-- JWT 认证迁移：users.token_version（改密/禁用后令存量 access 立即失效）
--             + refresh_tokens 表（刷新令牌：哈希落库、支持吊销与旋转单次使用）
-- 执行方式（必须指定 utf8mb4 客户端字符集，否则中文注释会乱码）：
-- mysql --default-character-set=utf8mb4 -u <user> -p<pass> admin < alter_jwt_auth.sql

SET NAMES utf8mb4;

-- 1) users 增加令牌版本号
SET @exist = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'admin' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'token_version'
);
SET @sql = IF(
  @exist = 0,
  'ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''令牌版本号，改密/禁用后自增以吊销存量 access token''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) 刷新令牌表（幂等：已存在则跳过）
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED NOT NULL COMMENT '所属用户',
  jti            CHAR(36)     NOT NULL COMMENT 'refresh token 唯一标识（jwt id）',
  token_hash     CHAR(64)     NOT NULL COMMENT 'sha256(refreshToken) 十六进制，拖库不可逆用',
  expires_at     DATETIME     NOT NULL COMMENT '过期时间',
  revoked_at     DATETIME     NULL     COMMENT '吊销时间（登出/改密/禁用/被旋转顶替）',
  replaced_by    CHAR(36)     NULL     COMMENT '旋转链路：被哪个新 jti 顶替（审计用）',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_jti (jti),
  KEY idx_user (user_id),
  KEY idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='刷新令牌（哈希存储，支持吊销与旋转）';
