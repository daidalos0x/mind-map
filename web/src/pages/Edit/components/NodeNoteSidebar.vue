<template>
  <Sidebar ref="sidebar" :title="$t('note.title')">
    <div class="noteContentWrap" ref="noteContentWrap"></div>
  </Sidebar>
</template>

<script>
import Sidebar from './Sidebar.vue'
import { mapState, mapMutations } from 'vuex'
// toast-ui viewer 体积较大，改成第一次打开备注侧边栏时再动态加载

export default {
  components: {
    Sidebar
  },
  props: {
    mindMap: {
      type: Object
    }
  },
  data() {
    return {
      editor: null,
      editorPromise: null,
      pendingNote: null,
      node: null
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark,
      activeSidebar: state => state.activeSidebar
    })
  },
  watch: {
    activeSidebar(val) {
      if (val === 'noteSidebar') {
        this.$refs.sidebar.show = true
      } else {
        this.$refs.sidebar.show = false
      }
    }
  },
  created() {
    this.$bus.$on('node_active', this.onNodeActive)
    this.mindMap.on('node_note_click', this.onNodeNoteClick)
  },
  beforeUnmount() {
    this.$bus.$off('node_active', this.onNodeActive)
    this.mindMap.off('node_note_click', this.onNodeNoteClick)
  },
  methods: {
    ...mapMutations(['setActiveSidebar']),

    onNodeActive(...args) {
      if (this.activeSidebar !== 'noteSidebar') {
        return
      }
      const nodes = [...args[1]]
      if (nodes.length > 0) {
        if (nodes[0] !== this.node) {
          this.setActiveSidebar(null)
        }
      } else {
        this.setActiveSidebar(null)
      }
    },

    // 初始化编辑器，按需加载 toast-ui viewer
    initEditor() {
      if (this.editor) {
        return Promise.resolve(this.editor)
      }
      if (!this.editorPromise) {
        this.editorPromise = Promise.all([
          import(
            /* webpackChunkName: "toastui-editor" */
            '@toast-ui/editor/dist/toastui-editor-viewer'
          ),
          import(
            /* webpackChunkName: "toastui-editor" */
            '@toast-ui/editor/dist/toastui-editor-viewer.css'
          )
        ]).then(([viewerModule]) => {
          if (!this.$refs.noteContentWrap) {
            // 容器还没渲染，下次调用时重试
            this.editorPromise = null
            return null
          }
          const Viewer = viewerModule.default || viewerModule
          this.editor = new Viewer({
            el: this.$refs.noteContentWrap
          })
          if (this.pendingNote !== null) {
            this.editor.setMarkdown(this.pendingNote)
            this.pendingNote = null
          }
          return this.editor
        })
      }
      return this.editorPromise
    },

    async onNodeNoteClick(node) {
      this.node = node
      this.setActiveSidebar('noteSidebar')
      const note = node.getData('note')
      const editor = await this.initEditor()
      if (editor) {
        editor.setMarkdown(note)
      } else {
        // 侧边栏还没渲染出容器，等加载完成后再回填
        this.pendingNote = note
      }
    }
  }
}
</script>

<style lang="less" scoped>
.noteContentWrap {
  padding: 12px 20px;
}
</style>
