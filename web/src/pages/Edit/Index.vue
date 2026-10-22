<template>
  <div
    class="container"
    :class="{ isDark: isDark, activeSidebar: activeSidebar }"
  >
    <FileHome v-if="show && screen === 'home'" @open="enterEditor"></FileHome>
    <template v-if="show && screen === 'edit'">
      <Toolbar v-if="!isZenMode"></Toolbar>
      <Edit></Edit>
    </template>
  </div>
</template>

<script>
import Toolbar from './components/Toolbar.vue'
import Edit from './components/Edit.vue'
import FileHome from './components/FileHome.vue'
import { mapState, mapMutations } from 'vuex'
import { getData, getLocalConfig } from '@/api'
import { browserFileLibrary } from '@/utils/fileLibrary'
import { isMermaidStyleOn, mermaidSourceFor, renderMermaidSvg } from '@/utils/mermaidStyle'
import { mindMapPng, shrinkThumbnail, svgMarkupToThumbnail } from '@/utils/thumbnail'

const STYLE_COMMANDS = new Set(['SET_NODE_STYLE', 'SET_NODE_STYLES', 'SET_NODE_SHAPE'])
const MERMAID_KEYS = ['mermaidStyle', 'mermaidSource', 'layoutBeforeMermaid', 'themeBeforeMermaid']

