# mic-admin 微前端后台管理系统

基于 Vue 3 + Vite + TypeScript + Element Plus + [micro-app](https://micro-zoe.github.io/micro-app/) 的微前端 Monorepo 基座。

## 架构概览

```
mic-admin/
├── apps/
│   ├── main-app/   # 主应用（基座）：加载子应用、布局、登录鉴权、通信
│   ├── doc-app/    # 子应用：文档发布系统
│   └── perm-app/   # 子应用：权限管理系统
├── packages/
│   ├── components/ # 公共组件：BasicLayout / AppMenu / LoginPage / menuConfig
│   └── utils/      # 公共工具：request / auth / storage / constants / helpers / micro
```

- **集成运行**：访问 `main-app`，由其以 `<micro-app iframe>` 加载子应用，主应用提供布局与菜单。
- **独立运行**：子应用脱离主应用直接启动，自动包裹 `@mic/components` 的 `BasicLayout`，可独立开发与调试。

## 技术栈

| 维度 | 选型 |
| --- | --- |
| 框架 | Vue ^3.5 |
| 构建 | Vite ^6 |
| 语言 | TypeScript ^5.7 |
| UI | Element Plus ^2.9 |
| 微前端 | micro-app ^1.0 |
| 路由 | vue-router ^4.5 |
| 状态 | Pinia ^2.3 |
| 请求 | axios ^1.7 |
| 包管理 | pnpm ^9 |

## 快速开始

```bash
pnpm install            # 安装全部 workspace 依赖

pnpm dev:main           # 只起主应用（localhost:3000）
pnpm dev:doc            # 只起文档子应用（localhost:3001，可独立访问调试）
pnpm dev:perm           # 只起权限子应用（localhost:3002）

pnpm dev                # 并行起所有应用，模拟完整集成环境
pnpm build              # 全部构建
```

## 本地访问地址

| 应用 | 独立运行地址 | 集成运行入口 |
| --- | --- | --- |
| main-app | http://localhost:3000 | http://localhost:3000 |
| doc-app | http://localhost:3001 | http://localhost:3000/doc/* |
| perm-app | http://localhost:3002 | http://localhost:3000/perm/* |

## 环境变量

| 变量 | 位置 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 全部应用 | 后端 API 网关地址 |
| `VITE_DOC_APP_URL` / `VITE_PERM_APP_URL` | main-app | 子应用资源地址 |
| `VITE_BASE` | 各子应用 | 生产部署 base 路径 |

## 新增子应用 SOP

1. 复制 `apps/doc-app` 模板，改名并调整端口 / `baseroute`；
2. 在 `packages/components/src/menu/config.ts` 的 `menuConfig` 中添加菜单；
3. 在 `apps/main-app/src/micro/apps.ts` 注册表加一行；
4. `pnpm install` 后即可启动。
