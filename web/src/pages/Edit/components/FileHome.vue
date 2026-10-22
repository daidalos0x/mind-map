<template>
  <div class="fileHome" :class="{ isDark: isDark }">
    <header class="homeHeader">
      <div class="brand">Mind</div>
      <div class="actions">
        <button type="button" class="secondary" @click="pick">
          {{ $t('home.open') }}
        </button>
        <input
          ref="file"
          class="fileInput"
          type="file"
          accept=".xmind,.smm,.json,.md"
          @change="onFile"
        />
      </div>
    </header>
    <div class="grid">
      <button type="button" class="card newCard" @click="create">
        <div class="thumb">
          <span class="plus">+</span>
        </div>
        <div class="meta">
          <div class="name">{{ $t('home.new') }}</div>
          <div class="time">{{ $t('home.blank') }}</div>
        </div>
      </button>
      <article
        v-for="file in files"
        :key="file.id"
        class="card"
        @click="open(file)"
      >
        <div class="thumb">
          <img v-if="file.thumbnail" :src="file.thumbnail" alt="" />
          <div v-else class="cover">
            <span>{{ file.name }}</span>
          </div>
          <el-dropdown
            class="menu"
            trigger="click"
            @command="command => onCommand(command, file)"
          >
            <button type="button" class="more" @click.stop aria-label="menu">
              <span></span><span></span><span></span>
            </button>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="rename">{{ $t('home.rename') }}</el-dropdown-item>
              <el-dropdown-item command="delete">{{ $t('home.delete') }}</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>
        <div class="meta">
          <div class="name">{{ file.name }}</div>
          <div class="time">{{ formatTime(file.updatedAt) }}</div>
        </div>
      </article>
    </div>
    <el-dialog
      :title="$t('import.xmindCanvasSelectDialogTitle')"
      :visible.sync="canvasVisible"
      width="520px"
      append-to-body
    >
      <el-radio-group v-model="canvasIndex">
        <el-radio v-for="(item, index) in canvasList" :key="index" :label="index">
          {{ item.title || index + 1 }}
        </el-radio>
      </el-radio-group>
      <span slot="footer">
        <el-button type="primary" @click="confirmCanvas">{{ $t('home.confirm') }}</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import xmind from 'simple-mind-map/src/parse/xmind.js'
import markdown from 'simple-mind-map/src/parse/markdown.js'
import { asDocument, blankDocument, browserFileLibrary } from '@/utils/fileLibrary'