export default {
  components: {
    Toolbar,
    Edit,
    FileHome
  },
  data() {
    return {
      show: false,
      screen: 'home',
      mindMap: null,
      previewMindMap: null,
      previewTimer: null,
      previewToken: 0,
      restoreThemeConfig: null,
      restoreExec: null
    }
  },
  computed: {
    ...mapState({
      isZenMode: state => state.localConfig.isZenMode,
      isDark: state => state.localConfig.isDark,
      activeSidebar: state => state.activeSidebar
    })
  },
  watch: {
    isDark() {
      this.setBodyDark()
    }
  },
  async created() {
    this.screen = 'home'
    this.$bus.$on('mindMapReady', this.onMindMapReady)
    this.$bus.$on('showFileHome', this.leaveEditor)
    this.$bus.$on('enterEditor', this.enterEditor)
    this.initLocalConfig()
    const loading = this.$loading({
      lock: true,
      text: this.$t('other.loading')
    })
    this.show = true
    loading.close()
    this.setBodyDark()
  },
  beforeDestroy() {
    clearTimeout(this.previewTimer)
    this.unbindPreview()
    this.$bus.$off('mindMapReady', this.onMindMapReady)
    this.$bus.$off('showFileHome', this.leaveEditor)
    this.$bus.$off('enterEditor', this.enterEditor)
  },
  methods: {
    ...mapMutations(['setLocalConfig']),

    enterEditor() {
      this.screen = 'edit'
    },

    onMindMapReady(mindMap) {
      this.mindMap = mindMap
      this.bindPreview(mindMap)
    },

    bindPreview(mindMap) {
      this.unbindPreview()
      this.previewMindMap = mindMap
      this.onThemeChange = () => this.schedulePreview()
      this.onLayoutChange = () => this.schedulePreview()
      mindMap.on('view_theme_change', this.onThemeChange)
      mindMap.on('layout_change', this.onLayoutChange)
      this.$bus.$on('mermaidStyleChanged', this.schedulePreview)
      this.$bus.$on('mermaidPreviewReady', this.schedulePreview)
      this.$bus.$on('mapStyleChanged', this.schedulePreview)
      this.$bus.$on('painter_end', this.schedulePreview)
      const rawConfig = mindMap.setThemeConfig.bind(mindMap)
      mindMap.setThemeConfig = (...args) => {
        const result = rawConfig(...args)
        this.schedulePreview()
        return result
      }
      this.restoreThemeConfig = () => {
        mindMap.setThemeConfig = rawConfig
      }
      const rawExec = mindMap.execCommand.bind(mindMap)
      mindMap.execCommand = (...args) => {
        const result = rawExec(...args)
        if (STYLE_COMMANDS.has(args[0])) {
          this.schedulePreview()
        }
        return result
      }
      this.restoreExec = () => {
        mindMap.execCommand = rawExec
      }
    },

    unbindPreview() {
      clearTimeout(this.previewTimer)
      this.previewTimer = null
      const mindMap = this.previewMindMap
      if (this.restoreThemeConfig) {
        this.restoreThemeConfig()
        this.restoreThemeConfig = null
      }
      if (this.restoreExec) {
        this.restoreExec()
        this.restoreExec = null
      }
      if (mindMap && this.onThemeChange) {
        mindMap.off('view_theme_change', this.onThemeChange)
        mindMap.off('layout_change', this.onLayoutChange)
      }
      this.previewMindMap = null
      this.$bus.$off('mermaidStyleChanged', this.schedulePreview)
      this.$bus.$off('mermaidPreviewReady', this.schedulePreview)
      this.$bus.$off('mapStyleChanged', this.schedulePreview)
      this.$bus.$off('painter_end', this.schedulePreview)
    },

    schedulePreview() {
      if (this.screen !== 'edit' || !this.mindMap) {
        return
      }
      clearTimeout(this.previewTimer)
      this.previewTimer = setTimeout(() => {
        this.previewTimer = null
        this.storePreview()
      }, 500)
    },

    async makeThumbnail() {
      if (!this.mindMap) {
        return ''
      }
      const token = ++this.previewToken
      const mermaid = isMermaidStyleOn()
      try {
        let source = ''
        if (mermaid) {
          const markup = await renderMermaidSvg(mermaidSourceFor(this.mindMap))
          source = await svgMarkupToThumbnail(markup)
        } else {
          const png = await mindMapPng(this.mindMap)
          if (typeof png === 'string' && png.indexOf('data:') === 0) {
            source = await shrinkThumbnail(png)
          }
        }
        if (token !== this.previewToken || isMermaidStyleOn() !== mermaid) {
          return ''
        }
        return source
      } catch (error) {
        console.log(error)
        return ''
      }
    },

    async storePreview() {
      const image = await this.makeThumbnail()
      if (!image || this.screen !== 'edit') {
        return
      }
      try {
        await this.storeThumbnail(image)
      } catch (error) {
        console.log(error)
      }
    },

    documentData() {
      const data = this.mindMap.getData(true)
      const stored = getData() || {}
      MERMAID_KEYS.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(stored, key)) {
          data[key] = stored[key]
        }
      })
      return data
    },

    async storeThumbnail(image) {
      if (
        window.__TAURI_INTERNALS__ &&
        window.__desktopSession &&
        window.__desktopSession.path
      ) {
        await window.__TAURI_INTERNALS__.invoke('save_thumbnail', {
          path: window.__desktopSession.path,
          image
        })
        return
      }
      const library = browserFileLibrary()
      const id = library.currentId()
      if (id) {
        library.saveThumbnail(id, image)
      }
    },

    async leaveEditor() {
      clearTimeout(this.previewTimer)
      this.previewTimer = null
      if (window.__TAURI_INTERNALS__ && window.__desktopSession) {
        if (this.mindMap && window.__desktopSession.path) {
          const data = this.documentData()
          window.__desktopSession.mindMapData = data
          const invoke = window.__TAURI_INTERNALS__.invoke
          try {
            await invoke('save_mind_map', { data })
          } catch (error) {
            console.log(error)
          }
          try {
            const image = await this.makeThumbnail()
            if (image) {
              await invoke('save_thumbnail', {
                path: window.__desktopSession.path,
                image
              })
            }
          } catch (error) {
            console.log(error)
          }
        }
        this.unbindPreview()
        this.mindMap = null
        this.screen = 'home'
        return
      }
      const library = browserFileLibrary()
      const id = library.currentId()
      if (id && this.mindMap) {
        const data = this.documentData()
        let thumbnail = ''
        try {
          thumbnail = await this.makeThumbnail()
        } catch (error) {
          thumbnail = ''
        }
        try {
          if (thumbnail) {
            library.save(id, data, thumbnail)
          } else {
            library.save(id, data)
          }
        } catch (error) {
          try {
            library.save(id, data)
          } catch (again) {
            console.log(again)
          }
        }
      }
      this.unbindPreview()
      this.mindMap = null
      this.screen = 'home'
    },

    initLocalConfig() {
      let config = getLocalConfig()
      if (config) {
        this.setLocalConfig({
          ...this.$store.state.localConfig,
          ...config
        })
      }
    },

    setBodyDark() {
      this.isDark
        ? document.body.classList.add('isDark')
        : document.body.classList.remove('isDark')
    }
  }
}
</script>

