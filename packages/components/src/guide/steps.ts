/**
 * 操作指引步骤配置（与 driver.js 的 DriveStep 对齐）。
 *
 * - `selector`：目标 DOM 选择器；为空表示「居中欢迎弹窗」（不聚焦具体元素）。
 * - `title` / `description`：提示框文字。
 * - `side` / `align`：提示框相对高亮元素的位置（上/右/下/左 + 对齐）。
 * - `features`：可选的功能点列表，会拼接到 description 中。
 *
 * 选择器需在对应组件上落位：
 *   .js-guide-entry      操作指引入口按钮（BasicLayout 头部）
 *   .js-guide-theme      主题切换按钮
 *   .js-guide-fullscreen 全屏切换按钮
 *   .user-trigger        用户菜单触发区
 *   .basic-layout__collapse-toggle 菜单展开/收起按钮
 *   [data-menu-key="home"|"doc"|"sys"] 左侧菜单项（AppMenu 上已加 data-menu-key）
 */
export interface GuideStep {
  selector?: string
  title: string
  description: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  features?: string[]
}

export const defaultGuideSteps: GuideStep[] = [
  {
    title: '欢迎使用操作指引',
    description:
      '接下来将分步为您介绍顶部按钮与左侧菜单的核心功能，可随时点击「跳过」退出或「上一步」返回。',
    side: 'bottom',
    align: 'center',
  },
  {
    selector: '.js-guide-entry',
    title: '操作指引入口',
    description: '点击该按钮即可随时重新打开本指引。',
    side: 'bottom',
    align: 'end',
  },
  {
    selector: '.js-guide-theme',
    title: '切换系统主题',
    description: '在「白天模式」与「黑夜模式」之间切换，偏好会自动持久化保存。',
    side: 'bottom',
    align: 'end',
  },
  {
    selector: '.js-guide-fullscreen',
    title: '全屏切换',
    description: '进入或退出浏览器全屏视图；进入全屏后也可按 ESC 键退出。',
    side: 'bottom',
    align: 'end',
  },
  {
    selector: '.user-trigger',
    title: '用户菜单',
    description: '点击右上角头像展开，可进行「个人资料」「切换角色」「退出登录」等操作。',
    side: 'bottom',
    align: 'end',
  },
  {
    selector: '.basic-layout__collapse-toggle',
    title: '菜单展开 / 收起',
    description: '点击左下角按钮收起侧边栏（仅保留子应用图标）或重新展开，节省横向空间。',
    side: 'right',
    align: 'center',
  },
  {
    selector: '[data-menu-key="home"]',
    title: '首页大盘',
    description: '基座欢迎页，登录后的默认着陆页，可快速概览各子应用入口。',
    side: 'right',
    align: 'center',
  },
  {
    selector: '[data-menu-key="doc"]',
    title: '文档管理',
    description: '内容运营子应用，提供文档管理与发布相关能力。',
    features: ['文档列表：查看、检索与管理全部文档', '发布管理：编辑、提交与发布文档'],
    side: 'right',
    align: 'center',
  },
  {
    selector: '[data-menu-key="sys"]',
    title: '系统管理',
    description: '平台后台子应用，负责权限与组织配置。',
    features: [
      '菜单管理：维护系统菜单结构',
      '角色管理：配置角色与对应权限',
      '人员管理：维护平台用户与账号',
    ],
    side: 'right',
    align: 'center',
  },
]
