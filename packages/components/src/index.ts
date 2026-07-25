export { default as BasicLayout } from './layout/BasicLayout.vue'
export { default as AppMenu } from './menu/AppMenu.vue'
export { default as LoginPage } from './login/LoginPage.vue'
export { default as UserAvatar } from './business/UserAvatar.vue'
export { default as Breadcrumb } from './business/Breadcrumb.vue'
export { default as PageCard } from './business/PageCard.vue'

export {
  menuConfig,
  getMenusByApp,
  stripAppPrefix,
  matchMenuKey,
  filterMenusByPermissions,
  type MenuItem,
  type AppKey,
} from './menu/config'
