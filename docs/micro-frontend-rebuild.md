# 微前端后台管理系统 · 重建设计文档

> 本文件是 `mic-admin` 仓库的**重建设计文档**（原早期设计稿 `micro-frontend-design.md` 已删除，其核心架构思路在此以"设计 + 落地"双视角重建）。
> 目标：既讲清**为什么这么设计**（演进背景、技术选型、模块划分、通信与路由策略），也给出**如何从零重建出相同效果**的实操路径。所有命令、端口、版本、env 变量均以当前真实代码为准。

---

## 0. 文档说明

| 项 | 内容 |
| --- | --- |
| 适用范围 | 从零重新搭建一份效果一致的后台微前端系统 |
| 与旧稿关系 | 旧稿为"从零设计"阶段产物，存在偏差（如 `perm-app`、Vite 5、无缓存/权限/后端）；本文以**实际落地代码**为准重建 |
| 阅读顺序 | 设计篇（§1–§8）→ 实现篇（§9–§15） |

---

## 1. 演进背景

### 1.1 单体后台的痛点

传统单仓库后台在业务增长后会暴露典型问题：

- **整站构建**：任一模块改动都触发全量打包，构建与发布成本高。
- **技术栈牵一发动全身**：老模块难升级，新特性受限于旧框架版本。
- **团队耦合**：多团队在同一代码库协作，需求排期互相阻塞。
- **独立交付困难**：子业务（如"系统管理"）无法独立部署、独立验证。

### 1.2 微前端方案的技术演进

微前端是"将不同技术栈、不同团队开发的多个应用，聚合为一个产品"的架构：

| 阶段 | 方案 | 代表 | 局限 |
| --- | --- | --- | --- |
| 早期 | 原生 iframe | — | 通信难、路由/弹窗割裂、体验差 |
| 中期 | 路由分发 | single-spa | 需统一框架、沙箱弱 |
| 成熟期 | 应用级沙箱 | qiankun | 对 Vite ESM 不友好 |
| 本项目 | 组件化 + iframe 沙箱 | `@micro-zoe/micro-app` | 版本固定（见 §2.2） |

**选型 micro-app 的动因**：以类 Web Component 的 `<micro-app>` 标签接入，侵入性低；提供 JS 沙箱、样式隔离、数据通信 API；并用 `iframe: true` 模式兼容 Vite 的 ESM 产物（直接加载 Vite dev server 子应用而不必预构建）。

### 1.3 本项目的演进路径（设计 → 落地）

```
设计稿（早期）                    落地实现（当前代码）
─────────────────               ─────────────────
doc-app + perm-app   ───────▶   doc-app + sys-app（命名按职责收敛）
Vite 5               ───────▶   Vite 6
基座 history 路由    ───────▶   基座 hash 路由（部署静态化更稳）
^1.0.0 micro-app    ───────▶   锁 1.0.0-rc.32（无稳定 1.0）
无后端              ───────▶   补 sys-server（端口 4000，菜单/角色/人员 mock）
仅"可独立运行"      ───────▶   两层缓存（页面级 keep-alive + 应用级 v-show）
笼统权限            ───────▶   应用级权限 + 预设账号 + 切换角色 + 路由守卫
任意账号登录        ───────▶   预设账号校验（admin/user1/user2）
```

---

## 2. 技术选型与调整说明

### 2.1 最终技术栈

| 类别 | 选型 | 版本 / 取值 | 备注 |
| --- | --- | --- | --- |
| 包管理 | pnpm workspaces | 9 | 无测试框架、无 ESLint |
| 微前端 | `@micro-zoe/micro-app` | **`1.0.0-rc.32`**（固定） | 勿写 `^1.0.0` |
| 前端框架 | Vue + Vite + TS | Vue `3.5` / Vite `6` | |
| UI 组件 | Element Plus | 最新稳定 | 多实例风险用 `pnpm.overrides` 抑制 |
| 状态管理 | Pinia | — | `userStore` 承载登录态/权限 |
| 基座路由 | Vue Router | `createWebHashHistory` | hash 模式 |
| 子应用路由 | Vue Router | `createWebHashHistory(getBaseRoute())` | base 由宿主分配 |
| 请求 | axios（封装于 `@mic/utils/request`） | — | baseURL = `VITE_API_BASE_URL` |
| 后端 | Node + ESM 纯 TS 服务 | — | `sys-server`，端口 4000 |
| 通信 | micro-app API + 降级总线 | — | 见 §6 |

