import bus from './bus'

// Vue 2 时代把跨模块的约定挂在 Vue.prototype 上（getCurrentData、$bus）。
// Vue 3 没有原型链了，这里收在一个普通对象里，谁用谁 import。
export const globals = {
  bus,
  getCurrentData: () => null
}

export default globals
