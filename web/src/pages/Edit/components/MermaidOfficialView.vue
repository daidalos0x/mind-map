<template>
  <div v-show="visible" class="mermaidOfficialView" ref="host"></div>
</template>

<script>
import { isMermaidStyleOn, mermaidSourceFor, renderMermaidSvg } from '@/utils/mermaidStyle'

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
      timer: null
    }
  },
  created() {
    this.onStyle = enabled => {
      this.visible = enabled
      this.schedule()
    }
    this.onData = () => {
      if (this.visible) {
        this.schedule()
      }
    }
    this.$bus.$on('mermaidStyleChanged', this.onStyle)
    this.$bus.$on('data_change', this.onData)
  },
  mounted() {
    this.visible = isMermaidStyleOn()
    if (this.visible) {
      this.schedule()
    }
  },
  beforeDestroy() {
    clearTimeout(this.timer)
    this.$bus.$off('mermaidStyleChanged', this.onStyle)
    this.$bus.$off('data_change', this.onData)
  },
  methods: {
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
      } catch (error) {
        if (token !== this.token || !this.$refs.host) {
          return
        }
        this.$refs.host.textContent = error && error.message ? error.message : String(error)
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
  display: flex;
  align-items: center;
  justify-content: center;

  /deep/ svg,
  /deep/ svg * {
    box-sizing: content-box;
  }

  /deep/ svg {
    max-width: 100%;
    height: auto;
  }
}
</style>
