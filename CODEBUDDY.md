# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 常用命令

pnpm 9 workspace monorepo（无测试框架、无 ESLint，"lint" 即类型检查）。

```bash
pnpm install                # 安装全部 workspace 依赖

# 开发（dev server）
pnpm dev                    # 并行启动全部三个应用（完整集成环境）
pnpm dev:main               # 仅基座 main-app → localhost:3000
pnpm dev:doc                # 仅文档子应用 doc-app → localhost:3001（可独立访问）
pnpm dev:sys                # 仅系统管理子应用 sys-app → localhost:3003
pnpm dev:sys-server         # 系统管理后端服务 sys-server → localhost:4000

# 构建与生产预览
pnpm build                  # 全部构建（每个应用 = vue-tsc --noEmit && vite build）
pnpm build:main             # 只构建基座
pnpm preview                # 并行以生产产物启动三端口预览

# 类型检查（等同 lint）
pnpm typecheck              # 全 workspace 递归 vue-tsc --noEmit
pnpm --filter @mic/doc-app typecheck   # 单个应用
```

登录为演示 mock：仅预设账号 `admin` / `user1` / `user2`，统一密码 `12345`（定义在 `packages/utils/src/permission.ts` 的 `ACCOUNT_PRESETS`）；`userStore.login` 用 `findAccount` 校验，失败抛「账号或密码错误」。token 为 `mock-token-<用户名>`。右上角下拉可免密「切换角色」。

## 大局架构

**微前端 monorepo**：Vue 3.5 + Vite 6 + TS + Element Plus + Pinia + `@micro-zoe/micro-app`（固定版本 `1.0.0-rc.32`，无稳定 1.0 正式版，勿改成 `^1.0.0`）。

```
apps/
  main-app   基座：登录鉴权、布局、以 <micro-app iframe> 加载子应用（端口 3000）
  doc-app    子应用：文档发布（端口 3001）
  sys-app    子应用：系统管理（菜单/角色/人员，端口 3003，后端 sys-server:4000）
packages/
  components (@mic/components)  BasicLayout / AppMenu / LoginPage / menuConfig / 主题 / UserAvatar
  utils      (@mic/utils)       request / auth / storage / helpers / constants / micro（环境判断+通信桥）/ permission（预设账号与权限）
```

### 1. 公共包"源码直连"模式

`@mic/utils`、`@mic/components` 的 `package.json` `exports` 直接指向 `src/index.ts`（TS 源码，不打包）。各应用 `vite.config.ts` 中 `optimizeDeps.exclude` 排除这两个包；根 `package.json` 用 `pnpm.overrides` 强制 vue/element-plus 等版本对齐，避免多实例。改公共包源码后各应用 dev server 直接热更新，无需构建公共包。

### 2. 双形态运行（核心设计）

每个子应用既可独立启动，也可被基座集成。所有分支判断都基于 `isMicroEnv()`（读 `window.__MICRO_APP_ENVIRONMENT__`，在 `@mic/utils/micro`）：

- **App.vue**：微前端环境只渲染 `<router-view>`（布局由基座提供）；独立运行时自套 `@mic/components` 的 `BasicLayout mode="standalone"`。
- **router**：`createWebHistory(getBaseRoute())` — 集成时用基座分配的 baseroute（`/doc`、`/perm`），独立时用 `/`；登录守卫仅独立运行时启用，集成时鉴权由基座负责。
- **通信桥**（`packages/utils/src/micro/bridge.ts`）：
  - `getGlobalData` / `emitToMain` / `onMicroMessage` 在集成时走 micro-app 的 dispatch/getData，独立运行降级为 CustomEvent + mitt 本地总线。
  - `onGlobalData(handler)`：子应用监听主应用 `setGlobalData` 下发的数据变化（集成时走 `addDataListener`，独立运行返回 noop），用于切换角色后实时同步 `userInfo`。

新增涉及主子交互的功能时必须同时考虑两种形态。

### 3. 基座加载与主子通信流

- `main-app/src/main.ts`：`microApp.start({ iframe: true })` — 全局 iframe 沙箱（解决 Vite ESM 子应用问题），并 `setGlobalData({ token, userInfo })` 下发。
- 子应用注册表：`main-app/src/micro/apps.ts`，URL 来自 `.env` 的 `VITE_DOC_APP_URL` / `VITE_PERM_APP_URL`。
- 基座路由用通配路由（`/doc/:pathMatch(.*)*` 等）指向 `MicroContainer.vue`：该组件 **同时 `v-for` 挂载全部子应用** 并仅 `v-show="activeAppName"` 切换显隐（实现应用级缓存，见 §4），监听 `@datachange`：子应用 emit `Logout`/`Unauthorized`（消息类型枚举在 `@mic/utils` 的 `MicroMsgType`）→ 基座统一登出；`RefreshUser` → 重新下发全局数据。仅向当前激活子应用 `microApp.router.push` 同步子路由，避免打扰隐藏（已缓存）的应用。
- 基座 `vite.config.ts` 里 vue 插件必须保留 `isCustomElement: tag => tag.startsWith('micro-app')`，否则模板编译报错。

### 4. 两层缓存策略（页面级 + 应用级）

