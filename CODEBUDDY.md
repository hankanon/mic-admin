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

**微前端 monorepo**：Vue 3.5.40 + Vite 8.1.5 + TypeScript 5.9.2 + Element Plus 2.14.3 + Pinia 4.0.2 + vue-router 5.2.0 + `@micro-zoe/micro-app`（固定版本 `1.0.0-rc.32`，无稳定 1.0 正式版，勿改成 `^1.0.0`）；运行时 Node 26。

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

### 10. 页签（Tab）管理（基座级）

顶部导航栏下方（`BasicLayout` 的 `#tabs` 插槽）提供页签栏，对应左侧菜单的「页面级」导航：

- **状态管理**：`apps/main-app/src/store/tabs.ts` 的 `useTabsStore`（Pinia），`tabs: TabItem[]` + `activePath`；`addTab` 按 `path` 去重（重复仅置激活），`closeTab` / `closeOthers` / `closeAll` / `reset` 处理关闭；首页（`/`）设为 `affix` 常驻、**不可关闭**。
- **UI 组件**：`apps/main-app/src/components/TabsView.vue`，含横向滚动容器 + 左右滚动箭头（溢出时显示）+ 激活项自动滚入可视区。
- **右键上下文菜单**：基于 `el-dropdown trigger="contextmenu"`，提供「关闭自己」「关闭其他」「关闭全部」三项；常驻首页在「关闭自己」时禁用。
- **自动新增与高亮**：`MainLayout` 用 `watch(route.fullPath, syncTabs, { immediate: true })` 监听路由，按 `matchMenuKey` 找到当前菜单项自动 `addTab`，并 `setActive` 同步高亮；点击页签 `router.push(tab.path)` 切换。
- **生命周期**：`handleLogout` 与 `handleSwitchAccount` 调用 `tabsStore.reset()` 清理越权页签后重新 `syncTabs()`。
- 该栏仅基座 `MainLayout` 注入（子应用独立运行不传 `#tabs`，不显示）。页签对应「基座级页面」（菜单叶子项）；子应用 **内部** 路由切换（iframe 隔离）不会新增基座页签。

### 11. 菜单展开 / 收起（collapse）

侧边菜单支持展开与收起，状态由 `BasicLayout` 内部 `collapsed` 管理，底部「折叠按钮」（Fold / Expand 图标）切换：

- **展开态**：`el-aside` 宽 `220px`，渲染完整 `AppMenu`（菜单分组 + 子项，激活高亮不变），布局结构与之前一致。
- **收起态**：`el-aside` 宽 `64px`，不再渲染 `AppMenu`，改为仅遍历**顶级菜单项**的「图标栏」（`collapse-bar`）：每个子应用（home / doc / sys）仅显示一个图标，`flex` 竖向居中、统一 `46×46` 尺寸与 `8px` 间距；当前路由落在某子应用范围内时该图标高亮（`isTopActive`）。
- **悬浮提示**：收起态每个图标包 `el-tooltip`（placement `right`）展示对应子应用 `title`（如「文档发布」）；图标被 `el-aside` 裁剪但 tooltip 经 teleport 到 body 显示到主区域，不受 `overflow:hidden` 影响。
- **点击导航**：收起态点击图标 → `goTop(item)` 跳转到该子应用首个页面（顶级 `path` 或 `children[0].path`），`host` / `standalone` 依 `mode` 走前缀逻辑，与页签同步联动。
- **平滑动画**：`el-aside` 加 `transition: width 0.28s ease`，展开/收起时侧边栏宽度平滑过渡，不影响路由、页签与内容区。
- 该功能仅依赖 `BasicLayout` 内部状态，基座（`MainLayout`）与子应用独立运行（`App.vue` standalone）自动获得，无需宿主额外接入。

### 12. 主题（暗黑 / 白天）切换

右上角提供主题切换按钮（太阳/月亮图标，点击切换到对立模式），通过 `<html class="dark">` + 语义化 CSS 变量切换整站色彩：

- **核心模块**：`@mic/utils/src/theme.ts` 的 `useTheme()`（模块级单例 `currentTheme` + `initTheme` / `toggleTheme` / `setTheme`），导出到 `@mic/utils`；语义变量与暗黑覆盖在 `@mic/components/theme/variables.css`（`:root` 与 `html.dark` 两套 `--mic-*`：bg / header-bg / aside-bg / logo-bg / border / text / text-inverse）。
- **状态持久化**：`toggleTheme` / `setTheme` 将偏好写入 `localStorage`（key `theme`），下次访问自动应用；`initTheme` 在三个应用 `main.ts` 的 `app.mount` **之前**调用，避免首屏闪烁。
- **系统偏好**：`initTheme` 在 `localStorage` 无值时读取 `matchMedia('(prefers-color-scheme: dark)')`，默认匹配系统的暗黑/浅色；用户一旦手动切换即持久化、不再跟随系统。
- **平滑过渡**：`variables.css` 对内全局 `* { transition: background-color/color/border-color .3s ease }`（仅色彩属性，不影响尺寸/位移动画），主题切换时背景、文本、边框平滑渐变、无闪烁。`BasicLayout`、`LoginPage` 等布局色已改用语义变量；组件库暗黑由三个应用入口 `import 'element-plus/theme-chalk/dark/css-vars.css'` 提供，确保 `el-*` 控件在暗黑下对比度可读。
- **跨应用同步（iframe 隔离）**：基座 `BasicLayout` 按钮 `toggleTheme` 直接改基座文档 + 更新单例 `currentTheme`；`MicroContainer.vue` 的 `globalData.theme` 绑定 `currentTheme`，micro-app 在 `:data` 变化时**自动下发**到子应用 iframe → 子应用 `App.vue` 的 `onGlobalData` 收到 `theme` 后 `setTheme` 同步。子应用独立运行（standalone）时由自身 `BasicLayout` 按钮切换；因 iframe 跨源 `localStorage` 不共享，集成态子应用不读自身存储、以基座下发为准（首屏取 `getGlobalData().theme`）。

## 已知约束

- `build` 脚本为 `vue-tsc --noEmit && vite build`（类型检查 + 打包）。TypeScript 固定为 `5.9.2`：`vue-tsc@3.3.8` 的 `@volar/typescript` shim 无法在 TS 7.x 新模块布局下定位 tsc，故不升级到 TS 7。请勿改回 `vue-tsc -b`（无 composite 配置）。
- 环境变量：`VITE_API_BASE_URL`（全部应用）、`VITE_DOC_APP_URL`/`VITE_PERM_APP_URL`（main-app）、`VITE_BASE`（子应用生产 base 路径）。
- keep-alive 缓存依赖组件 `name` 与 `include` 列表严格一致；新增需要缓存的页面时，务必在对应 `.vue` 加 `defineOptions({ name })` 并同步 `App.vue` 的 `include`。
- 涉及权限的改动需同步三处：预设账号（`permission.ts`）、菜单过滤（`filterMenusByPermissions`）、路由守卫（越权重定向）。
