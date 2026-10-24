<template>
  <el-dialog
    v-model="visible"
    :title="$t('mermaid.title')"
    width="92%"
    top="4vh"
    append-to-body
    custom-class="mermaidEditorDialog"
    @opened="onOpened"
    @closed="onClosed"
  >
    <div class="mermaidWorkspace" :class="{ isDark: isDark }">
      <div class="pane">
        <textarea
          v-model="source"
          class="editor"
          spellcheck="false"
          :placeholder="$t('mermaid.placeholder')"
        ></textarea>
        <div class="parseError" v-if="error">{{ error }}</div>
      </div>
      <div class="pane previewPane">
        <div class="preview" ref="preview"></div>
      </div>
    </div>
    <div class="mermaidFooter" :class="{ isDark: isDark }">
      <div class="statusRow">
        <span class="status">{{ statusText }}</span>
        <button
          v-if="isDesktop"
          type="button"
          class="textButton"
          @click="openConfig"
        >
          {{ $t('mermaid.openConfig') }}
        </button>
        <button
          v-else
          type="button"
          class="textButton"
          @click="$bus.$emit('showAiConfigDialog')"
        >
          {{ $t('mermaid.settings') }}
        </button>
      </div>
      <div class="promptRow">
        <input
          v-model="prompt"
          type="text"
          :placeholder="$t('mermaid.promptPlaceholder')"
          @keydown.enter.prevent="generate"
        />
        <button
          type="button"
          class="ghostButton"
          :disabled="generating"
          @click="generate"
        >
          {{ generating ? $t('mermaid.generating') : $t('mermaid.generate') }}
        </button>
      </div>
      <div class="aiError" v-if="aiError">{{ aiError }}</div>
      <div class="actionRow">
        <div class="leftActions">
          <button type="button" class="ghostButton" @click="copySource">
            {{ $t('mermaid.copy') }}
          </button>
          <button type="button" class="ghostButton" @click="downloadSource">
            {{ $t('mermaid.download') }}
          </button>
          <button type="button" class="ghostButton" @click="pickFile">
            {{ $t('mermaid.open') }}
          </button>
          <input
            ref="file"
            class="fileInput"
            type="file"
            accept=".mmd,.md,.txt,.mermaid"
            @change="onFile"
          />
        </div>
        <button
          type="button"
          class="applyButton"
          :disabled="!previewRoot || !!error"
          @click="apply"
        >
          {{ $t('mermaid.apply') }}
        </button>
      </div>
    </div>
  </el-dialog>
</template>

<script>
import { mapState } from 'vuex'
import { getData, storeData } from '@/api'
import {
  chatCompletionsUrl,
  extractMermaidMindmap,
  mindmapMessages,
  parseMermaidMindmap,
  mermaidDiagramSource,
  stringifyMermaidMindmap
} from '@/utils/mermaidMindmap'
import {
  isBakedMermaidRoot,
  renderMermaidSvg,
  stripMermaidStyle
} from '@/utils/mermaidStyle'