export default {
  data() {
    return {
      files: [],
      canvasVisible: false,
      canvasList: [],
      canvasIndex: 0,
      canvasResolve: null
    }
  },
  computed: {
    isDark() {
      return this.$store.state.localConfig.isDark
    }
  },
  created() {
    this.refresh()
  },
  methods: {
    isDesktop() {
      return typeof window.__TAURI_INTERNALS__ !== 'undefined'
    },
    invoke(command, args) {
      return window.__TAURI_INTERNALS__.invoke(command, args || {})
    },
    library() {
      return browserFileLibrary()
    },
    async refresh() {
      if (this.isDesktop()) {
        try {
          const files = await this.invoke('list_files')
          this.files = (files || []).map(file => ({
            id: file.path,
            name: file.name,
            updatedAt: file.modifiedMs,
            thumbnail: file.thumbnail
          }))
        } catch (error) {
          console.log(error)
          this.files = []
        }
        return
      }
      this.files = this.library().list()
    },
    formatTime(value) {
      if (!value) {
        return ''
      }
      return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    async create() {
      if (this.isDesktop()) {
        try {
          const session = await this.invoke('new_file')
          if (window.__desktopShow) {
            window.__desktopShow(session)
          }
          this.$emit('open')
        } catch (error) {
          window.alert(error && error.message ? error.message : error)
        }
        return
      }
      const item = this.library().create(blankDocument())
      this.$emit('open', item)
    },
    async open(file) {
      if (this.isDesktop()) {
        try {
          const session = await this.invoke('open_path', { path: file.id })
          if (window.__desktopShow) {
            window.__desktopShow(session)
          }
          this.$emit('open')
        } catch (error) {
          window.alert(error && error.message ? error.message : error)
        }
        return
      }
      const item = this.library().open(file.id)
      if (item) {
        this.$emit('open', item)
      }
    },
    async pick() {
      if (this.isDesktop()) {
        try {
          const session = await this.invoke('open_file')
          if (!session) {
            return
          }
          if (window.__desktopShow) {
            window.__desktopShow(session)
          }
          this.$emit('open')
        } catch (error) {
          window.alert(error && error.message ? error.message : error)
        }
        return
      }
      this.$refs.file.value = ''
      this.$refs.file.click()
    },
    async onFile(event) {
      const file = event.target.files && event.target.files[0]
      if (!file) {
        return
      }
      try {
        const imported = await this.readImport(file)
        const item = this.library().create(imported.data, imported.name)
        this.$emit('open', item)
      } catch (error) {
        console.log(error)
        this.$message.error(this.$t('import.fileParsingFailed'))
      }
    },
    async readImport(file) {
      const name = file.name.replace(/\.[^.]+$/, '')
      if (/\.xmind$/i.test(file.name)) {
        const data = await xmind.parseXmindFile(file, content => {
          return this.chooseCanvas(content)
        })
        return { name, data: asDocument(data) }
      }
      const text = await file.text()
      if (/\.md$/i.test(file.name)) {
        return { name, data: asDocument(markdown.transformMarkdownTo(text)) }
      }
      const data = JSON.parse(text)
      if (!data || typeof data !== 'object') {
        throw new Error('invalid')
      }
      return { name, data: asDocument(data) }
    },
    chooseCanvas(content) {
      if (!content || content.length <= 1) {
        return content && content[0]
      }
      this.canvasList = content
      this.canvasIndex = 0
      this.canvasVisible = true
      return new Promise(resolve => {
        this.canvasResolve = resolve
      })
    },
    confirmCanvas() {
      if (this.canvasResolve) {
        this.canvasResolve(this.canvasList[this.canvasIndex])
      }
      this.canvasVisible = false
      this.canvasList = []
      this.canvasResolve = null
    },
    async onCommand(command, file) {
      if (command === 'rename') {
        try {
          const { value } = await this.$prompt(this.$t('home.name'), this.$t('home.rename'), {
            inputValue: file.name,
            confirmButtonText: this.$t('home.confirm'),
            cancelButtonText: this.$t('home.cancel')
          })
          if (this.isDesktop()) {
            await this.invoke('rename_file', { path: file.id, name: value })
          } else {
            this.library().rename(file.id, value)
          }
          this.refresh()
        } catch (error) {
          if (error === 'cancel' || error === 'close') {
            return
          }
          window.alert(error && error.message ? error.message : String(error))
        }
        return
      }
      if (command === 'delete') {
        try {
          await this.$confirm(this.$t('home.deleteTip'), this.$t('home.delete'), {
            type: 'warning',
            confirmButtonText: this.$t('home.confirm'),
            cancelButtonText: this.$t('home.cancel')
          })
        } catch (error) {
          return
        }
        try {
          if (this.isDesktop()) {
            await this.invoke('delete_file', { path: file.id })
          } else {
            this.library().remove(file.id)
          }
        } catch (error) {
          window.alert(error && error.message ? error.message : error)
          return
        }
        this.refresh()
        this.$emit('deleted', file)
      }
    }
  }
}
</script>

<style lang="less" scoped>
.fileHome {
  min-height: 100vh;
  background: #f3f4f6;
  color: #1c1c1e;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;

  &.isDark {
    background: #161618;
    color: #f5f5f7;

    .card {
      background: #232326;
      border-color: rgba(255, 255, 255, 0.06);
    }

    .cover,
    .thumb {
      background: #1c1c1f;
    }

    .cover span {
      color: #f0f0f2;
    }

    .newCard {
      border-color: rgba(255, 255, 255, 0.16);
    }

    .plus {
      border-color: rgba(255, 255, 255, 0.16);
      color: rgba(255, 255, 255, 0.55);
    }

    .secondary,
    .more {
      background: #2c2c2e;
      color: #f5f5f7;
      border-color: rgba(255, 255, 255, 0.08);
    }

    .more span {
      background: #f5f5f7;
    }

    .time {
      color: rgba(255, 255, 255, 0.45);
    }

    .empty {
      color: rgba(255, 255, 255, 0.45);
    }
  }
}

.homeHeader,
.grid,
.empty {
  width: min(1080px, calc(100% - 80px));
  margin-left: auto;
  margin-right: auto;
}

.homeHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 40px;
}

.brand {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.actions {
  display: flex;
  gap: 10px;
  padding-bottom: 4px;
}

.fileInput {
  display: none;
}

button {
  border: 0;
  cursor: pointer;
  font-size: 14px;
}

.primary,
.secondary {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
}

.primary {
  background: #e25a40;
  color: #fff;
}

.secondary {
  background: transparent;
  color: #1c1c1e;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
  padding-top: 36px;
  padding-bottom: 64px;
}

.card {
  position: relative;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.06);

    .more {
      opacity: 1;
    }
  }
}

.newCard {
  width: 100%;
  padding: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  background: #fff;
  border-style: dashed;
  border-color: rgba(0, 0, 0, 0.14);
}

.plus {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8e8e93;
  font-size: 22px;
  line-height: 1;
}

.thumb {
  position: relative;
  height: 176px;
  background: #f7f7f8;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 12px;
    box-sizing: border-box;
  }
}

.cover {
  padding: 0 22px;
  text-align: center;

  span {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 18px;
    font-weight: 560;
    letter-spacing: -0.03em;
    line-height: 1.35;
    color: #3a3a3c;
  }
}

.menu {
  position: absolute;
  top: 10px;
  right: 10px;
}

.more {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;

  span {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #3a3a3c;
  }
}

.meta {
  padding: 12px 14px 14px;
}

.name {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  margin-top: 4px;
  color: #8e8e93;
  font-size: 12px;
}
</style>
