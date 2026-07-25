# 部署指南 02 · 子应用分域 / CDN 部署

> 适用：主应用与子应用使用**不同域名**（或走 CDN 独立缓存/扩容）。此时主子**跨域**，`Access-Control-Allow-Origin` **强制要求**。
> 拓扑示例：
> - 主应用 `https://admin.example.com/`
> - 文档子应用 `https://doc.example.com/`（或 `https://cdn.example.com/doc/`）
> - 系统子应用 `https://sys.example.com/`（或 `https://cdn.example.com/sys/`）
> - 后端 `https://api.example.com/`（或回源到 sys-server）

---

## 1. 环境变量配置

跨域场景的核心是：main-app 里的子应用地址必须写成**绝对 URL**，子应用的 `VITE_BASE` 必须等于它在自己域名下的资源路径。

### 方案 A：子应用各自根域名（doc.example.com / sys.example.com）

**`apps/main-app/.env`**

```ini
VITE_API_BASE_URL=https://api.example.com
VITE_DOC_APP_URL=https://doc.example.com/
VITE_SYS_APP_URL=https://sys.example.com/
```

**`apps/doc-app/.env`**（`VITE_BASE=/`，因为挂在自己域名根）

```ini
VITE_API_BASE_URL=https://api.example.com
VITE_BASE=/
```

**`apps/sys-app/.env`**

```ini
VITE_API_BASE_URL=https://api.example.com
VITE_BASE=/
```

### 方案 B：统一 CDN 子路径（cdn.example.com/doc/、/sys/）

**`apps/main-app/.env`**

```ini
VITE_API_BASE_URL=https://api.example.com
VITE_DOC_APP_URL=https://cdn.example.com/doc/
VITE_SYS_APP_URL=https://cdn.example.com/sys/
```

**`apps/doc-app/.env`**（`VITE_BASE=/doc/`，与 CDN 路径一致）

```ini
VITE_API_BASE_URL=https://api.example.com
VITE_BASE=/doc/
```

**`apps/sys-app/.env`**

```ini
VITE_API_BASE_URL=https://api.example.com
VITE_BASE=/sys/
```

> 关键约束：`VITE_DOC_APP_URL` 的路径部分 必须与 对应子应用的 `VITE_BASE` 完全一致，否则子应用加载后资源 404。

## 2. 构建

```bash
pnpm install
pnpm build
```

## 3. 子应用静态托管 + CORS（重点）

每个子应用的静态资源响应**必须**带 CORS 头，否则基座 iframe 沙箱无法跨域加载。

### 3.1 自托管 nginx（方案 A / B 通用）

文档子应用（`doc.example.com` 或 `cdn.example.com/doc/`）：

```nginx
server {
    listen 80;
    server_name doc.example.com;          # 方案B 改为 cdn.example.com
    # 方案B 额外加：location /doc/ { root /srv/doc-app/dist; try_files $uri $uri/ /doc/index.html; }
    # 方案B 时下面 root 改为 /srv/doc-app/dist 且 location /

    root /srv/doc-app/dist;               # 方案B：root /srv/doc-app/dist; location /doc/ { try_files ... /doc/index.html; }
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods 'GET, OPTIONS';
    add_header Access-Control-Allow-Headers '*';

    location / {
        try_files $uri $uri/ /index.html;
    }
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin *;   # 资源也必须带 CORS
    }
}
```

系统子应用同理（server_name `sys.example.com` 或 `cdn.example.com`，base 对应）。

### 3.2 走 CDN（Cloudfront / 阿里云 CDN / 腾讯云 COS+CDN）

- 源站：上述 nginx 或对象存储（桶内放置 `dist/` 内容）。
- **CORS 配置**：在 CDN/存储桶的 CORS 规则中允许 `Access-Control-Allow-Origin: *`（或限定 `admin.example.com`），Methods 含 `GET/OPTIONS`，Allowed Headers `*`。
- 开启 `OPTIONS` 预检缓存。
- 静态资源（`/assets/*`，带 hash）设长缓存；`index.html` 设 `Cache-Control: no-cache` 避免发布后旧入口。

## 4. 后端 API 跨域（api.example.com）

`sys-server` 已内置 `cors()`（默认放行所有源），直接反代即可：

```nginx
server {
    listen 80;
    server_name api.example.com;
    location / {
        proxy_pass http://127.0.0.1:4000;
    }
}
```

若后端前置网关（如 Kong / 自建），需确保网关也回 `Access-Control-Allow-Origin`（因为前端 `VITE_API_BASE_URL` 指向的是网关域名，跨域请求由网关响应）。

## 5. 主应用（admin.example.com）

```nginx
server {
    listen 80;
    server_name admin.example.com;
    root /srv/mic-admin/main-app/dist;
    try_files $uri $uri/ /index.html;
}
```

主应用本身不需要向子应用发 CORS（micro-app 由 iframe 加载子应用，子应用自己回 CORS）。主应用对 `/api` 若同域则直接反代，跨域则走 `api.example.com`（已配 CORS）。

## 6. 验证

1. `https://admin.example.com/` 登录 → 子应用 `doc.example.com` / `sys.example.com` 资源加载无 CORS 报错。
2. 浏览器 DevTools → Network，确认子应用 HTML/JS 响应头含 `access-control-allow-origin`。
3. CDN 场景：确认 `index.html` 不被长缓存（发布后立即生效），`assets` 命中缓存。
4. 系统管理接口跨域 `api.example.com` 正常。

## 7. 注意点

- **CORS 是跨域部署的第一坑**：HTML、JS、CSS、字体、图片等所有被子应用加载的资源都要带 `Access-Control-Allow-Origin`；只给 HTML 加不够，子应用内部的 `assets/*.js` 同样需要。
- 若有鉴权 Cookie，CORS 不能用 `*`，需显式指定主域并加 `Access-Control-Allow-Credentials: true`（本项目演示态无 Cookie 鉴权，用 `*` 即可）。
- CDN 回源协议/ Host 头需正确（回源 Host 应为源站域名）。
- 发布顺序：先发子应用（CDN/子域），再发主应用（引用新的子应用 URL）；若主应用缓存了旧子 URL 需注意。