export default {
  props: {
    mindMap: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      visible: false,
      source: '',
      prompt: '',
      error: '',
      aiError: '',
      generating: false,
      previewRoot: null,
      previewReady: false,
      renderToken: 0,
      timer: null,
      isDesktop: false,
      desktopStatus: null
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark,
      aiConfig: state => state.aiConfig
    }),
    browserReady() {
      const config = this.aiConfig || {}
      return Boolean(config.api && config.model && config.key)
    },
    statusText() {
      if (this.isDesktop) {
        return this.$t('mermaid.desktopStatus')
      }
      return this.$t('mermaid.browserStatus')
    }
  },
  created() {
    this.$bus.$on('showMermaid', this.open)
  },
  beforeUnmount() {
    this.$bus.$off('showMermaid', this.open)
    clearTimeout(this.timer)
    this.destroyPreview()
  },
  methods: {
    open() {
      this.visible = true
      this.error = ''
      this.aiError = ''
      const stored = getData() || {}
      this.source =
        stored.mermaidSource || stringifyMermaidMindmap(this.mindMap.getData())
      this.loadStatus()
    },
    onOpened() {
      this.previewReady = true
      this.renderNow()
    },
    onClosed() {
      clearTimeout(this.timer)
      this.previewReady = false
      this.destroyPreview()
    },
    async loadStatus() {
      this.isDesktop = Boolean(window.__TAURI_INTERNALS__)
      if (!this.isDesktop) {
        return
      }
      try {
        this.desktopStatus =
          await window.__TAURI_INTERNALS__.invoke('ai_config_status')
      } catch (error) {
        this.desktopStatus = null
        this.aiError = this.explain(error)
      }
    },
    renderNow() {
      try {
        this.previewRoot = parseMermaidMindmap(this.source)
        this.error = ''
        if (this.previewReady) {
          this.paint()
        }
      } catch (error) {
        this.error = this.explain(error)
      }
    },
    scheduleRender() {
      clearTimeout(this.timer)
      this.timer = setTimeout(() => this.renderNow(), 200)
    },
    async paint() {
      if (!this.$refs.preview || !this.previewRoot) {
        return
      }
      const token = this.renderToken + 1
      this.renderToken = token
      try {
        const rendered = await renderMermaidSvg(
          mermaidDiagramSource(this.source)
        )
        if (token !== this.renderToken || !this.$refs.preview) {
          return
        }
        this.$refs.preview.innerHTML = rendered
      } catch (error) {
        if (token !== this.renderToken) {
          return
        }
        this.error = this.explain(error)
      }
    },
    destroyPreview() {
      this.renderToken += 1
      if (this.$refs.preview) {
        this.$refs.preview.innerHTML = ''
      }
    },
    apply() {
      if (!this.previewRoot || this.error) {
        return
      }
      const stored = getData() || {}
      const current = this.mindMap.getData(true)
      const baked = isBakedMermaidRoot(current.root)
      const layout =
        stored.layoutBeforeMermaid ||
        (baked ? 'logicalStructure' : current.layout)
      const theme = stored.themeBeforeMermaid || current.theme
      const source = mermaidDiagramSource(this.source)
      const root = stripMermaidStyle(this.previewRoot)
      this.$bus.$emit('setData', {
        root,
        layout,
        theme,
        view: null
      })
      storeData({
        mermaidStyle: true,
        mermaidSource: source,
        layoutBeforeMermaid: layout,
        themeBeforeMermaid: theme
      })
      this.$bus.$emit('mermaidStyleChanged', true)
      this.visible = false
    },
    async copySource() {
      try {
        await navigator.clipboard.writeText(this.source)
        this.aiError = this.$t('mermaid.copied')
      } catch (error) {
        this.aiError = this.explain(error)
      }
    },
    downloadSource() {
      const blob = new Blob([this.source], { type: 'text/plain;charset=utf-8' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'mindmap.mmd'
      link.click()
      URL.revokeObjectURL(link.href)
    },
    pickFile() {
      this.$refs.file.click()
    },
    onFile(event) {
      const file = event.target.files && event.target.files[0]
      event.target.value = ''
      if (!file) {
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        this.source = String(reader.result || '')
        this.renderNow()
      }
      reader.readAsText(file)
    },
    async openConfig() {
      try {
        await window.__TAURI_INTERNALS__.invoke('reveal_ai_config')
        await this.loadStatus()
      } catch (error) {
        this.aiError = this.explain(error)
      }
    },
    async generate() {
      const prompt = this.prompt.trim()
      if (!prompt) {
        this.aiError = this.$t('mermaid.emptyPrompt')
        return
      }
      if (this.isDesktop) {
        if (!this.desktopStatus || !this.desktopStatus.configured) {
          this.aiError = this.$t('mermaid.needDesktopKey')
          return
        }
      } else if (!this.browserReady) {
        this.$bus.$emit('showAiConfigDialog')
        this.aiError = this.$t('mermaid.needBrowserKey')
        return
      }
      this.generating = true
      this.aiError = ''
      try {
        const messages = mindmapMessages(prompt)
        const reply = this.isDesktop
          ? await window.__TAURI_INTERNALS__.invoke('ai_complete', { messages })
          : await this.completeInBrowser(messages)
        this.source = extractMermaidMindmap(reply)
        this.renderNow()
      } catch (error) {
        this.aiError = this.explain(error)
      } finally {
        this.generating = false
      }
    },
    async completeInBrowser(messages) {
      const url = chatCompletionsUrl(this.aiConfig.api)
      let response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + this.aiConfig.key
          },
          body: JSON.stringify({
            model: this.aiConfig.model,
            messages
          })
        })
      } catch (error) {
        throw new Error(this.$t('mermaid.corsError'))
      }
      const text = await response.text()
      let data = null
      try {
        data = JSON.parse(text)
      } catch (error) {
        data = null
      }
      if (!response.ok) {
        const message = data && data.error && data.error.message
        throw new Error(message || this.$t('mermaid.failed'))
      }
      const content =
        data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content
      if (!content) {
        throw new Error(this.$t('mermaid.failed'))
      }
      return content
    },
    explain(error) {
      if (error && error.code) {
        const key = 'mermaid.' + error.code
        if (this.$te(key)) {
          return this.$t(key)
        }
      }
      if (error && error.message) {
        return error.message
      }
      return String(error || this.$t('mermaid.failed'))
    }
  },
  watch: {
    source() {
      if (!this.visible) {
        return
      }
      this.scheduleRender()
    },
    // 切换暗色模式后需要用新的 mermaid 主题重绘预览
    isDark() {
      if (this.visible && this.previewReady) {
        this.paint()
      }
    }
  }
}
</script>

