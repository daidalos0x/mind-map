import { createApp } from 'vue'
import ElementPlus, {
  ElLoading,
  ElMessage,
  ElMessageBox,
  ElNotification
} from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@/assets/icon-font/iconfont.css'
import 'viewerjs/dist/viewer.css'
// 全局深色主题，必须在 element-plus / 第三方样式之后引入
import '@/style/dark.less'
import VueViewer from 'v-viewer'
import App from './App.vue'
import router from './router'
import store from './store'
import i18n from './i18n'
import bus from '@/utils/bus'
import { globals } from '@/utils/global'
import { getLang } from '@/api'

// 服务式组件（this.$message / $confirm / $notify / $loading）挂到 globalProperties，
// 保留 Vue 2 时代的调用写法，避免几百处调用点跟着改。
const services = {
  $loading: ElLoading.service,
  $message: ElMessage,
  $msgbox: ElMessageBox,
  $alert: ElMessageBox.alert,
  $confirm: ElMessageBox.confirm,
  $prompt: ElMessageBox.prompt,
  $notify: ElNotification
}

const initApp = () => {
  const app = createApp(App)

  app.use(ElementPlus)
  app.use(router)
  app.use(store)
  app.use(i18n)
  app.use(VueViewer)

  app.config.globalProperties.$bus = bus
  app.config.globalProperties.getCurrentData = (...args) =>
    globals.getCurrentData(...args)
  Object.keys(services).forEach(name => {
    app.config.globalProperties[name] = services[name]
  })

  i18n.global.locale.value = getLang()
  app.mount('#app')
  window.$app = app
  return app
}

// 是否处于接管应用模式
if (window.takeOverApp) {
  window.initApp = initApp
  window.$bus = bus
} else {
  initApp()
}
