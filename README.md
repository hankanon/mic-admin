# mic-admin 微前端后台管理系统

基于 Vue 3 + Vite + TypeScript + Element Plus + [micro-app](https://micro-zoe.github.io/micro-app/) 的微前端 Monorepo 基座。

> 详细架构图、数据流向与页面布局结构见 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)。

## 架构概览

```
mic-admin/
├── apps/
│   ├── main-app/       # 基座：登录鉴权、布局、以 <micro-app iframe> 加载子应用（端口 3000）
│   ├── dashboard-app/  # 子应用：首页大盘（数据总览/访问分析/文档统计/用户统计/系统公告，端口 3002）
│   ├── doc-app/        # 子应用：文档管理（列表/发布/编辑/详情/预览/ProTable 示例，端口 3001）
│   ├── sys-app/        # 子应用：系统管理（菜单/角色/人员，端口 3003，后端 sys-server:4000）
│   ├── profile-app/    # 子应用：个人中心（个人视图/待办事项，端口 3004）
│   ├── qa-app/         # 子应用：智能问答（新建会话/历史会话/模型配置，端口 3005）
│   └── sys-server/     # 系统管理后端（Express，端口 4000）
├── packages/
│   ├── components/     # @mic/components: BasicLayout / AppMenu / TopNavMenu / LayoutActions
│   │                  #               / LoginPage / menuConfig / ProTable / theme / UserAvatar
│   └── utils/          # @mic/utils: request / auth / storage / helpers / constants
│                      #            / micro(环境判断+通信桥) / permission / theme
└── docs/               # 架构文档、部署文档
```

- **集成运行**：访问 `main-app`，由其以 `<micro-app iframe>` 加载子应用，主应用提供布局与菜单。
- **独立运行**：子应用脱离主应用直接启动，自动包裹 `@mic/components` 的 `BasicLayout`，可独立开发与调试。

## 技术栈

| 维度 | 选型 |
| --- | --- |
| 框架 | Vue 3.5.40 |
| 构建 | Vite 8.1.5 |
| 语言 | TypeScript 5.9.2 |
| UI | Element Plus 2.14.3 |
| 微前端 | `@micro-zoe/micro-app` 1.0.0-rc.32（固定，勿改 `^1.0.0`） |
| 路由 | vue-router 5.2.0（**注意：非 4.x**；统一 hash 模式） |
| 状态 | Pinia 4.0.2 |
| 请求 | axios 1.18.1 |
| 包管理 | pnpm 9 |
| 运行时 | Node 26 |

## 快速开始

```bash
pnpm install                # 安装全部 workspace 依赖

# 开发（dev server）
pnpm dev                    # 并行启动全部应用（完整集成环境）
pnpm dev:main               # 仅基座 main-app → localhost:3000
pnpm dev:doc                # 仅文档子应用 doc-app → localhost:3001（可独立访问）
pnpm dev:sys                # 仅系统管理子应用 sys-app → localhost:3003
pnpm dev:sys-server         # 系统管理后端服务 sys-server → localhost:4000
pnpm dev:dashboard          # 仅首页大盘 dashboard-app → localhost:3002
pnpm dev:profile            # 仅个人中心 profile-app → localhost:3004
pnpm dev:qa                 # 仅智能问答 qa-app → localhost:3005

# 构建与生产预览
pnpm build                  # 全部构建（每个应用 = vue-tsc --noEmit && vite build）
pnpm build:main             # 只构建基座
pnpm preview                # 并行以生产产物启动多端口预览

# 类型检查（等同 lint，本项目无 ESLint）
pnpm typecheck              # 全 workspace 递归 vue-tsc --noEmit
pnpm --filter @mic/doc-app typecheck   # 单个应用
```

> 登录走后端真实接口（`POST /api/users/login`）：初始账号 `admin` / `editor` / `sysop` / `guest`，统一密码 `123456`；右上角下拉可「切换角色」（多角色账号如 admin 绑定超管/文档编辑/系统管理员三个角色）。

## 本地访问地址

| 应用 | 独立运行地址 | 集成运行入口 |
| --- | --- | --- |
| main-app | http://localhost:3000 | http://localhost:3000 |
| dashboard-app | http://localhost:3002 | http://localhost:3000/dashboard/* |
| doc-app | http://localhost:3001 | http://localhost:3000/doc/* |
| sys-app | http://localhost:3003 | http://localhost:3000/sys/* |
| profile-app | http://localhost:3004 | http://localhost:3000/profile/* |
| qa-app | http://localhost:3005 | http://localhost:3000/qa/* |
| sys-server | http://localhost:4000 | 供 sys-app 调用 |

