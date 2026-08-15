# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 常用命令

pnpm 9 workspace monorepo（无测试框架、无 ESLint，"lint" 即类型检查）。

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

# 类型检查（等同 lint）
pnpm typecheck              # 全 workspace 递归 vue-tsc --noEmit
pnpm --filter @mic/doc-app typecheck   # 单个应用
```

登录为演示 mock：仅预设账号 `admin` / `user1` / `user2`，统一密码 `12345`（定义在 `packages/utils/src/permission.ts` 的 `ACCOUNT_PRESETS`）；`userStore.login` 用 `findAccount` 校验，失败抛「账号或密码错误」。token 为 `mock-token-<用户名>`。右上角下拉可免密「切换角色」。

## 大局架构

**微前端 monorepo**：Vue 3.5.40 + Vite 8.1.5 + TypeScript 5.9.2 + Element Plus 2.14.3 + Pinia 4.0.2 + vue-router 5.2.0（**注意：vue-router 为 5.x，非 4.x**）+ `@micro-zoe/micro-app`（固定版本 `1.0.0-rc.32`，无稳定 1.0 正式版，勿改成 `^1.0.0`）；运行时 Node 26。

```
apps/
  main-app    基座：登录鉴权、布局、以 <micro-app iframe> 加载子应用（端口 3000）
  dashboard-app 子应用：首页大盘（数据总览/访问分析/文档统计/用户统计/系统公告，端口 3002）
  doc-app     子应用：文档管理（端口 3001）
  sys-app     子应用：系统管理（菜单/角色/人员，端口 3003，后端 sys-server:4000）
  profile-app 子应用：个人中心（个人视图/待办事项，端口 3004）
  qa-app      子应用：智能问答（新建会话/历史会话/模型配置，端口 3005）
  sys-server  系统管理后端（Express，端口 4000）
packages/
  components (@mic/components)  BasicLayout / AppMenu / TopNavMenu / LayoutActions / LoginPage / menuConfig / 主题 / UserAvatar
                               + 业务组件 PageCard / SearchForm
  utils      (@mic/utils)       request / auth / storage / helpers / constants / micro（环境判断+通信桥）
                               / permission（预设账号与权限）/ theme（明暗主题）
