# 部署指南 03 · Docker 容器化部署

> 适用：容器编排、CI/CD、云原生。采用 **单 nginx 多阶段构建**（把 main/doc/sys 三个前端一次性构建并塞进一个 nginx 镜像，统一路由 + CORS + /api 反代），再加一个 `sys-server` Node 服务，用 `docker-compose` 一键编排。
> 形态等价于「同域静态托管」，但全部容器化。

---

## 1. 目录结构（新增的部署文件）

```
mic-admin/
├─ apps/
│  ├─ main-app/  doc-app/  sys-app/  sys-server/   # 已有
├─ deploy/
│  ├─ nginx.conf           # 前端网关（路由 + CORS + /api 反代）
│  ├─ Dockerfile.frontend  # 多阶段构建三个前端 → nginx
│  ├─ Dockerfile.backend   # sys-server → node + tsx
│  └─ docker-compose.yml
└─ docs/deploy/03-docker.md
```

> 说明：Dockerfile / nginx.conf 放 `deploy/` 便于与 `docker-compose.yml` 同上下文引用；如需放各 app 目录也可，相应调整 `context` 与 `dockerfile` 路径。

## 2. 前端镜像 `deploy/Dockerfile.frontend`

Vite 变量在 build 时内联，故用 `ARG` + `ENV` 在构建阶段注入。

```dockerfile
# ---- 阶段1：构建 main-app ----
FROM node:20-alpine AS build-main
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/main-app ./apps/main-app
RUN corepack enable && pnpm install --frozen-lockfile
ARG VITE_API_BASE_URL=/api
ARG VITE_DOC_APP_URL=/doc/
ARG VITE_SYS_APP_URL=/sys/
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_DOC_APP_URL=$VITE_DOC_APP_URL \
    VITE_SYS_APP_URL=$VITE_SYS_APP_URL
RUN pnpm --filter @mic/main-app build

# ---- 阶段2：构建 doc-app ----
FROM node:20-alpine AS build-doc
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/doc-app ./apps/doc-app
RUN corepack enable && pnpm install --frozen-lockfile
ARG VITE_API_BASE_URL=/api
ARG VITE_BASE_DOC=/doc/
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_BASE=$VITE_BASE_DOC
RUN pnpm --filter @mic/doc-app build

# ---- 阶段3：构建 sys-app ----
FROM node:20-alpine AS build-sys
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/sys-app ./apps/sys-app
RUN corepack enable && pnpm install --frozen-lockfile
ARG VITE_API_BASE_URL=/api
ARG VITE_BASE_SYS=/sys/
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_BASE=$VITE_BASE_SYS
RUN pnpm --filter @mic/sys-app build

# ---- 阶段4：nginx 聚合 ----
FROM nginx:alpine
COPY --from=build-main /app/apps/main-app/dist /usr/share/nginx/html/main
COPY --from=build-doc  /app/apps/doc-app/dist  /usr/share/nginx/html/doc
COPY --from=build-sys  /app/apps/sys-app/dist  /usr/share/nginx/html/sys
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## 3. 网关配置 `deploy/nginx.conf`

主应用放根，子应用放子路径，并加 CORS 兜底；`/api` 反代到后端容器 `backend:4000`。

```nginx
server {
    listen 80;

    # 基座
    location / {
        root /usr/share/nginx/html/main;
        try_files $uri $uri/ /index.html;
    }

    # 文档子应用
    location /doc/ {
        add_header Access-Control-Allow-Origin *;
        root /usr/share/nginx/html/doc;
        try_files $uri $uri/ /doc/index.html;
    }

    # 系统子应用
    location /sys/ {
        add_header Access-Control-Allow-Origin *;
        root /usr/share/nginx/html/sys;
        try_files $uri $uri/ /sys/index.html;
    }

    # 后端
    location /api/ {
        proxy_pass http://backend:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

> 注：子应用的 `VITE_BASE` 在构建时已设为 `/doc/`、`/sys/`，与这里 nginx 的子路径对应，资源路径解析正确。

## 4. 后端镜像 `deploy/Dockerfile.backend`

`sys-server` 运行用 `tsx`，无需打包，直接带源码运行。

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/sys-server ./apps/sys-server
RUN corepack enable && pnpm install --frozen-lockfile
EXPOSE 4000
CMD ["pnpm", "--filter", "@mic/sys-server", "start"]
```

## 5. 编排 `deploy/docker-compose.yml`

```yaml
services:
  frontend:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.frontend
      args:
        VITE_API_BASE_URL: /api
        VITE_DOC_APP_URL: /doc/
        VITE_SYS_APP_URL: /sys/
        VITE_BASE_DOC: /doc/
        VITE_BASE_SYS: /sys/
    ports:
      - "8080:80"
    depends_on:
      - backend

  backend:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.backend
    environment:
      - PORT=4000
    expose:
      - "4000"
```

> `context: ..` 表示构建上下文为仓库根，使多阶段能 COPY 到 `packages/` 与各 `apps/`。请确认 `docker-compose.yml` 与 `deploy/` 的相对位置，或按需调整 `context`。

## 6. 构建与运行

```bash
# 在仓库根执行（compose 文件在 deploy/）
docker compose -f deploy/docker-compose.yml up -d --build

# 查看
docker compose -f deploy/docker-compose.yml ps
```

访问：`http://localhost:8080/`（基座），子应用 `/doc/`、`/sys/`，API `/api/`。

## 7. 生产注意事项

- **HTTPS**：在 compose 前再加一层 TLS 终止（云 LB / 或 nginx 加证书）。改 `VITE_DOC_APP_URL`/`VITE_SYS_APP_URL` 为 `https://域名/doc/` 并在 nginx.conf 同步。
- **前端环境变量**：本方案在镜像构建期注入；若需运行时覆盖，需改用「构建后注入 env 的运行时方案」（如用 `entrypoint` 脚本把 env 写进 `window.__ENV__` 再被应用读取）——Vite 默认不支持运行时覆盖 `VITE_*`，需额外改造。演示/固定环境用构建期注入即可。
- **后端持久化**：`sys-server` 数据为内存 mock，容器重启即丢失；生产应替换为真实数据库，或至少挂卷。本指南仅覆盖当前 mock 形态。
- **镜像体积**：多阶段 + `pnpm install` 后可用 `pnpm prune` 或 `.dockerignore` 排除 `node_modules`/`.git` 减小体积。建议加 `.dockerignore`：

  ```
  **/node_modules
  **/dist
  .git
  ```

- `docker-compose.yml` 中 `context: ..` 需保证能访问到 `packages/`；若把 Dockerfile 放到各 app 内则相应调整。

## 8. 一键验证

1. `http://localhost:8080/` 登录 admin/12345。
2. 子应用资源加载正常（控制台无 CORS）。
3. `/api/menus` 经 nginx 反代到 backend 容器返回数据。
4. 两层缓存、切换角色、权限过滤正常。