<style lang="less">
.container {
}

body {
  &.isDark {
    /* el-button */
    .el-button {
      background-color: #363b3f;
      color: hsla(0, 0%, 100%, 0.9);
      border-color: hsla(0, 0%, 100%, 0.1);
    }

    /* el-input */
    .el-input__inner {
      background-color: #363b3f;
      border-color: hsla(0, 0%, 100%, 0.1);
      color: hsla(0, 0%, 100%, 0.9);
    }

    .el-input.is-disabled .el-input__inner {
      background-color: #363b3f;
      border-color: hsla(0, 0%, 100%, 0.1);
      color: hsla(0, 0%, 100%, 0.3);
    }

    .el-input-group__append,
    .el-input-group__prepend {
      background-color: #363b3f;
      border-color: hsla(0, 0%, 100%, 0.1);
    }

    .el-input-group__append button.el-button {
      color: hsla(0, 0%, 100%, 0.9);
    }

    /* el-select */
    .el-select-dropdown {
      background-color: #36393d;
      border-color: hsla(0, 0%, 100%, 0.1);

      .el-select-dropdown__item {
        color: hsla(0, 0%, 100%, 0.6);
      }

      .el-select-dropdown__item.selected {
        color: #409eff;
      }

      .el-select-dropdown__item.hover,
      .el-select-dropdown__item:hover {
        background-color: hsla(0, 0%, 100%, 0.05);
      }
    }

    .el-select .el-input.is-disabled .el-input__inner:hover {
      border-color: hsla(0, 0%, 100%, 0.1);
    }

    /* el-popper*/
    .el-popper {
      background-color: #36393d;
      border-color: hsla(0, 0%, 100%, 0.1);
    }

    .el-popper[x-placement^='bottom'] .popper__arrow {
      background-color: #36393d;
    }

    .el-popper[x-placement^='bottom'] .popper__arrow::after {
      border-bottom-color: #36393d;
    }

    .el-popper[x-placement^='top'] .popper__arrow {
      background-color: #36393d;
    }

    .el-popper[x-placement^='top'] .popper__arrow::after {
      border-top-color: #36393d;
    }

    /* el-tabs */
    .el-tabs__item {
      color: hsla(0, 0%, 100%, 0.6);

      &:hover,
      &.is-active {
        color: #409eff;
      }
    }

    .el-tabs__nav-wrap::after {
      background-color: hsla(0, 0%, 100%, 0.6);
    }

    /* el-slider */
    .el-slider__runway {
      background-color: hsla(0, 0%, 100%, 0.6);
    }

    /* el-radio-group */
    .el-radio-group {
      .el-radio-button__inner {
        background-color: #36393d;
        color: hsla(0, 0%, 100%, 0.6);
      }

      .el-radio-button__orig-radio:checked + .el-radio-button__inner {
        color: #fff;
        background-color: #409eff;
      }
    }

    /* el-dialog */
    .el-dialog {
      background-color: #262a2e;

      .el-dialog__header {
        border-bottom: 1px solid hsla(0, 0%, 100%, 0.1);
      }

      .el-dialog__title {
        color: hsla(0, 0%, 100%, 0.9);
      }

      .el-dialog__body {
        background-color: #262a2e;
      }

      .el-dialog__footer {
        border-top: 1px solid hsla(0, 0%, 100%, 0.1);
      }
    }

    /* el-upload */
    .el-upload__tip {
      color: #999;
    }

    /* 富文本编辑器 */
    .toastui-editor-main-container {
      background-color: #fff;
    }
  }
}
</style>
