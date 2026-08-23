# 系统架构与页面布局说明

本文档基于当前 `mic-admin` 项目实际结构维护，包含系统架构图、数据流向、页面布局结构图，供开发人员快速理解项目。

> 与本文档配套的根目录 `README.md` 为项目总览文档，包含目录结构、核心功能、技术栈与维护方式。

---

## 1. 系统架构图

### 1.1 整体模块关系

项目为 **Vue 3 + Vite + TypeScript + Element Plus + micro-app** 的微前端 Monorepo。基座 `main-app` 以 `<micro-app iframe>` 沙箱加载 5 个子应用，子应用既可被集成运行，也可独立启动。

```mermaid
graph TB
  subgraph Workspace["pnpm Workspace Monorepo"]
    subgraph Base["基座 main-app (端口 3000)"]
      ML["MainLayout<br/>(左右布局)"]
      MC["MicroContainer<br/>(v-show 应用级缓存)"]
      AM["AppMenu / TopNavMenu / TabsView / LayoutActions"]
      US["userStore / tabsStore"]
    end

    subgraph Subs["子应用 (独立可运行)"]
      DASH["dashboard-app<br/>:3002 首页大盘"]
      DOC["doc-app<br/>:3001 文档管理"]
      SYS["sys-app<br/>:3003 系统管理"]
      PROF["profile-app<br/>:3004 个人中心"]
      QA["qa-app<br/>:3005 智能问答"]
    end

    subgraph Pkg["公共包 (源码直连)"]
      COMP["@mic/components<br/>BasicLayout/Menu/Layout/Login/ProTable/theme"]
      UTIL["@mic/utils<br/>request/auth/storage/micro/permission/theme"]
    end

    subgraph Srv["后端"]
      API["sys-server (Express :4000)"]
    end
  end

  Base -->|"micro-app 加载"| Subs
  Subs -->|"通信桥 getGlobalData / emitToMain"| Base
  Base --> Pkg
  Subs --> Pkg
  SYS -->|"HTTP axios"| API
  DOC -->|"内置 Pinia store"| DOC
  DASH -->|"内置数据"| DASH
```

### 1.2 双形态运行（核心设计）

每个子应用依赖 `isMicroEnv()`（`@mic/utils/micro`）判断运行形态：

- **集成形态**：`App.vue` 只渲染 `<router-view>`，布局、菜单、鉴权由基座提供；路由用 `createWebHashHistory`，由基座分配 `baseroute`（`/doc`、`/sys`、`/dashboard`、`/profile`、`/qa`）。
- **独立形态**：自套 `@mic/components` 的 `BasicLayout mode="standalone"`，启用登录守卫（仅 `Login` 与受限页除外）。

```mermaid
graph LR
  Env{"isMicroEnv()?"}
  Env -->|"是 (集成)"| A["渲染 router-view<br/>基座提供布局/菜单/鉴权"]
  Env -->|"否 (独立)"| B["BasicLayout mode=standalone<br/>启用本地登录守卫"]
  A --> C["micro-app 通信桥<br/>setGlobalData / dispatch"]
  B --> D["CustomEvent + mitt 本地总线"]
```

### 1.3 数据流向（鉴权与通信）

```mermaid
sequenceDiagram
  participant U as 用户
  participant M as 基座 main-app
  participant S as 子应用 (doc/sys...)
  participant BK as 后端 sys-server

  U->>M: 登录 (admin/user1/user2, 密码 12345)
  M->>M: userStore.login → findAccount 校验
  M->>M: microApp.setGlobalData({ token, userInfo })
  M->>S: 下发全局数据 (iframe :data)
  S->>S: onGlobalData → 同步 userInfo / theme
  U->>M: 切换角色 (LayoutActions 下拉)
  M->>M: switchAccount → 重新 setGlobalData
  M->>S: 实时同步 userInfo (菜单/权限即时更新)
  S->>BK: axios 携带 token (sys-app)
  BK-->>S: 业务数据
  S-->>M: emitToMain(Logout/Unauthorized) → 基座统一登出
```

要点：
- 登录为演示 mock，预设账号 `admin`/`user1`/`user2`，密码 `12345`（`packages/utils/src/permission.ts` 的 `ACCOUNT_PRESETS`）。
- 权限为「应用级」：`admin→['*']`、`user1→['doc']`、`user2→['sys']`；首页大盘/个人中心/智能问答为公共入口始终保留。
- 跨域：子应用 vite `server` 与 `preview` 均需 `cors: true` + `Access-Control-Allow-Origin: *`，端口固定 3000/3001/3002/3003/3004/3005/4000。

### 1.4 关键组件清单

