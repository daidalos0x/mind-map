<template>
  <div class="fileHome" :class="{ isDark: isDark }">
    <header class="homeHeader">
      <div class="brand">Mind</div>
      <div class="actions">
        <button type="button" class="primary" @click="create">
          {{ $t('home.new') }}
        </button>
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
    <div v-if="files.length" class="grid">
      <article
        v-for="file in files"
        :key="file.id"
        class="card"
        @click="open(file)"
      >
        <div class="thumb">
          <img v-if="file.thumbnail" :src="file.thumbnail" alt="" />
          <div v-else class="fallback">{{ file.name }}</div>
        </div>
        <div class="meta">
          <div class="name">{{ file.name }}</div>
          <div class="time">{{ formatTime(file.updatedAt) }}</div>
          <el-dropdown trigger="click" @command="command => onCommand(command, file)">
            <button type="button" class="more" @click.stop>···</button>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="rename">{{ $t('home.rename') }}</el-dropdown-item>
              <el-dropdown-item command="delete">{{ $t('home.delete') }}</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>
      </article>
    </div>
    <div v-else class="empty">
      <p>{{ $t('home.empty') }}</p>
      <button type="button" class="primary" @click="create">
        {{ $t('home.new') }}
      </button>
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
import { blankDocument, browserFileLibrary } from '@/utils/fileLibrary'

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
    library() {
      return browserFileLibrary()
    },
    refresh() {
      this.files = this.library().list()
    },
    formatTime(value) {
      if (!value) {
        return ''
      }
      return new Date(value).toLocaleString()
    },
    create() {
      const item = this.library().create(blankDocument())
      this.$emit('open', item)
    },
    open(file) {
      const item = this.library().open(file.id)
      if (item) {
        this.$emit('open', item)
      }
    },
    pick() {
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
        return { name, data }
      }
      const text = await file.text()
      if (/\.md$/i.test(file.name)) {
        return { name, data: markdown.transformMarkdownTo(text) }
      }
      const data = JSON.parse(text)
      if (!data || typeof data !== 'object') {
        throw new Error('invalid')
      }
      return { name, data }
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
          this.library().rename(file.id, value)
          this.refresh()
        } catch (error) {
          return
        }
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
        this.library().remove(file.id)
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
  background: #f6f7f8;
  color: #1a1a1a;

  &.isDark {
    background: #1c1c1e;
    color: #f5f5f5;

    .card,
    .secondary {
      background: #2c2c2e;
      color: #f5f5f5;
    }

    .time,
    .fallback {
      color: rgba(255, 255, 255, 0.55);
    }
  }
}

.homeHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 40px 8px;
}

.brand {
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.03em;
}

.actions {
  display: flex;
  gap: 12px;
}

.fileInput {
  display: none;
}

button {
  border: 0;
  cursor: pointer;
  border-radius: 10px;
  height: 40px;
  padding: 0 18px;
  font-size: 14px;
}

.primary {
  background: #e25a40;
  color: #fff;
}

.secondary {
  background: #fff;
  color: #1a1a1a;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 22px;
  padding: 28px 40px 48px;
}

.card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

.thumb {
  height: 150px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.fallback {
  padding: 16px;
  color: #8a8a8a;
  font-size: 16px;
  text-align: center;
}

.meta {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 4px 8px;
  padding: 14px 14px 16px;
  align-items: center;
}

.name {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  grid-column: 1;
  color: #8a8a8a;
  font-size: 12px;
}

.more {
  grid-row: 1 / span 2;
  grid-column: 2;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  color: inherit;
  font-size: 18px;
  letter-spacing: 1px;
}

.empty {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;

  p {
    margin: 0;
    color: #8a8a8a;
    font-size: 16px;
  }
}
</style>
