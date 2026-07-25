# 部署指南 01 · 同域静态托管（nginx）

> 适用：单一域名、主应用与子应用同域部署（最省心，CORS 仅作兜底）。
> 拓扑：`https://admin.example.com/` 下，主应用挂 `/`，doc 挂 `/doc/`，sys 挂 `/sys/`，后端反代到 `/api/`。

---

## 1. 配置生产环境变量

构建前写入各应用的生产 `.env`（或 `.env.production`，并通过 `--mode production` 触发；本仓库默认读 `.env`，直接覆盖即可，构建后勿依赖运行时）。

**`apps/main-app/.env`**

```ini
VITE_API_BASE_URL=/api
VITE_DOC_APP_URL=https://admin.example.com/doc/
VITE_SYS_APP_URL=https://admin.example.com/sys/
```

**`apps/doc-app/.env`**

```ini
VITE_API_BASE_URL=/api
VITE_BASE=/doc/
```

**`apps/sys-app/.env`**

```ini
VITE_API_BASE_URL=/api
VITE_BASE=/sys/
```

> `VITE_BASE` 同时作为子应用 `vite.config.ts` 的 `base`，必须等于其部署路径，否则 `assets/*.js` 相对路径解析失败。
> 注意：`VITE_DOC_APP_URL` 末尾的 `/doc/` 与 doc-app 的 `VITE_BASE=/doc/` 必须对应一致。

## 2. 构建

```bash
pnpm install
pnpm build
# 产出：apps/main-app/dist、apps/doc-app/dist、apps/sys-app/dist
```

## 3. 目录规划（部署机）

```bash
/srv/mic-admin/
├─ main-app/dist/   # 基座
├─ doc-app/dist/    # 文档子应用
└─ sys-app/dist/    # 系统管理子应用
```

## 4. nginx 配置

`/etc/nginx/conf.d/mic-admin.conf`：

```nginx
server {
    listen 80;
    server_name admin.example.com;

    # —— 基座（SPA，hash 路由无需服务端 rewrite，但仍兜底）——
    location / {
        root /srv/mic-admin/main-app/dist;
        try_files $uri $uri/ /index.html;
    }

    # —— 文档子应用：子路径 + CORS 兜底 ——
    location /doc/ {
        add_header Access-Control-Allow-Origin *;
        root /srv/mic-admin/doc-app/dist;
        # 注意 root 已含 /doc 前缀，index.html 实际位于 doc-app/dist/index.html
        try_files $uri $uri/ /doc/index.html;
    }

    # —— 系统管理子应用 ——
    location /sys/ {
        add_header Access-Control-Allow-Origin *;
        root /srv/mic-admin/sys-app/dist;
        try_files $uri $uri/ /sys/index.html;
    }

    # —— 后端 API 反代 ——
    location /api/ {
        proxy_pass http://127.0.0.1:4000;   # sys-server 监听 4000
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

校验并重载：

```bash
nginx -t && nginx -s reload
```

## 5. 后端 sys-server 托管

`sys-server` 的 `build` 仅为类型检查，运行用 `start: "tsx src/index.ts"`。两种托管方式二选一：

**方式 A：直接运行（配合进程管理器）**

```bash
cd apps/sys-server
pnpm start        # tsx src/index.ts，监听 PORT(默认4000)
```

用 `pm2` 托管：

```bash
pm2 start "pnpm start" --name mic-sys-server --cwd apps/sys-server
```

**方式 B：systemd**（可选）

```ini
# /etc/systemd/system/mic-sys-server.service
[Unit]
Description=mic-admin sys-server
After=network.target

[Service]
WorkingDirectory=/srv/mic-admin/sys-server
ExecStart=/usr/bin/pnpm --filter @mic/sys-server start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now mic-sys-server
```

## 6. 验证

1. 访问 `https://admin.example.com/` → admin/12345 登录。
2. 进入 `/doc/*`、`/sys/*` 子应用，确认资源加载无 CORS 报错（浏览器控制台）。
3. 系统管理页调用 `/api/menus` 等正常返回。
4. 切换角色、页面缓存（keep-alive）、应用级缓存（v-show）行为正常。

## 7. 注意点

- 同域下 CORS 头仅为兜底，即使去掉通常也能跑；保留更稳妥。
- 若改用 HTTPS，记得在 nginx 加证书并将 `VITE_DOC_APP_URL`/`VITE_SYS_APP_URL` 改为 `https://`。
- 静态资源建议加长期缓存（`/doc/assets/` 带 hash，可 `expires 1y`；`index.html` 禁缓存）。
- 不要改 `build` 脚本为 `vue-tsc -b`。