- **页面级（keep-alive）**：子应用 `App.vue` 用 `<router-view v-slot="{ Component }"><keep-alive include="...">` 包裹。被缓存页必须 `defineOptions({ name })` 且名字与 `include` 列表一致：
  - doc-app：`DocList, DocPublish`
  - sys-app：`MenuManage, RoleManage, UserManage`
  两套形态（micro 直接渲染 / BasicLayout 内）均已加 keep-alive。
- **应用级（v-show）**：基座 `MicroContainer` 同时挂载全部 `<micro-app>`，靠 `v-show` 控制 `activeAppName` 显隐，子应用切走不卸载，返回时状态与查询条件保留。

### 5. 账号与权限体系（应用级权限）

权限采用「应用级」划分：每个账号拥有一组应用权限标识（`doc` / `sys`），`'*'` 表示全部。核心文件与分工：

- **预设账号** `packages/utils/src/permission.ts`：`ACCOUNT_PRESETS`（`admin`→`['*']`、`user1`→`['doc']`、`user2`→`['sys']`，密码统一 `DEMO_PASSWORD='12345'`）；工具 `hasAppPermission` / `findAccount` / `SWITCHABLE_ACCOUNTS`。
- **登录校验**：`main-app/src/store/user.ts` 的 `login` 用 `findAccount` 校验；新增 `switchAccount(username)` 免密切换（仅限预设账号）。
- **菜单过滤**：`packages/components/src/menu/config.ts` 的 `filterMenusByPermissions(menus, permissions)` 移除无应用访问权限的顶级分组（无 `appKey` 的项如「首页」始终保留）。基座 `MainLayout.vue` 与子应用 `App.vue` 均按 `userStore.userInfo.permissions` 过滤菜单。
- **路由守卫**：`main-app/src/router/index.ts` 的 `beforeEach` 中，已登录用户访问越权应用（`/doc`、`/sys`）时重定向到 `firstAccessiblePath(permissions)`。
- **切换角色**：`BasicLayout` 右上角 `el-dropdown`（由 `accounts` prop 驱动，当前账号项禁用）+「切换角色」标题；基座 `MainLayout` 监听 `@switch-account` → `userStore.switchAccount` → `microApp.setGlobalData` 重新下发 → 若当前路由越权则 `router.push` 校正；子应用通过 `onGlobalData` 同步 `userInfo`，菜单与权限实时更新。独立运行（无 `accounts`）默认只显示「退出登录」按钮。

### 6. 菜单与登出的集中约定

- 菜单集中配置在 `packages/components/src/menu/config.ts`（`menuConfig` / `getMenusByApp` / `matchMenuKey` / `filterMenusByPermissions`）。菜单激活匹配统一先 `stripAppPrefix` 剥掉 `/doc`、`/perm` 前缀再比较，保证集成/独立两种路径形态下都能正确高亮。
- `BasicLayout` 登出不直接处理跨环境逻辑：standalone 模式自行 `router.push('/login')`，否则 `emit('logout')` 由宿主（基座 MainLayout 或子应用 App.vue）处理；同时 `emit('switch-account', username)` 由宿主处理角色切换。

### 7. 跨域与端口约定

子应用 vite 配置的 `server` 与 `preview` 均需 `cors: true` + `Access-Control-Allow-Origin: *`（两者不共享配置），否则基座无法跨域加载子应用资源。端口固定：3000 基座 / 3001 doc / 3003 sys / 4000 sys-server，与 `main-app/.env` 中的子应用 URL 对应。

### 8. 新增子应用 SOP

1. 复制 `apps/doc-app`，改包名、端口、`baseroute`；
2. 在 `packages/components/src/menu/config.ts` 的 `menuConfig` 添加菜单；
3. 在 `apps/main-app/src/micro/apps.ts` 注册表加一行，并在 `main-app/.env` 加对应 URL 变量；
4. 在基座 `router/index.ts` 加对应通配路由指向 `MicroContainer`；
5. `pnpm install` 后启动。

### 9. 列表页查询条件约定（sys-app）

菜单管理 / 角色管理 / 人员管理三页统一采用 **条件快照** 模式：维护 `query`（表单草稿）与 `activeQuery`（已点击「查询」才生效的条件），用 `computed`（如 `filteredTree` / `filteredRoles` / `filteredUsers`）基于 `activeQuery` 做前端过滤（树形菜单递归过滤）；「重置」清空 `query` 与 `activeQuery`。查询区为浅色卡片（`.search-form`）。保持查询条件在 keep-alive 切换后不丢失（见 §4）。

## 已知约束

- `build` 脚本用 `vue-tsc --noEmit && vite build`，不要改回 `vue-tsc -b`（无 composite 配置）。
- 环境变量：`VITE_API_BASE_URL`（全部应用）、`VITE_DOC_APP_URL`/`VITE_PERM_APP_URL`（main-app）、`VITE_BASE`（子应用生产 base 路径）。
- keep-alive 缓存依赖组件 `name` 与 `include` 列表严格一致；新增需要缓存的页面时，务必在对应 `.vue` 加 `defineOptions({ name })` 并同步 `App.vue` 的 `include`。
- 涉及权限的改动需同步三处：预设账号（`permission.ts`）、菜单过滤（`filterMenusByPermissions`）、路由守卫（越权重定向）。
