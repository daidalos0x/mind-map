<template>
  <el-dialog
    v-model="visible"
    :title="$t('updater.title')"
    width="420px"
    append-to-body
    :show-close="!installing"
    :close-on-click-modal="!installing"
    :close-on-press-escape="!installing"
  >
    <div class="updaterBody" :class="{ isDark }">
      <p class="versionLine">
        <span>v{{ currentVersion }}</span>
        <span class="arrow">→</span>
        <span class="target">v{{ info.version }}</span>
      </p>
      <div v-if="info.notes" class="notes">{{ info.notes }}</div>
      <template v-if="installing">
        <el-progress
          :percentage="percent"
          :indeterminate="!totalBytes"
          :stroke-width="8"
        />
        <p class="installingTip">{{ $t('updater.installing') }}</p>
      </template>
    </div>
    <template #footer>
      <el-button :disabled="installing" @click="visible = false">{{
        $t('updater.later')
      }}</el-button>
      <el-button type="primary" :loading="installing" @click="install">{{
        $t('updater.install')
      }}</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { mapState } from 'vuex'
import { isDesktop, invoke } from '@/utils/desktop'

export default {
  data() {
    return {
      visible: false,
      currentVersion: '',
      info: { version: '', notes: '' },
      checking: false,
      installing: false,
      percent: 0,
      totalBytes: 0,
      timer: null
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark
    })
  },
  created() {
    this.$bus.$on('checkUpdate', this.onManualCheck)
  },
  mounted() {
    if (isDesktop()) {
      this.checkForUpdates({ silent: true })
    }
  },
  beforeUnmount() {
    this.$bus.$off('checkUpdate', this.onManualCheck)
    this.stopPolling()
  },
  methods: {
    onManualCheck() {
      this.checkForUpdates({ silent: false })
    },
    async checkForUpdates({ silent = false } = {}) {
      if (this.checking || this.installing) {
        return
      }
      this.checking = true
      try {
        const status = await invoke('check_update')
        this.currentVersion = status.currentVersion
        if (status.update) {
          this.info = status.update
          this.visible = true
        } else if (!silent) {
          this.$message.success(this.$t('updater.upToDate'))
        }
      } catch (error) {
        console.log(error)
        // 后端返回的是给用户看的中文提示（如 deb 不支持自动更新），直接展示
        if (!silent) {
          this.$message.error(
            typeof error === 'string' ? error : this.$t('updater.failed')
          )
        }
      } finally {
        this.checking = false
      }
    },
    async install() {
      this.installing = true
      this.percent = 0
      this.totalBytes = 0
      this.startPolling()
      try {
        // 安装完成后主进程会重启，这里的 promise 不会再返回
        await invoke('install_update', { version: this.info.version })
      } catch (error) {
        console.log(error)
        this.$message.error(
          typeof error === 'string' ? error : this.$t('updater.failed')
        )
        this.installing = false
        this.stopPolling()
      }
    },
    startPolling() {
      this.stopPolling()
      this.timer = setInterval(async () => {
        try {
          const progress = await invoke('update_progress')
          this.totalBytes = progress.total || 0
          if (progress.total > 0) {
            this.percent = Math.min(
              100,
              Math.round((progress.downloaded / progress.total) * 100)
            )
          }
        } catch (error) {
          console.log(error)
        }
      }, 400)
    },
    stopPolling() {
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
    }
  }
}
</script>

<style lang="less" scoped>
.updaterBody {
  color: #1c1c1e;

  p {
    margin: 0;
  }

  &.isDark {
    color: #f5f5f7;

    .notes {
      background: #1c1c1f;
      color: rgba(255, 255, 255, 0.72);
    }
  }
}

.versionLine {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;

  .arrow {
    color: #8e8e93;
  }

  .target {
    color: #e25a40;
  }
}

.notes {
  max-height: 220px;
  margin-top: 12px;
  padding: 10px 12px;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.6;
  color: #3a3a3c;
  background: #f5f5f7;
  border-radius: 8px;
}

.installingTip {
  margin-top: 10px;
  font-size: 12px;
  color: #8e8e93;
}
</style>