## 目录结构

```
apps/
  main-app/     基座：main.ts(microApp.start iframe) / layout / micro(apps注册表) / store(user,tabs) / router
  dashboard-app/ 首页大盘子应用
  doc-app/      文档管理子应用（views: DocList/DocPublish/DocEdit/DocDetail/DocPreview/ProTableDemos...）
  sys-app/      系统管理子应用（菜单/角色/人员，条件快照查询）
  profile-app/  个人中心子应用
  qa-app/       智能问答子应用
  sys-server/   系统管理后端（Express）
packages/
  components/   src/: layout/ menu/ login/ business/ guide/ table(ProTable)/ theme/ index.ts
  utils/        src/: request/ auth/ storage/ helpers/ constants/ micro/ permission.ts / theme.ts
docs/
  ARCHITECTURE.md  系统架构图 + 页面布局结构图
  deploy/          部署文档（同源 Nginx / CDN 子域 / Docker）
```

## 核心功能

| 模块 | 功能 |
| --- | --- |
| 基座布局 | 左右结构：左侧 Logo+AppMenu+折叠；右侧 TopNavMenu+TabsView+内容区 |
| 应用级缓存 | MicroContainer 同时挂载全部子应用，靠 `v-show` 切换显隐，切走不卸载 |
| 页面级缓存 | `keep-alive` 缓存 doc-app/sys-app 主要页面（组件 name 与 include 一致） |
| 账号权限 | 应用级权限（admin/user1/user2）；切换角色实时同步菜单与权限 |
| 主题切换 | 明/暗主题（`<html class="dark">` + CSS 变量），跨 iframe 由基座下发同步 |
| 文档管理 | 列表 / 发布 / 编辑(Markdown) / 详情(受限入口) / 预览(PDF) |
| ProTable | 统一表格分页组件：请求状态 / 分页 / 排序 / 列配置插槽 / 多表头 / 单选 / 多选 / 单元格合并 |
| 系统管理 | 菜单 / 角色 / 人员管理，条件快照查询（query ↔ activeQuery） |
| 部署 | 同源 Nginx、CDN 子域、Docker 三套方案（见 docs/deploy） |

## 环境变量

| 变量 | 位置 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 全部应用 | 后端 API 网关地址 |
| `VITE_DASHBOARD_APP_URL` / `VITE_DOC_APP_URL` / `VITE_SYS_APP_URL` / `VITE_PROFILE_APP_URL` / `VITE_QA_APP_URL` | main-app | 子应用资源地址 |
| `VITE_BASE` | 各子应用 | 生产部署 base 路径 |

## 维护方式

- **公共包源码直连**：`@mic/components`、`@mic/utils` 的 `exports` 直接指向 `src/index.ts`（不打包）；`vite.config.ts` 中 `optimizeDeps.exclude` 排除两包，改源码后热更新即时生效。
- **版本对齐**：根 `package.json` 用 `pnpm.overrides` 强制 vue/element-plus 等版本，避免多实例。
- **权限改动三同步**：`permission.ts`（预设账号）、`filterMenusByPermissions`（菜单过滤）、路由守卫（越权重定向）。
- **缓存页面新增**：在 `.vue` 加 `defineOptions({ name })` 并同步 `App.vue` 的 `keep-alive include`。
- **新增子应用 SOP**：复制 `apps/doc-app` 模板 → 改 `menuConfig` → 改 `micro/apps.ts` 注册表与 `.env` URL → 加基座通配路由 → `pnpm install`。
- **TypeScript 固定 5.9.2**：`vue-tsc@3.3.8` 不兼容 TS 7.x 模块布局；`build` 脚本为 `vue-tsc --noEmit && vite build`（勿改 `vue-tsc -b`）。
- **构建体积告警（非阻塞）**：`md-editor-v3`、`pdfjs-dist` 较大，doc-app 构建 index chunk 可能超 500kB。

## 文档

- [系统架构与页面布局](./docs/ARCHITECTURE.md)
- [部署指南](./docs/deploy/README.md)