<style lang="less">
.mermaidEditorDialog {
  border-radius: 16px;
  overflow: hidden;
  max-width: 1180px;

  .el-dialog__header {
    padding: 18px 22px 8px;
  }

  .el-dialog__title {
    font-weight: 600;
    color: #1a1a1a;
  }

  .el-dialog__body {
    padding: 8px 22px 20px;
  }

  .preview svg,
  .preview svg * {
    box-sizing: content-box;
  }

  .preview svg {
    max-width: 100%;
    height: auto;
  }
}

.mermaidWorkspace {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  height: 62vh;

  .pane {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .editor {
    flex: 1;
    width: 100%;
    resize: none;
    border: 0;
    outline: none;
    border-radius: 12px;
    background: #f6f7f8;
    color: #1a1a1a;
    padding: 16px 18px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.65;
  }

  .parseError {
    margin-top: 8px;
    color: #e25a40;
    font-size: 12px;
    line-height: 1.4;
  }

  .previewPane {
    border-radius: 12px;
    background: #fafafa;
    overflow: hidden;
  }

  .preview {
    width: 100%;
    height: 100%;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &.isDark {
    .editor {
      background: #1c1c1e;
      color: #f5f5f5;
    }

    .previewPane {
      background: #141416;
    }
  }
}

.mermaidFooter {
  margin-top: 14px;

  .statusRow,
  .promptRow,
  .actionRow,
  .settings {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status {
    color: #6b6b6b;
    font-size: 12px;
  }

  .settings {
    margin-top: 10px;
    align-items: flex-end;

    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
      font-size: 12px;
      color: #6b6b6b;
    }

    input {
      height: 36px;
      border: 1px solid #ececec;
      border-radius: 8px;
      padding: 0 10px;
      color: #1a1a1a;
      background: #fff;
    }
  }

  .promptRow {
    margin-top: 10px;

    input {
      flex: 1;
      height: 36px;
      border: 1px solid #ececec;
      border-radius: 8px;
      padding: 0 12px;
      outline: none;
      color: #1a1a1a;
    }
  }

  .aiError {
    margin-top: 8px;
    color: #e25a40;
    font-size: 12px;
  }

  .actionRow {
    margin-top: 12px;
    justify-content: space-between;
  }

  .leftActions {
    display: flex;
    gap: 8px;
  }

  .fileInput {
    display: none;
  }

  .textButton,
  .ghostButton,
  .applyButton {
    height: 36px;
    border-radius: 8px;
    padding: 0 14px;
    cursor: pointer;
    font-size: 13px;
  }

  .textButton {
    border: 0;
    background: transparent;
    color: #e25a40;
    padding: 0;
    height: auto;
  }

  .ghostButton {
    border: 1px solid #ececec;
    background: #fff;
    color: #1a1a1a;
  }

  .ghostButton:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .applyButton {
    border: 0;
    background: #e25a40;
    color: #fff;
    font-weight: 600;
  }

  .applyButton:disabled {
    opacity: 0.45;
    cursor: default;
  }

  &.isDark {
    .status {
      color: #bdbdbd;
    }

    .ghostButton,
    .settings input,
    .promptRow input {
      background: #1c1c1e;
      color: #f5f5f5;
      border-color: #333;
    }
  }
}

@media (max-width: 800px) {
  .mermaidWorkspace {
    grid-template-columns: 1fr;
    height: auto;

    .editor,
    .previewPane {
      height: 280px;
    }
  }
}
</style>
