# 微前端后台管理系统 · 部署指南索引

本目录按 **三种部署形态** 分别提供可落地的部署指南，均基于当前 `mic-admin` 代码（micro-app `1.0.0-rc.32` iframe 沙箱、Vite 6、hash 路由）。

| 指南 | 适用场景 | 核心特征 |
| --- | --- | --- |
| [01-同域静态托管（nginx）](./01-same-origin-nginx.md) | 中小团队、单域名、最省心 | 主/子应用同域，子应用挂子路径；CORS 仅需兜底 |
| [02-子应用分域-CDN](./02-cdn-subdomain.md) | 子应用独立域名/CDN、独立扩容 | 主应用与子应用跨域；**CORS 强制**、产物走 CDN 缓存 |
| [03-Docker 容器化](./03-docker.md) | 容器编排、CI/CD、云原生 | 单 nginx 多阶段构建 + sys-server 服务，compose 一键起 |

---

## 公共前置（三种形态都适用）

### 1. 构建

```bash
pnpm install
pnpm build          # = pnpm -r build，每个应用 vue-tsc --noEmit && vite build → apps/<app>/dist/
```

- 单应用：`pnpm --filter @mic/doc-app build`
- 产物：`apps/main-app/dist`、`apps/doc-app/dist`、`apps/sys-app/dist`
- 公共包 `@mic/utils`、`@mic/components` 会被 vite **自动打包进各应用 bundle**，无需单独构建。

### 2. ⚠️ 环境变量在构建时内联（关键坑）

Vite 的 `VITE_*` 在 `vite build` 时**写死进产物**，运行时改 `.env` 无效。务必在构建前设定生产值。

| 变量 | 位置 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 全部应用 | 后端 API 地址（网关或同域 `/api`） |
| `VITE_DOC_APP_URL` / `VITE_SYS_APP_URL` | 仅 main-app | 子应用**入口 HTML 的绝对地址** |
| `VITE_BASE` | doc-app / sys-app | 子应用自身资源路径前缀，必须等于其部署路径 |

### 3. CORS 原理（务必理解）

基座用 micro-app **iframe 沙箱**加载子应用资源。dev/preview 已由 Vite 自动加 `Access-Control-Allow-Origin: *`，但 `vite build` 的**静态产物本身不带 CORS 头**——需由托管静态资源的服务器（nginx / CDN）补上。

- **同域部署**：多数情况下可不依赖 CORS，但建议仍加（避免微前端 fetch 子资源被拦）。
- **跨域 / CDN 部署**：子应用静态响应**必须**带 `Access-Control-Allow-Origin`（可为 `*` 或限定主域）。
- 后端 `sys-server` 已内置 `cors()`（默认放行所有源），反代后仍有效。

### 4. micro-app 版本与构建脚本约束

- `@micro-zoe/micro-app` 锁 `1.0.0-rc.32`，勿改 `^1.0.0`。
- `build` 脚本必须保持 `vue-tsc --noEmit && vite build`，勿改 `vue-tsc -b`。

下一步：根据团队基础设施选择对应指南。
