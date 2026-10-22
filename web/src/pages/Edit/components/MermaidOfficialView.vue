<template>
  <div
    v-show="visible"
    class="mermaidOfficialView"
    :class="{ isDark: isDark }"
    ref="host"
    @wheel="onWheel"
  ></div>
</template>

<script>
import { mapState } from 'vuex'
import { isMermaidStyleOn, mermaidSourceFor, renderMermaidSvg } from '@/utils/mermaidStyle'

// 相对「切换到 mermaid 模式时的缩放」的可见倍数范围
const MIN_ZOOM = 0.2
const MAX_ZOOM = 6
// 与 simple-mind-map 的 mousewheelAction 配置取值保持一致
const WHEEL_ACTION_ZOOM = 'zoom'

export default {
  props: {
    mindMap: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      visible: false,
      token: 0,
      timer: null,
      // svg 的原始宽度，用于按缩放计算展示宽度
      naturalWidth: 0,
      // 切换到 mermaid 模式时的画布缩放，保证刚切换时仍然是整图铺满
      baseScale: 1
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark
    })
  },
  watch: {
    // 切换暗色模式后需要用新的 mermaid 主题重绘
    isDark() {
      if (this.visible) {
        this.schedule()
      }
    }
  },
  created() {
    this.onStyle = enabled => {
      if (enabled) {
        this.enter()
      } else {
        this.visible = false
      }
    }
    this.onData = () => {
      if (this.visible) {
        this.schedule()
      }
    }
    this.onScale = () => {
      if (this.visible) {
        this.applyZoom()
      }
    }
    this.onResize = () => {
      if (this.visible) {
        this.applyZoom()
      }
    }
    this.$bus.$on('mermaidStyleChanged', this.onStyle)
    this.$bus.$on('data_change', this.onData)
  },
  mounted() {
    window.addEventListener('resize', this.onResize)
    if (this.mindMap) {
      this.mindMap.on('scale', this.onScale)
    }
    if (isMermaidStyleOn()) {
      this.enter()
    }
  },
  beforeDestroy() {
    clearTimeout(this.timer)
    window.removeEventListener('resize', this.onResize)
    if (this.mindMap) {
      this.mindMap.off('scale', this.onScale)
    }
    this.$bus.$off('mermaidStyleChanged', this.onStyle)
    this.$bus.$off('data_change', this.onData)
  },
  methods: {
    enter() {
      // 以当前画布缩放为基准，缩放操作沿用画布本身的 view 缩放
      this.baseScale = this.mindMap ? this.mindMap.view.scale : 1
      this.visible = true
      this.schedule()
    },
    schedule() {
      clearTimeout(this.timer)
      this.timer = setTimeout(() => {
        this.draw()
      }, 60)
    },
    async draw() {
      await this.$nextTick()
      if (!this.visible || !this.mindMap || !this.$refs.host) {
        return
      }
      const token = ++this.token
      try {
        const svg = await renderMermaidSvg(mermaidSourceFor(this.mindMap))
        if (token !== this.token || !this.$refs.host) {
          return
        }
        this.$refs.host.innerHTML = svg
        this.measure()
        this.applyZoom()
        this.$bus.$emit('mermaidPreviewReady')
      } catch (error) {
        if (token !== this.token || !this.$refs.host) {
          return
        }
        this.$refs.host.textContent = error && error.message ? error.message : String(error)
      }
    },
    // 记录 svg 的原始宽度
    measure() {
      const svg = this.$refs.host && this.$refs.host.querySelector('svg')
      if (!svg) {
        this.naturalWidth = 0
        return
      }
      const box = svg.viewBox && svg.viewBox.baseVal
      this.naturalWidth = box && box.width ? box.width : svg.getBoundingClientRect().width
    },
    // 按画布缩放同步 mermaid 视图的大小，scale 事件来自 +/- 按钮、Ctrl+滚轮等所有缩放入口
    applyZoom() {
      const host = this.$refs.host
      const svg = host && host.querySelector('svg')
      if (!svg || !this.naturalWidth || !host.clientWidth) {
        return
      }
      const style = window.getComputedStyle(host)
      const available =
        host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      // 切换进来时让整图铺满，之后跟随画布缩放倍数
      const fit = Math.min(1, available / this.naturalWidth)
      const scale = this.mindMap ? this.mindMap.view.scale : 1
      const ratio = this.baseScale ? scale / this.baseScale : 1
      const zoom = Math.min(Math.max(ratio, MIN_ZOOM), MAX_ZOOM)
      svg.style.maxWidth = 'none'
      svg.style.height = 'auto'
      svg.style.width = Math.max(40, Math.round(this.naturalWidth * fit * zoom)) + 'px'
    },
    onWheel(e) {
      if (!this.mindMap || e.deltaY === 0) {
        return
      }
      const {
        mousewheelAction,
        mousewheelZoomActionReverse,
        disableMouseWheelZoom
      } = this.mindMap.opt
      if (disableMouseWheelZoom) {
        return
      }
      // 和画布一致：默认普通滚轮用于滚动，按住 ctrl/meta 才缩放
      if (!(e.ctrlKey || e.metaKey || mousewheelAction === WHEEL_ACTION_ZOOM)) {
        return
      }
      e.preventDefault()
      const zoomIn =
        mousewheelZoomActionReverse === false ? e.deltaY > 0 : e.deltaY < 0
      if (zoomIn) {
        this.mindMap.view.enlarge()
      } else {
        this.mindMap.view.narrow()
      }
    }
  }
}
</script>

<style lang="less" scoped>
.mermaidOfficialView {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  box-sizing: border-box;
  padding: 72px 96px 72px 24px;
  background: #fff;
  overflow: auto;
  // 用 margin: auto 居中，放大后仍能滚动到内容左上角
  display: flex;

  &.isDark {
    background: #1c1c1e;
  }

  /deep/ svg,
  /deep/ svg * {
    box-sizing: content-box;
  }

  /deep/ svg {
    // 尺寸由 applyZoom 按缩放写入
    margin: auto;
    max-width: none;
    height: auto;
    flex-shrink: 0;
  }
}
</style>