```

### 1. 公共包"源码直连"模式

`@mic/utils`、`@mic/components` 的 `package.json` `exports` 直接指向 `src/index.ts`（TS 源码，不打包）。各应用 `vite.config.ts` 中 `optimizeDeps.exclude` 排除这两个包；根 `package.json` 用 `pnpm.overrides` 强制 vue/element-plus 等版本对齐，避免多实例。改公共包源码后各应用 dev server 直接热更新，无需构建公共包。

### 2. 双形态运行（核心设计）

每个子应用既可独立启动，也可被基座集成。所有分支判断都基于 `isMicroEnv()`（读 `window.__MICRO_APP_ENVIRONMENT__`，在 `@mic/utils/micro`）：

- **App.vue**：微前端环境只渲染 `<router-view>`（布局由基座提供）；独立运行时自套 `@mic/components` 的 `BasicLayout mode="standalone"`。以下页面例外、即使独立运行也不套布局（只渲染业务内容）：登录页 `/login`、文章详情页 `doc-detail`（见 §13）。
- **router**：`createWebHashHistory('/')` — 本项目用 hash 模式；集成时由基座分配 baseroute（`/doc`、`/sys`、`/dashboard`、`/profile`、`/qa`），独立时用 `/`；登录守卫仅独立运行时启用，集成时鉴权由基座负责。
- **通信桥**（`packages/utils/src/micro/bridge.ts`）：
  - `getGlobalData` / `emitToMain` / `onMicroMessage` 在集成时走 micro-app 的 dispatch/getData，独立运行降级为 CustomEvent + mitt 本地总线。
  - `onGlobalData(handler)`：子应用监听主应用 `setGlobalData` 下发的数据变化（集成时走 `addDataListener`，独立运行返回 noop），用于切换角色后实时同步 `userInfo`。

新增涉及主子交互的功能时必须同时考虑两种形态。

### 3. 基座布局与主子通信流

- `main-app/src/main.ts`：`microApp.start({ iframe: true })` — 全局 iframe 沙箱（解决 Vite ESM 子应用问题），并 `setGlobalData({ token, userInfo })` 下发。
- 子应用注册表：`main-app/src/micro/apps.ts`，URL 来自 `.env` 的 `VITE_DASHBOARD_APP_URL` / `VITE_DOC_APP_URL` / `VITE_SYS_APP_URL` / `VITE_PROFILE_APP_URL` / `VITE_QA_APP_URL`。
- **基座布局为左右结构**（`apps/main-app/src/layout/MainLayout.vue`）：左侧栏（`main-layout__left`）含系统名 logo + `AppMenu` 侧边菜单 + 折叠按钮；右侧含 topbar（`TopNavMenu` 顶部水平菜单 + `LayoutActions` 操作区）、页签栏（`TabsView`）、内容区（`MicroContainer`）。
  - **TopNavMenu**（`packages/components/src/menu/TopNavMenu.vue`）：顶部水平渲染 5 个顶级菜单（首页大盘/文档管理/智能问答/个人中心/系统管理），点击跳转到该分组首个页面，高亮 `isTopActive`；`MainLayout` 据此计算 `childMenus` 传给左侧 `AppMenu`。
  - **LayoutActions**（`packages/components/src/layout/LayoutActions.vue`）：操作指引（driver.js）/ 主题切换 / 全屏 / 用户下拉（含切换角色、退出登录），与顶栏同行不换行。
  - 折叠态：折叠按钮常驻 logo 区，侧边栏加 `is-collapsed`（`color-mix` 主题色 0.3 透明）；首页大盘无子菜单时菜单区白底、logo 区仍为蓝（高亮）。
- 基座路由用通配路由指向 `MicroContainer.vue`：该组件 **同时 `v-for` 挂载全部子应用** 并仅 `v-show="activeAppName"` 切换显隐（实现应用级缓存，见 §4），监听 `@datachange`：子应用 emit `Logout`/`Unauthorized`（消息类型枚举在 `@mic/utils` 的 `MicroMsgType`）→ 基座统一登出；`RefreshUser` → 重新下发全局数据。仅向当前激活子应用 `microApp.router.push` 同步子路由，避免打扰隐藏（已缓存）的应用。
- 基座 `vite.config.ts` 里 vue 插件必须保留 `isCustomElement: tag => tag.startsWith('micro-app')`，否则模板编译报错。

### 4. 两层缓存策略（页面级 + 应用级）

- **页面级（keep-alive）**：子应用 `App.vue` 用 `<router-view v-slot="{ Component }"><keep-alive include="...">` 包裹。被缓存页必须 `defineOptions({ name })` 且名字与 `include` 列表一致：
  - doc-app：`DocList, DocPublish, DocEdit, DocDetail`
  - sys-app：`MenuManage, RoleManage, UserManage`
  两套形态（micro 直接渲染 / BasicLayout 内）均已加 keep-alive。
- **应用级（v-show）**：基座 `MicroContainer` 同时挂载全部 `<micro-app>`，靠 `v-show` 控制 `activeAppName` 显隐，子应用切走不卸载，返回时状态与查询条件保留。

### 5. 账号与权限体系（应用级权限）

权限采用「应用级」划分：每个账号拥有一组应用权限标识（`doc` / `sys`），`'*'` 表示全部。核心文件与分工：

- **预设账号** `packages/utils/src/permission.ts`：`ACCOUNT_PRESETS`（`admin`→`['*']`、`user1`→`['doc']`、`user2`→`['sys']`，密码统一 `DEMO_PASSWORD='12345'`）；工具 `hasAppPermission` / `findAccount` / `SWITCHABLE_ACCOUNTS`。
- **登录校验**：`main-app/src/store/user.ts` 的 `login` 用 `findAccount` 校验；新增 `switchAccount(username)` 免密切换（仅限预设账号）。
- **菜单过滤**：`packages/components/src/menu/config.ts` 的 `filterMenusByPermissions(menus, permissions)` 移除无应用访问权限的顶级分组；**首页大盘(dashboard)、个人中心(profile)、智能问答(qa) 作为公共入口始终保留**（`publicApps`），无 `appKey` 的项（如「首页」）始终保留。基座 `MainLayout.vue` 与子应用 `App.vue` 均按 `userStore.userInfo.permissions` 过滤菜单。
- **路由守卫**：`main-app/src/router/index.ts` 的 `beforeEach` 中，已登录用户访问越权应用（`/doc`、`/sys`）时重定向到 `firstAccessiblePath(permissions)`（dashboard 始终可访问）。
- **切换角色**：`LayoutActions` 右上角 `el-dropdown`（由 `accounts` prop 驱动，当前账号项禁用）+「切换角色」标题；基座 `MainLayout` 监听 `@switch-account` → `userStore.switchAccount` → `microApp.setGlobalData` 重新下发 → 若当前路由越权则 `router.push` 校正；子应用通过 `onGlobalData` 同步 `userInfo`，菜单与权限实时更新。独立运行（无 `accounts`）默认只显示「退出登录」按钮。

### 6. 菜单与登出的集中约定

- 菜单集中配置在 `packages/components/src/menu/config.ts`（`menuConfig` / `getMenusByApp` / `matchMenuKey` / `filterMenusByPermissions`）。菜单激活匹配统一先 `stripAppPrefix` 剥掉 `/dashboard`、`/doc`、`/perm`、`/profile`、`/qa`、`/sys` 前缀再比较，保证集成/独立两种路径形态下都能正确高亮。`AppKey = 'dashboard' | 'doc' | 'profile' | 'qa' | 'sys'`，菜单顺序固定：首页大盘、文档管理、智能问答、个人中心、系统管理。
- `BasicLayout` 登出不直接处理跨环境逻辑：standalone 模式自行 `router.push('/login')`，否则 `emit('logout')` 由宿主（基座 MainLayout 或子应用 App.vue）处理；同时 `emit('switch-account', username)` 由宿主处理角色切换。
- **菜单叶子即页签**：基座级页签由 `menuConfig` 的叶子节点（如 `doc-list` / `doc-edit`）生成（见 §10）。需要「独立页签入口」的功能（如新增文档、文章详情）必须在 `menuConfig` 加对应叶子；反之，不希望出现在导航/页签的功能（如文章详情页）**不要**加菜单叶子，改用按钮跳转 + 路由守卫控制入口（见 §13）。

### 7. 跨域与端口约定

子应用 vite 配置的 `server` 与 `preview` 均需 `cors: true` + `Access-Control-Allow-Origin: *`（两者不共享配置），否则基座无法跨域加载子应用资源。端口固定：3000 基座 / 3001 doc / 3002 dashboard / 3003 sys / 3004 profile / 3005 qa / 4000 sys-server，与 `main-app/.env` 中的子应用 URL 对应。

### 8. 新增子应用 SOP

1. 复制 `apps/doc-app`（或任一子应用），改包名、端口、`baseroute`；
2. 在 `packages/components/src/menu/config.ts` 的 `menuConfig` 添加菜单（注意 `AppKey` 与顶级分组）；
3. 在 `apps/main-app/src/micro/apps.ts` 注册表加一行，并在 `main-app/.env` 加对应 URL 变量；
4. 在基座 `router/index.ts` 加对应通配路由指向 `MicroContainer`；
5. `pnpm install` 后启动。

### 9. 列表页查询条件约定（sys-app）

菜单管理 / 角色管理 / 人员管理三页统一采用 **条件快照** 模式：维护 `query`（表单草稿）与 `activeQuery`（已点击「查询」才生效的条件），用 `computed`（如 `filteredTree` / `filteredRoles` / `filteredUsers`）基于 `activeQuery` 做前端过滤（树形菜单递归过滤）；「重置」清空 `query` 与 `activeQuery`。查询区为浅色卡片（`.search-form`）。保持查询条件在 keep-alive 切换后不丢失（见 §4）。

### 10. 页签（Tab）管理（基座级）

顶部导航栏下方（`TabsView`，由 `MainLayout` 渲染）提供页签栏，对应左侧菜单的「页面级」导航：

- **状态管理**：`apps/main-app/src/store/tabs.ts` 的 `useTabsStore`（Pinia），`tabs: TabItem[]` + `activePath`；`addTab` 按 `path` 去重（重复仅置激活），`closeTab` / `closeOthers` / `closeAll` / `reset` 处理关闭；首页（`/`，key `dashboard-overview`）设为 `affix` 常驻、**不可关闭**。
- **UI 组件**：`apps/main-app/src/components/TabsView.vue`，含横向滚动容器 + 左右滚动箭头（溢出时显示）+ 激活项自动滚入可视区。
- **右键上下文菜单**：基于 `el-dropdown trigger="contextmenu"`，提供「关闭自己」「关闭其他」「关闭全部」三项；常驻首页在「关闭自己」时禁用。
- **自动新增与高亮**：`MainLayout` 用 `watch(route.fullPath, syncTabs, { immediate: true })` 监听路由，按 `matchMenuKey` 找到当前菜单项自动 `addTab`，并 `setActive` 同步高亮；点击页签 `router.push(tab.path)` 切换。
- **生命周期**：`handleLogout` 与 `handleSwitchAccount` 调用 `tabsStore.reset()` 清理越权页签后重新 `syncTabs()`。
- 该栏仅基座 `MainLayout` 渲染（子应用独立运行不显示）。页签对应「基座级页面」（菜单叶子项）；子应用 **内部** 路由切换（iframe 隔离）不会新增基座页签。

### 11. 菜单展开 / 收起（collapse）

侧边菜单支持展开与收起，状态由 `MainLayout` 内部管理，折叠按钮位于左侧 logo 区右侧（`is-collapsed` 时半透明主题色背景），始终可见：

- **展开态**：`el-aside` 宽 `220px`，渲染完整 `AppMenu`（菜单分组 + 子项，激活高亮不变）。
- **收起态**：`el-aside` 宽 `64px`，背景 `color-mix(in srgb, var(--el-color-primary) 30%, transparent)`；首页大盘无子菜单时菜单区白底、logo 区仍为蓝（高亮）。
- **平滑动画**：`el-aside` 加 `transition: width 0.28s ease`。

### 12. 主题（暗黑 / 白天）切换

右上角提供主题切换按钮（太阳/月亮图标，点击切换到对立模式），通过 `<html class="dark">` + 语义化 CSS 变量切换整站色彩：

- **核心模块**：`@mic/utils/src/theme.ts` 的 `useTheme()`（模块级单例 `currentTheme` + `initTheme` / `toggleTheme` / `setTheme`）；语义变量与暗黑覆盖在 `@mic/components/theme/variables.css`（`:root` 与 `html.dark` 两套 `--mic-*`）。
- **状态持久化**：偏好写入 `localStorage`（key `theme`）；`initTheme` 在三个应用 `main.ts` 的 `app.mount` **之前**调用，避免首屏闪烁。
- **系统偏好**：`initTheme` 在 `localStorage` 无值时读取 `prefers-color-scheme`，默认匹配系统。
- **跨应用同步（iframe 隔离）**：基座 `LayoutActions` 按钮 `toggleTheme` 改基座文档 + 更新单例；`MicroContainer.vue` 的 `globalData.theme` 绑定 `currentTheme`，micro-app 在 `:data` 变化时**自动下发**到子应用 iframe → 子应用 `App.vue` 的 `onGlobalData` 收到 `theme` 后 `setTheme` 同步。集成态子应用不读自身存储、以基座下发为准（首屏取 `getGlobalData().theme`）。

### 13. 文档管理子应用（doc-app）功能约定

doc-app 提供文档的列表 / 发布 / 编辑 / 详情，数据来自本地 Pinia store（`apps/doc-app/src/store/doc.ts`，含 `DOC_CATEGORIES`、`DOC_DEFAULT_COVER` 内联 SVG 占位图、`useDocStore`）。

- **Markdown 编辑**：内容编辑用开源组件 `md-editor-v3`（具名导出 `MdEditor` / `MdPreview`，**勿用默认导入**）。封装于 `apps/doc-app/src/components/MarkdownEditor.vue`：
  - `:no-mermaid="true"` 关闭 mermaid 自动从 unpkg CDN 加载（避免进入编辑页时报 `mermaid.min.js ... reading 'mermaid'` 非致命错误，并去掉外部网络依赖）；
  - 跟随 `useTheme()` 同步明暗主题（`editorTheme`）；
  - 工具栏已移除内置 save，对外仅 `v-model`（`update:modelValue`）。
- **主题配图（CoverUpload）**：`apps/doc-app/src/components/CoverUpload.vue` 支持本地上传（读为 dataURL）或填 URL；校验 `image/jpeg|image/png` 且 ≤2MB（`ElMessage` 提示超规格），空值时列表/详情回退到 `DOC_DEFAULT_COVER` 占位图。
- **页面路由与页签**（见 §6 / §10）：菜单叶子 `doc-list` / `doc-publish` / `doc-edit` 生成对应基座页签；`doc-edit` 路由支持 `/edit`（新增）与 `/edit/:id`（编辑）复用同一组件。
- **文章详情页严格访问控制**（重点）：
  - 详情页 `doc-detail`（`/detail/:id`）**刻意不加入菜单 leaf**，因此无法通过主导航 / 页签进入；
  - 进入详情页**只能**由文档列表的「详情」按钮触发：`DocList.goDetail(row)` 先调用 `grantDetailAccess(row.id)`（写入一次性 `sessionStorage` 令牌）再 `router.push`；
  - `apps/doc-app/src/router/detailAccess.ts` 提供 `grantDetailAccess` / `verifyDetailAccess`；`router/index.ts` 的 `beforeEach` 守卫校验：持有匹配令牌 **或** 直接来自 `doc-list` 路由才放行，否则 `ElMessage.error('无权限访问，请通过文档列表进入')` 并 redirect 到 `doc-list`；令牌消费即清除，刷新 / 二次直接进入均被拦截；
  - **隐藏 chrome**：`App.vue` 的 `useLayout` 在 `doc-detail` 路由下为 `false`（连同 `/login`），即独立运行时详情页也不套 `BasicLayout`；集成态详情页本来只渲染 `<router-view>`。

### 14. 业务组件（@mic/components）

- `PageCard`：通用页面卡片，含 `title` / `subtitle` / 默认插槽 / `footer` 插槽 / `bodyPadding`（默认 `true`，置 `false` 时内容区 `padding:0`）。
- `SearchForm`：列表筛选卡片容器（浅色 `.search-form`）。
- `TopNavMenu`：顶部水平菜单（5 个顶级分组入口）。
- `LayoutActions`：操作指引/主题/全屏/用户菜单操作区。

## 已知约束

- `build` 脚本为 `vue-tsc --noEmit && vite build`（类型检查 + 打包）。TypeScript 固定为 `5.9.2`：`vue-tsc@3.3.8` 的 `@volar/typescript` shim 无法在 TS 7.x 新模块布局下定位 tsc，故不升级到 TS 7。请勿改回 `vue-tsc -b`（无 composite 配置）。
- 环境变量：`VITE_API_BASE_URL`（全部应用）、`VITE_DASHBOARD/ DOC/ SYS/ PROFILE/ QA_APP_URL`（main-app）、`VITE_BASE`（子应用生产 base 路径）。
- keep-alive 缓存依赖组件 `name` 与 `include` 列表严格一致；新增需要缓存的页面时，务必在对应 `.vue` 加 `defineOptions({ name })` 并同步 `App.vue` 的 `include`。
- 涉及权限的改动需同步三处：预设账号（`permission.ts`）、菜单过滤（`filterMenusByPermissions`，注意 `publicApps` 公共入口）、路由守卫（越权重定向）。
- `md-editor-v3` 必须具名导入（`import { MdEditor }`）；编辑器体积较大，`doc-app` 构建时 `index` chunk 会超过 500kB（体积告警，非阻塞，不影响运行）。如要优化首屏可对编辑器做动态 `import()` 分包。
- 文章详情页属于「受限入口」页面：**不要**在 `menuConfig` 为其加菜单叶子，且任何改到 `App.vue` 的 `useLayout` 或路由守卫的改动都要保持「详情页隐藏布局 + 仅列表可进」的约束。
- vue-router 实际版本为 `5.2.0`（非 4.x）；集成路由统一用 hash 模式（`createWebHashHistory`）。