| 层级 | 关键组件 / 模块 | 职责 |
| --- | --- | --- |
| 基座布局 | `MainLayout.vue` | 左右结构：左 logo+AppMenu+折叠，右 TopNavMenu+TabsView+内容区 |
| 基座容器 | `MicroContainer.vue` | 同时 `v-for` 挂载全部子应用，`v-show` 切换显隐（应用级缓存） |
| 公共布局 | `BasicLayout` | 独立运行时的布局外壳，含 `mode="standalone"` |
| 公共菜单 | `AppMenu` / `TopNavMenu` / `menuConfig` | 侧边菜单 / 顶部水平菜单 / 集中菜单配置 |
| 公共表格 | `ProTable` | 统一表格分页组件（内置请求/分页/排序/合并/多选/单选） |
| 通信桥 | `@mic/utils/micro/bridge.ts` | `getGlobalData`/`emitToMain`/`onGlobalData`/`onMicroMessage` |
| 业务 store | `userStore` / `tabsStore` / `useDocStore` | 用户、页签、文档数据 |

---

## 2. 页面布局结构图

### 2.1 基座布局（集成形态）

基座为 **左右结构**，顶部水平菜单（5 个顶级分组入口）+ 页签栏（菜单叶子生成）+ 内容区（子应用沙箱）。

```mermaid
graph TB
  Root["main-app 根布局 (MainLayout)"]
  Left["左侧栏 (el-aside)"]
  Right["右侧区"]

  Left --> Logo["Logo 区 + 折叠按钮"]
  Left --> AppMenu["AppMenu<br/>(当前顶级分组的 children)"]

  Right --> TopBar["TopNavMenu (5 顶级入口) + LayoutActions (主题/全屏/用户)"]
  Right --> Tabs["TabsView (页签栏, 菜单叶子生成)"]
  Right --> Content["MicroContainer (子应用 iframe)"]

  Content -->|"v-show 切换"| S1["dashboard-app"]
  Content -->|"v-show 切换"| S2["doc-app"]
  Content -->|"v-show 切换"| S3["sys-app"]
  Content -->|"v-show 切换"| S4["profile-app"]
  Content -->|"v-show 切换"| S5["qa-app"]
```

折叠态：`el-aside` 宽 220px ↔ 64px，加 `transition: width 0.28s`；收起时背景为 `color-mix(in srgb, primary 30%, transparent)`。

### 2.2 子应用独立布局（独立形态）

```mermaid
graph TB
  Sub["子应用 App.vue"]
  Sub -->|"isMicroEnv()=false 且非 /login、非 doc-detail"| BL["BasicLayout mode=standalone<br/>+ 左侧菜单 + 内容区"]

  Sub -->|"集成态 / /login / doc-detail"| RV["仅 router-view<br/>(无主导航)"]

  BL --> Content["页面内容<br/>(keep-alive 缓存页面级组件)"]
```

### 2.3 主要页面层级与菜单结构

菜单集中在 `packages/components/src/menu/config.ts`，顺序固定：首页大盘 → 文档管理 → 智能问答 → 个人中心 → 系统管理。

```mermaid
graph LR
  subgraph Menu["menuConfig 顶级分组 → 叶子页"]
    DASH["首页大盘<br/>dashboard"]
    DOC["文档管理<br/>doc"]
    QA["智能问答<br/>qa"]
    PROF["个人中心<br/>profile"]
    SYS["系统管理<br/>sys"]
  end

  DASH --> D1["数据总览 / 访问分析 / 文档统计 / 用户统计 / 系统公告"]
  DOC --> D2["文档列表 / 发布管理 / 新增文档 / 文档预览 / 示例展示*"]
  QA --> D3["新建会话 / 历史会话 / 模型配置"]
  PROF --> D4["个人视图 / 待办事项"]
  SYS --> D5["菜单管理 / 角色管理 / 人员管理"]

  D2 --> D2x["示例展示 → 示例总览 / 多表头 / 自定义插槽 / 单选 / 多选 / 单元格合并"]
```

> `*示例展示` 为 doc-app 下 ProTable 组件演示入口（含 5 类示例）。
> 文章详情页 `doc-detail` **刻意不加入菜单叶子**，仅可由文档列表「详情」按钮进入（受限入口，见 §13 文档规范）。

### 2.4 两层缓存策略

- **页面级（keep-alive）**：子应用 `App.vue` 对 `DocList/DocPublish/DocEdit/DocDetail/DocPreview`（doc-app）与 `MenuManage/RoleManage/UserManage`（sys-app）做 `keep-alive`，组件 `defineOptions({ name })` 须与 `include` 一致。
- **应用级（v-show）**：基座 `MicroContainer` 同时挂载全部 `<micro-app>`，靠 `v-show` 控制 `activeAppName`，切走不卸载，保留状态与查询条件。

---

## 3. 维护要点

- 改公共包（`@mic/components`、`@mic/utils`）源码后各应用 dev server 直接热更新（源码直连，不打包）。
- 涉及权限的改动需同步三处：`permission.ts`（预设账号）、`filterMenusByPermissions`（菜单过滤）、路由守卫（越权重定向）。
- 新增需要缓存的页面：在 `.vue` 加 `defineOptions({ name })` 并同步 `App.vue` 的 `include`。
- 新增子应用 SOP：复制模板 → 改 `menuConfig` → 改 `micro/apps.ts` 注册表与 `.env` URL → 加基座通配路由 → `pnpm install`。
- 文档构建告警（非阻塞）：`md-editor-v3`、`pdfjs-dist` 体积较大，构建时 index chunk 可能超 500kB。
