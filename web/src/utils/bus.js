import mitt from 'mitt'

// Vue 2 时代用 `new Vue()` 当事件总线，组件里到处是 this.$bus.$on/$emit。
// Vue 3 没有这个用法了，这里用 mitt 包一层同形状的接口，调用方不用改。
const emitter = mitt()

const bus = {
  $on: emitter.on,
  $off: emitter.off,
  $emit: emitter.emit,
  on: emitter.on,
  off: emitter.off,
  emit: emitter.emit,
  all: emitter.all
}

export default bus