### 2.2 关键调整说明

| 调整项 | 早期设计 | 落地实现 | 调整原因 |
| --- | --- | --- | --- |
| 权限子应用 | `perm-app`（端口 3002） | `sys-app`（端口 3003） | 名称按"系统管理"职责收敛，端口统一规划 |
| 构建工具版本 | Vite 5 | Vite 6 | 跟随生态，fix ESM 加载问题 |
| 基座路由模式 | history | hash | 静态托管免服务端 rewrite，部署更稳 |
| micro-app 版本 | `^1.0.0` | `1.0.0-rc.32` | 无稳定 1.0 正式版，固定 rc 避免意外升级 |
| 系统管理后端 | 未规划 | 新增 `sys-server` | 菜单/角色/人员需持久 mock 数据源 |
| 运行形态 | 仅"可独立运行" | 独立运行 + 集成运行**均双形态** | 同一份代码两种入口 |
| 缓存 | 未涉及 | 两层缓存 | 解决切换丢查询条件 |
| 权限 | 笼统 | 应用级 + 预设账号 + 切换角色 + 路由守卫 | 多角色真实隔离 |
| 登录 | 任意用户名/密码 | 预设账号校验（密码 12345） | 演示可复现、权限可信 |

---

## 3. 总体架构

### 3.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       浏览器（Hash 路由）                      │
│  localhost:3000  ── 基座 main-app ───────────────────────┐   │
│   ├─ /            → 首页（基座内）                         │   │
│   ├─ /doc/*       → MicroContainer → <micro-app iframe>   │   │
│   └─ /sys/*       → MicroContainer → <micro-app iframe>   │   │
└───┼───────────────────────────────┼─────────────────────┼───┘
    │ 加载(iframe 沙箱)              │ 加载(iframe 沙箱)    │
    ▼                               ▼                      ▼
┌─────────┐                    ┌─────────┐          ┌──────────────┐
│ doc-app │ 端口 3001          │ sys-app │ 端口 3003│  sys-server  │ 端口 4000
│ 文档发布 │                    │ 系统管理 │          │  /api/menus  │
└─────────┘                    └─────────┘          │  /api/roles  │
      ▲ 依赖                           ▲ 依赖        │  /api/users  │
      └──────────── @mic/utils ────────┴────────────┘              │
      └──────────── @mic/components ───────────────────────────────┘
        （公共包：源码直连，不打包，dev 即热更新）
```

### 3.2 运行形态对照

| 维度 | 集成运行（被基座加载） | 独立运行（直接 dev） |
| --- | --- | --- |
| 入口 | 基座 `MicroContainer` 加载 | 子应用自身 `pnpm dev:doc` |
| 布局 | 由基座 `MainLayout` 提供 | 自套 `BasicLayout mode="standalone"` |
| 路由 base | `__MICRO_APP_BASE_ROUTE__`（`/doc`、`/sys`） | `/` |
| 登录态 | 基座下发 `setGlobalData` | 本地 `LoginPage` 登录 |
| 登出/切角色 | 宿主（基座）处理 | 自身处理 |
| 菜单来源 | `filterMenusByPermissions(menuConfig, 全局权限)` | `getMenusByApp('doc'\|'sys')` |

---

## 4. 模块划分

### 4.1 monorepo 目录结构

```
mic-admin/
├─ package.json            # 根：scripts + pnpm.overrides 版本对齐
├─ pnpm-workspace.yaml     # packages: ['apps/*', 'packages/*']
├─ tsconfig.base.json      # 公共 ts 配置（strict、paths）
├─ apps/
│  ├─ main-app/            # 基座（端口 3000）
│  ├─ doc-app/             # 文档发布子应用（端口 3001）
│  ├─ sys-app/             # 系统管理子应用（端口 3003）
│  └─ sys-server/          # 系统管理后端（端口 4000）
└─ packages/
   ├─ utils/               # @mic/utils（源码直连）
   └─ components/          # @mic/components（源码直连）
```

### 4.2 workspace 配置

**`pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**根 `package.json` 关键字段**

```jsonc
{
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "dev:main": "pnpm --filter @mic/main-app dev",
    "dev:doc": "pnpm --filter @mic/doc-app dev",
    "dev:sys": "pnpm --filter @mic/sys-app dev",
    "dev:sys-server": "pnpm --filter @mic/sys-server dev",
    "build": "pnpm -r build",
    "build:main": "pnpm --filter @mic/main-app build",
    "preview": "pnpm -r --parallel preview",
    "typecheck": "pnpm -r typecheck"
  },
  "pnpm": {
    "overrides": {
      "vue": "3.5.x",
      "element-plus": "x.x.x"   // 强制版本对齐，避免多实例
    }
  }
}
```

### 4.3 应用职责

| 应用 | 职责 | 关键文件 |
| --- | --- | --- |
| `main-app` | 登录鉴权、统一布局、加载子应用、权限下发、路由守卫 | `main.ts` / `micro/apps.ts` / `router/index.ts` / `views/MicroContainer.vue` / `layout/MainLayout.vue` / `store/user.ts` |
| `doc-app` | 文档发布（列表/发布） | `App.vue` / `router/index.ts` / `views/DocList.vue` / `views/DocPublish.vue` |
| `sys-app` | 系统管理（菜单/角色/人员，对接 sys-server） | `App.vue` / `router/index.ts` / `views/MenuManage.vue` 等 |
| `sys-server` | 菜单/角色/人员 mock 后端 | `src/index.ts` / `src/routes/*.ts` / `src/store.ts` |

### 4.4 公共包职责

**`@mic/utils` 模块表（`src/index.ts` 聚合导出）**

| 模块 | 职责 |
| --- | --- |
| `request` | axios 封装（baseURL / 拦截器 / token 注入） |
| `storage` | 本地存储（token / userInfo） |
| `auth` | 登录态读写、清除 |
| `constants` | 全局常量（如 `MicroMsgType` 消息类型枚举） |
| `helpers` | 通用函数（如 `firstAccessiblePath`） |
| `micro` | 环境判断 + 通信桥（见 §6） |
| `permission` | 预设账号与权限（见 §8） |

**`@mic/components` 导出表（`src/index.ts`）**

| 类别 | 导出 |
| --- | --- |
| 布局/组件 | `BasicLayout` / `AppMenu` / `LoginPage` / `UserAvatar` / `Breadcrumb` / `PageCard` |
| 菜单配置 | `menuConfig` / `getMenusByApp` / `stripAppPrefix` / `matchMenuKey` / `filterMenusByPermissions` |
| 类型 | `MenuItem` / `AppKey` |

### 4.5 版本与依赖治理（源码直连）

- 公共包 `package.json` 的 `exports` 直接指向 `src/index.ts`（TS 源码，不打包）。
- 各应用 `vite.config.ts` 必须 `optimizeDeps.exclude: ['@mic/utils', '@mic/components']`，使公共包源码被 dev server 直接编译、热更新。
- 根 `pnpm.overrides` 强制 vue / element-plus 等版本对齐，避免微前端多实例导致的样式/状态异常。

---

## 5. 核心设计：双形态运行机制

每个子应用同一份代码同时支持"集成运行"与"独立运行"，**所有分支基于 `isMicroEnv()`**（读 `window.__MICRO_APP_ENVIRONMENT__`，在 `@mic/utils/micro`）。

**`App.vue` 形态分支**

```vue
<template>
  <!-- 集成态：只渲染路由出口（布局由基座提供），并加 keep-alive -->
  <router-view v-slot="{ Component }" v-if="isMicroEnv()">
    <keep-alive :include="CACHE_LIST"><component :is="Component" /></keep-alive>
  </router-view>
  <!-- 独立态：自套 BasicLayout -->
  <BasicLayout v-else mode="standalone" :menus="menus" :user-info="userInfo">
    <router-view v-slot="{ Component }">
      <keep-alive :include="CACHE_LIST"><component :is="Component" /></keep-alive>
    </router-view>
  </BasicLayout>
</template>
```

- 缓存名单（务必与组件 `name` 一致）：doc-app `DocList,DocPublish`；sys-app `MenuManage,RoleManage,UserManage`。
- 被缓存页必须 `defineOptions({ name: 'DocList' })` 等。
- 登录守卫**仅独立运行**启用；集成态鉴权由基座负责。

---

## 6. 应用间通信机制

所有通信统一收敛到 `@mic/utils/micro` 的封装层，**集成态走 micro-app 原生 API，独立态自动降级为本地总线（CustomEvent + mitt）**，业务代码无需关心当前形态。

### 6.1 封装层 API

| 方法 | 集成态实现 | 独立态实现 |
| --- | --- | --- |
| `isMicroEnv()` | 读 `window.__MICRO_APP_ENVIRONMENT__` | 同左（false） |
| `getGlobalData()` | `microApp.getData()` | 返回本地 userInfo |
| `setGlobalData(data)` | `microApp.setGlobalData(data)` | 触发本地 CustomEvent |
| `emitToMain(msg)` | `microApp.router.dispatch` / `dispatch` | mitt emit |
| `onMicroMessage(handler)` | `addDataListener` 解析消息 | mitt on |
| `onGlobalData(handler)` | `addDataListener`（全局数据变化） | noop（独立态无主下发） |

### 6.2 主 → 子（下发）

基座登录后 `microApp.setGlobalData({ token, userInfo })`；`MicroContainer` 渲染 `<micro-app :data="{ token, userInfo }">` 也会随元素透传。子应用通过 `getGlobalData()` 取初始值，`onGlobalData()` 监听变更。

### 6.3 子 → 主（上报）

子应用通过 `emitToMain` 发送消息，类型枚举在 `@mic/utils/constants`（`MicroMsgType`）：

| 消息 | 触发时机 | 基座处理 |
| --- | --- | --- |
| `Logout` | 子应用内退出 | 统一清登录态、跳登录页 |
| `Unauthorized` | 收到 401 | 统一登出 |
| `RefreshUser` | 用户信息变更 | 重新 `setGlobalData` 下发 |

基座在 `MicroContainer` 监听 `@datachange` 统一分发。

### 6.4 子 → 子

**原则**：子应用之间不直接通信，必须经基座中转（如切角色 → 基座重发全局数据 → 各子应用 `onGlobalData` 同步）。避免跨子应用耦合。

### 6.5 切换角色实时同步链路

```
用户点击「切换角色」(BasicLayout dropdown)
  → emit('switch-account', username)
  → 基座 MainLayout 监听
     1. userStore.switchAccount(username)        // 仅预设账号，免密
     2. microApp.setGlobalData({ token, userInfo })   // 重新下发
     3. 若当前路由越权 → router.push 校正
  → 各子应用 onGlobalData 回调
     → 更新 userInfo / permissions
     → 菜单 filterMenusByPermissions 重算 → 即时高亮变化
```

---

## 7. 路由策略

### 7.1 路由分工

| 层 | 角色 | 模式 | base |
| --- | --- | --- | --- |
| 基座 | 宿主壳 + 通配加载 | `createWebHashHistory()` | `/` |
| 子应用 | 业务页 | `createWebHashHistory(getBaseRoute())` | 集成 `/doc`、`/sys`；独立 `/` |

子应用 `getBaseRoute()`：`isMicroEnv() ? window.__MICRO_APP_BASE_ROUTE__ : '/'`。

### 7.2 通配路由与 MicroContainer

基座 `router/index.ts`：

```ts
{ path: '/doc/:pathMatch(.*)*', component: MicroContainer },
{ path: '/sys/:pathMatch(.*)*', component: MicroContainer },
```

`MicroContainer` 同时 `v-for` 挂载全部 `<micro-app>`，按 `activeAppName` 用 `v-show` 显隐（应用级缓存，见 §9）。仅向**当前激活**子应用 `microApp.router.push` 同步子路由，避免打扰已缓存的隐藏应用。

> 注意：`vite.config.ts` 的 `@vitejs/plugin-vue` 必须保留 `isCustomElement: tag => tag.startsWith('micro-app')`，否则 `<micro-app>` 编译报错。

### 7.3 激活菜单同步

菜单高亮统一先 `stripAppPrefix(path)` 剥掉 `/doc`、`/sys` 前缀再比较，保证集成/独立两种路径形态下高亮一致。

### 7.4 权限守卫（越权重定向）

基座 `beforeEach`：已登录用户访问越权应用（按 `userInfo.permissions` + `hasAppPermission`）时 `router.push(firstAccessiblePath(permissions))`，避免无权限用户直接输入 URL 进入受限子应用。

---

## 8. 账号与权限体系（应用级权限）

权限采用「应用级」划分：账号拥有应用权限标识集合（`doc` / `sys`），`'*'` 表示全部。

### 8.1 预设账号（`@mic/utils/permission.ts`）

```ts
export const DEMO_PASSWORD = '12345'
export const ACCOUNT_PRESETS = [
  { username: 'admin', password: DEMO_PASSWORD, nickname: '管理员',   permissions: ['*'] },
  { username: 'user1', password: DEMO_PASSWORD, nickname: '文档员',   permissions: ['doc'] },
  { username: 'user2', password: DEMO_PASSWORD, nickname: '系统管理员', permissions: ['sys'] },
]
export const SWITCHABLE_ACCOUNTS = ACCOUNT_PRESETS.map(({ username, nickname }) => ({ username, nickname }))
export const hasAppPermission = (permissions: string[], appKey: string) =>
  permissions.includes('*') || permissions.includes(appKey)
export const findAccount = (username: string, password: string) =>
  ACCOUNT_PRESETS.find(a => a.username === username && a.password === password)
```

### 8.2 登录与切换（`main-app/src/store/user.ts`）

- `login(username, password)`：`findAccount` 校验失败抛「账号或密码错误」；token 形如 `mock-token-<用户名>`。
- `switchAccount(username)`：仅限预设账号，重算 `userInfo` / `permissions`，免密。

### 8.3 菜单过滤与路由守卫

- `filterMenusByPermissions(menus, permissions)`（`@mic/components/menu/config`）：移除无应用访问权的顶级分组；无 `appKey` 项（如「首页」）始终保留。基座 `MainLayout` 与子应用 `App.vue` 均按 `permissions` 过滤。
- 路由守卫见 §7.4。

### 8.4 切换角色 UI

`BasicLayout` 右上角 `el-dropdown`：`accounts` prop 驱动（当前账号项 `disabled`）+「切换角色」标题 + 分隔线 +「退出登录」；独立运行（无 `accounts`）只显示「退出登录」。事件经 `@switch-account` 由宿主处理（见 §6.5）。

---

## 9. 缓存策略（两层）

| 层 | 机制 | 解决 |
| --- | --- | --- |
| 页面级 | 子应用 `App.vue` 用 `<keep-alive :include="...">` 包裹 `router-view` | 子应用**内**页面切换（如 DocList↔DocPublish）不丢查询条件 |
| 应用级 | 基座 `MicroContainer` `v-for` 同时挂载全部 `<micro-app>`，`v-show` 按 `activeAppName` 显隐 | 子应用**间**切换（doc↔sys）不卸载，返回保留状态 |

约束：keep-alive 依赖组件 `name` 与 `include` 严格一致；新增缓存页须同步 `defineOptions({ name })` 与 `include`。

---

## 10. 列表页查询条件约定（sys-app）

菜单 / 角色 / 人员三页统一 **条件快照** 模式：

```ts
const query = reactive({ /* 表单草稿 */ })
const activeQuery = ref({})           // 仅点「查询」才生效
const filteredXxx = computed(() => filterBy(source, activeQuery.value))
function onSearch() { activeQuery.value = { ...query } }
function onReset()  { Object.assign(query, initial); activeQuery.value = {} }
```

- 树形菜单用递归过滤（`filteredTree`）；角色/人员用数组过滤。
- 查询区为浅色卡片（`.search-form` class）。
- keep-alive 保障切换后条件不丢（见 §9）。

---

## 11. 后端 sys-server

- 纯 TS + ESM 服务（端口 4000），`src/index.ts` 起服务；`src/routes/*.ts` 定义 `/api/menus`、`/api/roles`、`/api/users`；`src/store.ts` 内存 mock；`src/response.ts` 统一返回结构。
- sys-app 经 `@mic/utils/request`（baseURL = `VITE_API_BASE_URL`，开发态 `/api`，由 vite 代理到 4000）访问。

---

## 12. 跨域 / 端口 / 环境变量

- 子应用 `vite.config.ts` 的 `server` **与** `preview` 均需：
  ```ts
  cors: true,
  headers: { 'Access-Control-Allow-Origin': '*' }
  ```
  （`server` 与 `preview` 不共享配置，两处都要写，否则基座无法跨域加载子应用资源。）
- 端口固定：3000 基座 / 3001 doc / 3003 sys / 4000 sys-server。
- 环境变量（`apps/main-app/.env`）：
  ```
  VITE_API_BASE_URL=/api
  VITE_DOC_APP_URL=http://localhost:3001
  VITE_SYS_APP_URL=http://localhost:3003
  ```
  另有 `VITE_BASE`（子应用生产 base 路径，全部应用读取 `VITE_API_BASE_URL`）。

---

## 13. 已知约束（重建务必遵守）

- `build` 脚本 `vue-tsc --noEmit && vite build`，勿改回 `vue-tsc -b`（无 composite 配置）。
- micro-app 版本锁 `1.0.0-rc.32`，勿升 `^1.0.0`。
- 公共包 `exports` 指向 `src/index.ts` 且各应用 `optimizeDeps.exclude`，否则多实例 / 热更新失效。
- keep-alive 组件 `name` 与 `include` 严格一致。
- 权限改动需同步三处：预设账号（`permission.ts`）、菜单过滤（`filterMenusByPermissions`）、路由守卫（越权重定向）。
- 基座 vue 插件保留 `isCustomElement: tag => tag.startsWith('micro-app')`。

---

## 14. 新建子应用 SOP

1. 复制 `apps/doc-app`，改包名、`vite.config` 端口、`baseroute`、`getBaseRoute` 的 appKey。
2. `packages/components/src/menu/config.ts` 的 `menuConfig` 加菜单（带 `appKey`）。
3. `main-app/src/micro/apps.ts` 注册表加一行，并在 `main-app/.env` 加 `VITE_XXX_APP_URL`。
4. `main-app/src/router/index.ts` 加对应通配路由指向 `MicroContainer`。
5. `pnpm install` 后启动。

---

## 15. 验证清单

```bash
pnpm install
pnpm typecheck          # 全 workspace 递归 vue-tsc --noEmit，应零错误
pnpm dev                # 并行启动三应用
```

手动验证：

1. `localhost:3000` 用 `admin / 12345` 登录 → 可见全部菜单。
2. doc-app 列表页输入查询 → 切到发布页再返回，条件仍在（页面级缓存）。
3. 切到 sys-app 操作 → 返回 doc-app，doc 页面状态保留（应用级 `v-show` 缓存）。
4. 右上角「切换角色」选 `user1` → 仅余文档管理；`user2` → 仅余系统管理；越权直访 `/sys` 被重定向。
5. 子应用独立运行：`pnpm dev:doc` → `localhost:3001` 自套布局与菜单，可直接使用。
6. `pnpm dev:sys-server` → `localhost:4000` 返回菜单/角色/人员数据。
