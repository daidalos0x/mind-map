import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
// element-ui 按需引入：样式由 babel-plugin-component 自动注入，不再引入整包 index.css
import {
  Button,
  Checkbox,
  ColorPicker,
  Dialog,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  Form,
  FormItem,
  Input,
  InputNumber,
  Loading,
  Message,
  MessageBox,
  Notification,
  Option,
  Popover,
  Progress,
  Radio,
  RadioButton,
  RadioGroup,
  Select,
  Slider,
  Switch,
  TabPane,
  Tabs,
  Tag,
  Tooltip,
  Tree,
  Upload
} from 'element-ui'
import '@/assets/icon-font/iconfont.css'
import 'viewerjs/dist/viewer.css'
// 全局深色主题，必须在 element-ui / 第三方样式之后引入
import '@/style/dark.less'
import VueViewer from 'v-viewer'
import i18n from './i18n'
import { getLang } from '@/api'
// import VConsole from 'vconsole'
// const vConsole = new VConsole()

const components = [
  Button,
  Checkbox,
  ColorPicker,
  Dialog,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  Form,
  FormItem,
  Input,
  InputNumber,
  Option,
  Popover,
  Progress,
  Radio,
  RadioButton,
  RadioGroup,
  Select,
  Slider,
  Switch,
  TabPane,
  Tabs,
  Tag,
  Tooltip,
  Tree,
  Upload
]

components.forEach(component => {
  Vue.use(component)
})

// 服务式组件（this.$message / $confirm / $notify / $loading）需要手动挂到原型上
Vue.use(Loading.directive)
Vue.prototype.$loading = Loading.service
Vue.prototype.$message = Message
Vue.prototype.$msgbox = MessageBox
Vue.prototype.$alert = MessageBox.alert
Vue.prototype.$confirm = MessageBox.confirm
Vue.prototype.$prompt = MessageBox.prompt
Vue.prototype.$notify = Notification

Vue.config.productionTip = false
const bus = new Vue()
Vue.prototype.$bus = bus
Vue.use(VueViewer)

const initApp = () => {
  i18n.locale = getLang()
  new Vue({
    render: h => h(App),
    router,
    store,
    i18n
  }).$mount('#app')
}

// 是否处于接管应用模式
if (window.takeOverApp) {
  window.initApp = initApp
  window.$bus = bus
} else {
  initApp()
}
