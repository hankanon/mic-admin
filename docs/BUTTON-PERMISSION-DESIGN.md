# 按钮级权限设计方案

> 版本：1.0 ｜ 更新日期：2026-08-28
> 适用范围：补齐 RBAC 操作级权限（应用级 + 菜单级 + 按钮级）
> **实施状态：已完成**（数据层、后端、前端基建、页面接入、接口鉴权均已落地并验证通过）

---

## 目录

1. [目标与范围](#1-目标与范围)
2. [现状梳理](#2-现状梳理)
3. [数据模型扩展](#3-数据模型扩展)
4. [后端改造](#4-后端改造)
5. [前端改造](#5-前端改造)
6. [关键设计决策与权衡](#6-关键设计决策与权衡)
7. [实施步骤（分阶段）](#7-实施步骤分阶段)
8. [风险与注意](#8-风险与注意)

---

## 1. 目标与范围

在已有**应用级（能进子系统）+ 菜单级（能看到导航）**权限之上，增加**操作级（能点按钮/调接口）**控制，补齐 RBAC 最后一环。

- **粒度**：`{appKey}:{resource}:{action}`，如 `sys:user:create`、`sys:menu:delete`、`doc:doc:publish`。
- **覆盖**：
  - 页面内按钮/操作入口的显隐或置灰（前端体验层）；
  - 对应 REST 接口的服务端强制拦截（安全底线，防绕过 UI 直调）。
- **不覆盖**：数据行级权限（"只能看自己部门的数据"）属 ABAC 范畴，本期不做。

---

## 2. 现状梳理

| 能力 | 现状 | 缺口 |
|------|------|------|
| 数据底座 | `menus` 表已有 `permission varchar(50)` 字段 | 该值仅落库，未被消费 |
| 管理端录入 | `MenuManage.vue` 增删改表单已带「权限标识」输入（`sys:menu:view` 等），`MenuPayload` 已支持 | 仅作为声明，未参与鉴权 |
| 应用级权限 | `role_apps` → 路由守卫 `hasAppPermission(permissions, appKey)` | 已通 |
| 菜单级权限 | `role_menus` → 导航树渲染 | 已通 |
| 按钮级权限 | 无 | 缺「菜单 permission 汇聚成按钮权限集合 + 指令/函数消费」能力，且后端管理接口无鉴权 |

`hasAppPermission` 已支持 `'*'`、`appKey`、`appKey:action` 三种匹配语义，按钮级权限方案复用该语义保持一致。

---

## 3. 数据模型扩展

复用 `role_menus` 表，仅补一列，不引入新表：

```sql
ALTER TABLE role_menus
  ADD COLUMN permissions VARCHAR(255) NULL
  COMMENT '逗号分隔的按钮权限点，如 sys:user:create,sys:user:edit';
```

**设计取舍**：按钮权限点挂在 `role_menus`（角色×菜单）而非新建 `role_permissions` 表。理由——按钮天然从属于某个页面（菜单），管理端在「角色授权」时**勾选菜单即展开勾选该菜单下的按钮集**，心智模型与现有 `role_menus` 完全一致，零新概念。

`menus.permission` 字段保留为**该菜单下默认权限点的模板/声明**（可选），用于角色管理页自动列出「该菜单有哪些可授权按钮」，不强制填。

---

## 4. 后端改造

### 4.1 登录/切换角色返回按钮权限集合

在用户服务 `buildRoleData`（聚合 `role_menus`）中，除现有 `permissions`（应用级）与 `menus`（导航树）外，新增 `buttons` 字段——聚合当前角色所有 `role_menus.permissions`：

```ts
private async buildRoleData(roleId: number): Promise<RoleData> {
  // ...现有 appRows → permissions
  const [menuRows] = await this.pool.query<RowDataPacket[]>(
    `SELECT m.*, rm.permissions AS role_permissions
       FROM menus m
       JOIN role_menus rm ON rm.menu_id = m.id
      WHERE rm.role_id = ? AND m.visible = 1`,
    [roleId],
  )
  const buttons = new Set<string>()
  menuRows.forEach((r) => {
    String(r.role_permissions || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((p) => buttons.add(p))
  })
  return {
    permissions,            // 应用级（已有）
    menus,                  // 导航树（已有）
    buttons: [...buttons],  // 新增：扁平按钮权限点集合
  }
}
```

`LoginResult.user` 与 `RoleData` 的 TS 接口追加 `buttons: string[]`。前端 `UserInfo.permissions` 保持应用级不变，新增 `buttons?: string[]`。

### 4.2 接口级鉴权 Guard

新增 `server/src/common/guards/permission.guard.ts`，读 `Authorization` 解析 userId → 查该用户所有角色聚合的 `buttons`（带缓存）→ 与当前路由声明的所需权限点比对：

```ts
@UseGuards(PermissionGuard)
@RequirePermission('sys:user:create')   // 自定义装饰器
@Post()
create(@Body() body: UserCreateInput) { /* ... */ }
```

Guard 逻辑：

1. `*` 超级管理员（其 buttons 含 `*` 或角色为 super-admin）直接放行；
2. 否则请求方 buttons 必须**包含**装饰器声明的权限点；
3. 不匹配返回 `40300`。

需把「解析 userId → 聚合 buttons」抽成 `PermissionService`（带进程内缓存，角色变更时失效），避免每次请求查库。

### 4.3 批量接口下推

对 `menu/role/user` 三个模块的写操作（create/update/remove）逐一加 `@RequirePermission`，与前端按钮标识一一对应。

---

## 5. 前端改造

### 5.1 权限判断核心（`packages/utils/src/permission.ts`）

新增 `hasButtonPermission`，复用 `hasAppPermission` 的 `'*'` 兼容语义：

```ts
/** 按钮级权限：permissions 为应用级集合，buttons 为按钮级集合 */
export function hasButtonPermission(
  buttons: string[] | undefined,
  required: string | string[],
  opts: { appKey?: string; permissions?: string[] } = {},
): boolean {
  const list = Array.isArray(required) ? required : [required]
  // 超级管理员：应用级含 '*' 或按钮级含 '*' 即全通
  if (opts.permissions?.includes('*') || buttons?.includes('*')) return true
  // 应用级兜底：未声明具体按钮点但拥有该应用权限时放行（兼容旧菜单）
  if (!list.length) return true
  return list.every((p) => buttons?.includes(p))
}
```

> **兼容性关键**：用 `every` 而非 `some`。一个按钮若声明多个权限点（如「删除需同时有 `sys:user:delete` 和 `sys:user:export`」），应要求全部具备；绝大多数场景只声明一个点，`every` 退化为单点判断。

### 5.2 指令 `v-permission`（全局注册）

```ts
// 用法：<el-button v-permission="'sys:user:create'">新增</el-button>
// 多权限：<el-button v-permission="['sys:user:edit','sys:user:delete']">
app.directive('permission', {
  mounted(el, binding) {
    const store = useUserStore()
    const ok = hasButtonPermission(
      store.userInfo?.buttons,
      binding.value,
      { appKey: currentAppKey, permissions: store.userInfo?.permissions },
    )
    if (!ok) {
      // 默认隐藏；binding.modifiers.disabled 改为禁用
      if (binding.modifiers.disabled) {
        el.setAttribute('disabled', 'disabled')
        el.classList.add('is-disabled')
      } else {
        el.parentNode?.removeChild(el)   // 或 el.style.display = 'none'
      }
    }
  },
})
```

- `v-permission`：无权限直接移除/隐藏（最常用）。
- `v-permission:disabled`：无权限仅置灰禁用（用于「看得见但不能点」的场景，如审计只读账号）。

### 5.3 组合式 API 兜底（`usePermission`）

指令无法覆盖动态渲染（如表格行内按钮需 `v-if`）。提供函数式判断：

```ts
export function usePermission() {
  const userStore = useUserStore()
  return {
    can: (p: string | string[]) =>
      hasButtonPermission(userStore.userInfo?.buttons, p, {
        appKey: injectAppKey(),
        permissions: userStore.userInfo?.permissions,
      }),
  }
}
// 模板：<el-button v-if="can('sys:user:delete')">删除</el-button>
```

### 5.4 数据源打通

- 基座 `userStore.login` / `switchRole` 已写入 `userInfo.permissions` 与 `userInfo.menus`；补写 `userInfo.buttons`（来自后端 `buttons`）。
- `microApp.setGlobalData` 下发的 `userInfo` 已含 `buttons`，子应用通过 `onGlobalData` 同步到本地 store，`v-permission` / `usePermission` 全局可用——**无需每应用单独接入**。
- `AuthMenuItem` / `MenuItem` 类型补 `buttons?: string[]`（上一轮发现的 `AuthMenuItem` 与 `MenuItem` 类型重复问题，正好借本次上提到 `@mic/types`，消除 `as unknown as` 断言时一并处理）。

### 5.5 管理端接入点（落地示例）

| 页面 | 按钮 | 权限点 | 后端接口 |
|------|------|--------|----------|
| 人员管理 | 新增 | `sys:user:create` | `POST /api/users` |
| 人员管理 | 编辑 | `sys:user:edit` | `PUT /api/users/:id` |
| 人员管理 | 删除 | `sys:user:delete` | `DELETE /api/users/:id` |
| 菜单管理 | 新增/编辑/删除 | `sys:menu:create/edit/delete` | menu 模块 |
| 角色管理 | 全部写操作 | `sys:role:*` | role 模块 |

角色管理页（`RoleManage.vue`）授权时：展开每个已勾选菜单，列出该菜单声明（`menus.permission` 模板或预置清单）的按钮点，复选框写入 `role_menus.permissions`。

---

## 6. 关键设计决策与权衡

1. **按钮点挂在 `role_menus` 而非独立表**：授权 UI 与现有「菜单树勾选」复用，零新概念；代价是「跨菜单共用同一按钮点」需重复勾选（实际极少发生）。
2. **前后端双重控制**：前端隐藏是体验，后端 Guard 是安全底线（防绕过 UI 直调）。两者权限点常量必须同源——建议抽 `permissions.ts` 常量表，前后端共用（后端用同一份枚举做 zod 校验）。
3. **`*` 超级管理员直通**：避免 admin 在每次加按钮时都要重新勾权限；与 `hasAppPermission` 既有 `'*'` 语义一致。
4. **应用级兜底放行**：对「未声明 buttons 的旧菜单」，只要拥有该 `appKey` 应用权限就放行，保证历史数据平滑过渡，不因引入新字段导致老角色突然看不到按钮。
5. **指令默认移除而非 `display:none`**：彻底杜绝「隐藏元素仍可通过 DOM 调用」，但代价是布局可能跳变；提供 `:disabled` 修饰符应对需保留占位的情况。

---

## 7. 实施步骤（分阶段）

- **Phase 1（数据 + 后端）**：`role_menus` 加列 → `buildRoleData` 返回 `buttons` → `PermissionService` + `PermissionGuard` → 三个模块写接口加 `@RequirePermission`。
- **Phase 2（前端基建）**：类型补 `buttons` → `hasButtonPermission` → 全局 `v-permission` 指令 + `usePermission` → 基座/子应用 store 打通下发。
- **Phase 3（接页面）**：人员/菜单/角色管理页按钮接入 `v-permission` → 角色管理授权 UI 支持按钮点勾选 → 浏览器联调（切角色验证按钮显隐 + 越权调用接口返回 403）。

---

## 8. 风险与注意

- **缓存失效**：`PermissionService` 缓存角色权限后，sys-app 改角色授权需触发失效（可借「权限版本号 WS 推送」或简单「重启/定时 TTL」）。
- **微前端指令注册**：`v-permission` 需在**每个子应用**的 `app` 实例注册（基座与 5 个子应用各注册一次），建议放进 `@mic/components` 的 `install` 插件统一注册，避免遗漏。
- **类型重复**：借本次把 `AuthMenuItem` / `MenuItem` / `RoleData` 等上提到共享 `types` 包，根治上一轮发现的 `as unknown as MenuItem` 断言。

---

## 9. 落地说明（实施记录）

### 9.1 已交付内容

| 层 | 文件 | 说明 |
|----|------|------|
| 数据 | `server/sql/alter_role_menus_permissions.sql` | `role_menus` 增加 `permissions` 列 |
| 数据 | `server/sql/schema.sql`、`seed.sql` | schema 同步列定义；seed 预置角色按钮权限 |
| 后端 | `server/src/common/permissions.ts` | 按钮权限点常量（前后端同源） |
| 后端 | `server/src/common/permission.service.ts` | 用户按钮权限聚合 + 60s TTL 缓存 |
| 后端 | `server/src/common/permission.guard.ts`、`permission.decorator.ts` | `PermissionGuard` + `@RequirePermission` |
| 后端 | `server/src/common/auth-token.ts` | token 解析（从 user.controller 提取复用） |
| 后端 | `user/role/menu` 三个 controller | 全部写接口已加权限守卫 |
| 后端 | `role.service.ts` | `menuPermissions` 写入/回显 + 授权变更后缓存失效 |
| 前端 | `packages/utils/src/permission.ts` | `hasButtonPermission` |
| 前端 | `packages/utils/src/permission-codes.ts` | 前端权限常量（与后端对应） |
| 前端 | `packages/components/src/permission/` | `v-permission` 指令 + `usePermission` |
| 前端 | `main-app` / `sys-app` | 登录/切角色透传 `buttons`；注册指令 |
| 前端 | `MenuManage.vue` / `RoleManage.vue` / `UserManage.vue` | 按钮接入 `v-permission`；角色授权支持按钮点勾选 |

### 9.2 与方案的两处差异

1. **菜单按钮点改为按 `path` 映射（前端）/ 按 `menu_id` 映射（后端）**：
   后端 `MENU_PERMISSION_OPTIONS` 以菜单 id 为键（`5010100/5010200/5010300`，见 seed 层级编码）；
   前端 `RoleManage.vue` 以菜单 `path`（`/sys/menu` 等）为键匹配，更直观且不受 id 变更影响。
   二者指向同一批权限点常量，保持同源。
2. **权限点写入走白名单过滤**：`saveMenuPermissions` 仅接受 `ALL_PERMISSION_CODES` 内的权限点，
   防止前端传入任意字符串污染权限集合（方案未强调，实施时补强）。

### 9.3 验证结果

- **类型检查**：server / main-app / sys-app 全部通过；
- **构建**：server（`nest build`）、main-app、sys-app 全部通过；
- **数据下发**：`sysop` 登录返回 9 个按钮权限点，`editor` 返回空数组；
- **接口鉴权**：
  - 无权限（editor）调 `POST /api/users` → `40300 无操作权限`；
  - 有权限（sysop）同接口 → 正常创建；
  - 非法 token → `40100 登录已过期`；
- **授权闭环**：通过 `PUT /api/roles/3` 收回 `sys:user:remove` 后，
  该角色立即无法调用 `DELETE /api/users/:id`（403），而仍保留的 `sys:user:create` 正常放行，
  证明缓存失效与鉴权即时生效。

### 9.4 后续可选增强

- 其余子应用（doc / qa 等）如需按钮权限，调用 `installPermission(app)` 注册指令即可，无需额外改造；
- 缓存失效目前为「全清」粒度，高频场景下可改为按受影响用户精确失效；
- 前端如需响应式权限（不重挂载即刷新），可用 `usePermission()` 的 `can$` 配合 `v-if`。
