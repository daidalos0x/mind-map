<template>
  <div class="desktopHome" :class="{ isDark: isDark }">
    <aside class="sidebar">
      <div class="brand">Mind</div>
      <button
        type="button"
        class="navItem"
        :class="{
          active: view === 'folder' && !currentPath,
          dragOver: dragOverPath === rootPath
        }"
        :data-drop-path="rootPath"
        @click="goAll"
      >
        <span class="icon iconfont iconwenjian"></span>
        {{ $t('home.all') }}
      </button>
      <button
        type="button"
        class="navItem"
        :class="{ active: view === 'recent' }"
        @click="showRecent"
      >
        <span class="icon iconfont iconshijian"></span>
        {{ $t('home.recent') }}
      </button>

      <div class="sectionTitle">{{ $t('home.folders') }}</div>
      <div class="folderNav">
        <button
          v-for="folder in rootFolders"
          :key="folder.path"
          type="button"
          class="navItem"
          :class="{
            active: activeFolder === folder.path,
            dragOver: dragOverPath === folder.path
          }"
          :data-drop-path="folder.path"
          @click="openFolder(folder)"
        >
          <span class="icon iconfont iconwenjianjia"></span>
          <span class="label">{{ folder.name }}</span>
        </button>
        <p class="hint" v-if="!rootFolders.length">
          {{ $t('home.noFolders') }}
        </p>
      </div>

      <div class="spacer"></div>
      <button type="button" class="navItem subtle" @click="reveal">
        <span class="icon iconfont icondakai"></span>
        {{ $t('home.reveal') }}
      </button>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="crumbs" v-if="view === 'folder' && !query">
          <template
            v-for="(crumb, index) in listing.breadcrumb"
            :key="crumb.path"
          >
            <span class="sep" v-if="index">/</span>
            <button
              type="button"
              class="crumb"
              :class="{
                current: index === listing.breadcrumb.length - 1,
                dragOver: dragOverPath === crumb.path
              }"
              :data-drop-path="crumb.path"
              @click="openPath(crumb.path)"
            >
              {{ index === 0 ? $t('home.all') : crumb.name }}
            </button>
          </template>
        </div>
        <div class="crumbs" v-else>
          <span class="crumb current">{{
            query ? $t('home.search') : $t('home.recent')
          }}</span>
        </div>

        <div class="actions">
          <label class="search">
            <span class="icon iconfont iconsousuo"></span>
            <input
              v-model="query"
              :placeholder="$t('home.search')"
              @input="onSearchInput"
            />
            <button
              v-if="query"
              type="button"
              class="clear"
              @click="clearSearch"
            >
              ×
            </button>
          </label>
          <span v-if="version" class="appVersion">v{{ version }}</span>
          <button
            v-if="!isMac()"
            type="button"
            class="secondary"
            @click="$bus.$emit('checkUpdate')"
          >
            {{ $t('updater.check') }}
          </button>
          <button type="button" class="secondary" @click="openExternal">
            {{ $t('home.open') }}
          </button>
          <button type="button" class="primary" @click="createFile">
            {{ $t('home.new') }}
          </button>
          <button type="button" class="secondary" @click="createFolder">
            {{ $t('home.newFolder') }}
          </button>
        </div>
      </header>

      <section class="content">
        <div class="grid" v-if="!loading">
          <article
            v-for="folder in visibleFolders"
            :key="folder.path"
            class="card folderCard"
            :class="{ dragOver: dragOverPath === folder.path }"
            :data-drop-path="folder.path"
            @click="openFolder(folder)"
          >
            <span class="folderGlyph"></span>
            <div class="folderHead">
              <input
                v-if="renamingPath === folder.path"
                ref="renameInput"
                v-model="renameValue"
                class="renameInput"
                @click.stop
                @keydown.enter.stop.prevent="commitRename(folder)"
                @keydown.esc.stop.prevent="cancelRename"
                @blur="commitRename(folder)"
              />
              <template v-else>
                <div class="folderName" :title="folder.name">
                  {{ folder.name }}
                </div>
                <el-dropdown
                  class="folderMenu"
                  trigger="click"
                  @command="command => onFolderCommand(command, folder)"
                >
                  <button
                    type="button"
                    class="more folderMore"
                    @click.stop
                    aria-label="menu"
                  >
                    <span></span><span></span><span></span>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="rename">{{
                        $t('home.rename')
                      }}</el-dropdown-item>
                      <el-dropdown-item command="delete">{{
                        $t('home.delete')
                      }}</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </div>
          </article>

          <article
            v-for="file in visibleFiles"
            :key="file.path"
            class="card fileCard"
            :class="{ dragging: draggingPath === file.path }"
            @mousedown="onPointerDown($event, file)"
            @dragstart.prevent
            @click="openFile(file)"
          >
            <div class="thumb">
              <img
                v-if="file.thumbnail"
                :src="file.thumbnail"
                alt=""
                draggable="false"
              />
              <span v-else class="placeholder iconfont iconwenjian"></span>
              <el-dropdown
                class="menu"
                trigger="click"
                @command="command => onCommand(command, file)"
              >
                <button
                  type="button"
                  class="more"
                  @click.stop
                  aria-label="menu"
                >
                  <span></span><span></span><span></span>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename">{{
                      $t('home.rename')
                    }}</el-dropdown-item>
                    <el-dropdown-item command="move">{{
                      $t('home.moveTo')
                    }}</el-dropdown-item>
                    <el-dropdown-item command="delete">{{
                      $t('home.delete')
                    }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div class="meta">
              <input
                v-if="renamingPath === file.path"
                ref="renameInput"
                v-model="renameValue"
                class="renameInput"
                @click.stop
                @keydown.enter.stop.prevent="commitRename(file)"
                @keydown.esc.stop.prevent="cancelRename"
                @blur="commitRename(file)"
              />
              <template v-else>
                <div class="nameRow">
                  <div class="name" :title="file.name">{{ file.name }}</div>
                  <button
                    type="button"
                    class="nameEdit"
                    :title="$t('home.rename')"
                    @click.stop="beginRename(file, 'file')"
                    @mousedown.stop
                  >
                    <span class="iconfont iconbianji"></span>
                  </button>
                </div>
                <div class="time">{{ formatTime(file.modifiedMs) }}</div>
              </template>
            </div>
          </article>
        </div>

        <div class="empty" v-if="!loading && isEmpty">
          <span
            class="iconfont"
            :class="query ? 'iconsousuo' : 'iconwenjian'"
          ></span>
          <p>{{ query ? $t('home.noResults') : $t('home.emptyFolder') }}</p>
        </div>
      </section>
    </main>

    <el-dialog
      v-model="moveVisible"
      :title="$t('home.moveTo')"
      width="440px"
      append-to-body
    >
      <div class="moveCrumbs">
        <template
          v-for="(crumb, index) in moveListing.breadcrumb"
          :key="crumb.path"
        >
          <span class="sep" v-if="index">/</span>
          <button type="button" class="crumb" @click="loadMoveDir(crumb.path)">
            {{ index === 0 ? $t('home.all') : crumb.name }}
          </button>
        </template>
      </div>
      <div class="moveList">
        <button
          v-for="folder in moveListing.folders"
          :key="folder.path"
          type="button"
          class="moveItem"
          @click="loadMoveDir(folder.path)"
        >
          <span class="icon iconfont iconwenjianjia"></span>
          {{ folder.name }}
        </button>
        <p class="hint" v-if="!moveListing.folders.length">
          {{ $t('home.noFolders') }}
        </p>
      </div>
      <template #footer>
        <el-button @click="moveVisible = false">
          {{ $t('home.cancel') }}
        </el-button>
        <el-button type="primary" :disabled="!canMoveHere" @click="confirmMove">
          {{ $t('home.moveHere') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { isMac, invoke } from '@/utils/desktop'

// 桌面端首页：直接以磁盘目录为结构，不维护额外索引
export default {
  data() {
    return {
      view: 'folder',
      listing: { path: '', breadcrumb: [], folders: [], files: [] },
      rootFolders: [],
      recentFiles: [],
      query: '',
      searchResults: [],
      loading: false,
      moveVisible: false,
      movingFile: null,
      movePath: null,
      moveListing: { path: '', breadcrumb: [], folders: [] },
      searchTimer: null,
      rootPath: '',
      version: '',
      draggingPath: '',
      dragOverPath: '',
      pointerDrag: null,
      suppressClick: false,
      ghost: null,
      renamingPath: '',
      renameValue: '',
      renamingKind: '',
      renaming: false
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark
    }),

    currentPath() {
      const crumbs = this.listing.breadcrumb || []
      return crumbs.length > 1 ? this.listing.path : ''
    },

    activeFolder() {
      return this.view === 'folder' ? this.currentPath : ''
    },

    visibleFolders() {
      if (this.query || this.view !== 'folder') {
        return []
      }
      return this.listing.folders || []
    },

    visibleFiles() {
      if (this.query) {
        return this.searchResults
      }
      return this.view === 'folder'
        ? this.listing.files || []
        : this.recentFiles
    },

    isEmpty() {
      return !this.visibleFolders.length && !this.visibleFiles.length
    },

    canMoveHere() {
      // movePath 为空说明目录没加载成功，此时不能落点，否则会被当成根目录
      return Boolean(
        this.movingFile &&
        this.movePath &&
        this.movePath !== this.dirOf(this.movingFile.path) &&
        this.movePath !== this.movingFile.path
      )
    }
  },
  created() {
    this.reload()
    // macOS 的版本号和更新入口都在应用菜单里，界面不再重复
    if (!isMac()) {
      invoke('desktop_version')
        .then(version => {
          this.version = version
        })
        .catch(error => {
          console.log(error)
        })
    }
  },
  mounted() {
    // WKWebView 不支持页面内的 HTML5 拖拽，统一改成指针事件实现
    window.addEventListener('mousemove', this.onPointerMove)
    window.addEventListener('mouseup', this.onPointerUp)
    window.addEventListener('blur', this.cancelPointerDrag)
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer)
    window.removeEventListener('mousemove', this.onPointerMove)
    window.removeEventListener('mouseup', this.onPointerUp)
    window.removeEventListener('blur', this.cancelPointerDrag)
    this.cancelPointerDrag()
  },
  methods: {
    isMac,

    dirOf(path) {
      const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
      return index > 0 ? path.slice(0, index) : ''
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

    async reload() {
      // loadDir 会把视图切回目录，先记住当前是不是「最近打开」
      const recent = this.view === 'recent'
      await Promise.all([
        this.loadDir(this.listing.path || null),
        this.loadRoot()
      ])
      if (recent) {
        this.view = 'recent'
        await this.loadRecent()
      }
    },

    async loadDir(path) {
      this.loading = true
      try {
        const listing = await invoke('library_list', { dir: path || null })
        this.listing = listing
        this.view = 'folder'
      } catch (error) {
        this.notify(error)
      } finally {
        this.loading = false
      }
    },

    async loadRoot() {
      try {
        const listing = await invoke('library_list', { dir: null })
        this.rootFolders = listing.folders || []
        this.rootPath = listing.path
      } catch (error) {
        console.log(error)
        this.rootFolders = []
      }
    },

    async loadRecent() {
      try {
        this.recentFiles = (await invoke('library_recent')) || []
      } catch (error) {
        console.log(error)
        this.recentFiles = []
      }
    },

    openPath(path) {
      this.query = ''
      this.loadDir(path)
    },

    goAll() {
      this.query = ''
      this.loadDir(null)
    },

    openFolder(folder) {
      this.query = ''
      this.loadDir(folder.path)
    },

    async showRecent() {
      this.query = ''
      this.view = 'recent'
      await this.loadRecent()
    },

    async openFile(file) {
      if (this.suppressClick) {
        this.suppressClick = false
        return
      }
      try {
        const session = await invoke('open_path', { path: file.path })
        if (window.__desktopShow) {
          window.__desktopShow(session)
        }
        this.$emit('open')
      } catch (error) {
        this.notify(error)
      }
    },

    async createFile() {
      try {
        const dir = this.view === 'folder' ? this.listing.path : null
        const session = await invoke('library_create_file', {
          dir: dir || null
        })
        if (window.__desktopShow) {
          window.__desktopShow(session)
        }
        this.$emit('open')
      } catch (error) {
        this.notify(error)
      }
    },

    // 打开文档目录之外的文件：走系统文件选择器
    async openExternal() {
      try {
        const session = await invoke('open_file')
        if (!session) {
          return
        }
        if (window.__desktopShow) {
          window.__desktopShow(session)
        }
        this.$emit('open')
      } catch (error) {
        this.notify(error)
      }
    },

    async createFolder() {
      let name = ''
      try {
        const result = await this.$prompt(
          this.$t('home.name'),
          this.$t('home.newFolder'),
          {
            confirmButtonText: this.$t('home.confirm'),
            cancelButtonText: this.$t('home.cancel')
          }
        )
        name = String(result.value || '').trim()
      } catch (error) {
        return
      }
      if (!name) {
        return
      }
      try {
        await invoke('library_create_folder', {
          dir: this.view === 'folder' ? this.listing.path : null,
          name
        })
        await Promise.all([
          this.loadDir(this.listing.path || null),
          this.loadRoot()
        ])
      } catch (error) {
        this.notify(error)
      }
    },

    onCommand(command, file) {
      if (command === 'rename') {
        this.beginRename(file, 'file')
      } else if (command === 'move') {
        this.openMove(file)
      } else if (command === 'delete') {
        this.removeEntry(file, 'file')
      }
    },

    onFolderCommand(command, folder) {
      if (command === 'rename') {
        this.beginRename(folder, 'folder')
      } else if (command === 'delete') {
        this.removeEntry(folder, 'folder')
      }
    },

    // 文件和文件夹共用一套就地改名状态，kind 只决定调用哪个命令
    beginRename(item, kind) {
      this.renamingPath = item.path
      this.renameValue = item.name
      this.renamingKind = kind
      this.$nextTick(() => {
        const refs = this.$refs.renameInput
        const input = Array.isArray(refs) ? refs[0] : refs
        if (input) {
          input.focus()
          input.select()
        }
      })
    },

    cancelRename() {
      this.renamingPath = ''
      this.renameValue = ''
      this.renamingKind = ''
    },

    async commitRename(item) {
      if (this.renaming || !this.renamingPath) {
        return
      }
      const name = this.renameValue.trim()
      if (!name || name === item.name) {
        this.cancelRename()
        return
      }
      this.renaming = true
      try {
        if (this.renamingKind === 'folder') {
          await invoke('library_rename_folder', { path: item.path, name })
        } else {
          await invoke('rename_file', { path: item.path, name })
        }
        this.cancelRename()
        await this.reload()
      } catch (error) {
        this.cancelRename()
        this.notify(error)
      } finally {
        this.renaming = false
      }
    },

    async removeEntry(item, kind) {
      const tip =
        kind === 'folder'
          ? this.$t('home.deleteFolderTip')
          : this.$t('home.deleteTip')
      try {
        await this.$confirm(tip, this.$t('home.delete'), {
          confirmButtonText: this.$t('home.confirm'),
          cancelButtonText: this.$t('home.cancel'),
          type: 'warning'
        })
      } catch (error) {
        return
      }
      try {
        if (kind === 'folder') {
          await invoke('library_delete_folder', { path: item.path })
        } else {
          await invoke('delete_file', { path: item.path })
        }
        await this.reload()
      } catch (error) {
        this.notify(error)
      }
    },

    onPointerDown(event, file) {
      // 菜单、改名输入框和铅笔按钮都不应该触发拖拽
      if (
        event.button !== 0 ||
        event.target.closest('.more, .renameInput, .nameEdit')
      ) {
        return
      }
      this.pointerDrag = {
        file,
        x: event.clientX,
        y: event.clientY,
        active: false
      }
    },

    onPointerMove(event) {
      const drag = this.pointerDrag
      if (!drag) {
        return
      }
      if (!drag.active) {
        // 移动超过阈值才算拖拽，普通点击仍然能打开文件
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) {
          return
        }
        drag.active = true
        this.draggingPath = drag.file.path
        this.suppressClick = true
        document.body.classList.add('fileDragging')
        this.createGhost(drag.file)
      }
      event.preventDefault()
      this.moveGhost(event)
      const target = document.elementFromPoint(event.clientX, event.clientY)
      const zone = target && target.closest('[data-drop-path]')
      this.dragOverPath = zone ? zone.getAttribute('data-drop-path') : ''
    },

    async onPointerUp() {
      const drag = this.pointerDrag
      this.pointerDrag = null
      if (!drag || !drag.active) {
        return
      }
      const target = this.dragOverPath
      this.draggingPath = ''
      this.dragOverPath = ''
      document.body.classList.remove('fileDragging')
      this.removeGhost()
      // 拖拽结束后浏览器还会补一个 click，这里吞掉，避免误打开文件
      window.setTimeout(() => {
        this.suppressClick = false
      }, 0)
      if (!target || this.dirOf(drag.file.path) === target) {
        return
      }
      try {
        await invoke('library_move', { path: drag.file.path, dir: target })
        await this.reload()
      } catch (error) {
        this.notify(error)
      }
    },

    cancelPointerDrag() {
      this.pointerDrag = null
      this.draggingPath = ''
      this.dragOverPath = ''
      this.suppressClick = false
      document.body.classList.remove('fileDragging')
      this.removeGhost()
    },

    createGhost(file) {
      const ghost = document.createElement('div')
      ghost.className = 'fileDragGhost'
      ghost.textContent = file.name
      document.body.appendChild(ghost)
      this.ghost = ghost
    },

    moveGhost(event) {
      if (!this.ghost) {
        return
      }
      this.ghost.style.left = `${event.clientX}px`
      this.ghost.style.top = `${event.clientY}px`
    },

    removeGhost() {
      if (this.ghost && this.ghost.parentNode) {
        this.ghost.parentNode.removeChild(this.ghost)
      }
      this.ghost = null
    },

    async openMove(file) {
      this.movingFile = file
      this.moveVisible = true
      await this.loadMoveDir(this.dirOf(file.path))
    },

    async loadMoveDir(path) {
      try {
        const listing = await invoke('library_list', { dir: path || null })
        this.moveListing = listing
        this.movePath = listing.path
      } catch (error) {
        this.notify(error)
      }
    },

    async confirmMove() {
      if (!this.movingFile || !this.movePath) {
        return
      }
      try {
        await invoke('library_move', {
          path: this.movingFile.path,
          dir: this.movePath || null
        })
        this.moveVisible = false
        await this.reload()
      } catch (error) {
        this.notify(error)
      }
    },

    onSearchInput() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.runSearch()
      }, 250)
    },

    async runSearch() {
      const query = this.query.trim()
      if (!query) {
        this.searchResults = []
        return
      }
      try {
        this.searchResults = (await invoke('library_search', { query })) || []
      } catch (error) {
        console.log(error)
        this.searchResults = []
      }
    },

    clearSearch() {
      this.query = ''
      this.searchResults = []
    },

    reveal() {
      invoke('reveal_documents').catch(error => this.notify(error))
    },

    notify(error) {
      this.$message.error(
        typeof error === 'string' ? error : this.$t('home.actionFailed')
      )
    }
  }
}
</script>

<style lang="less" scoped>
.desktopHome {
  display: flex;
  height: 100%;
  background: #fff;
  color: #1d1d1f;

  &.isDark {
    background: #1c1c1e;
    color: #f5f5f7;

    .sidebar {
      border-color: hsla(0, 0%, 100%, 0.08);
    }

    .navItem:hover,
    .secondary,
    .search {
      background: hsla(0, 0%, 100%, 0.06);
    }

    .navItem.active {
      background: rgba(64, 158, 255, 0.18);
    }

    .card,
    .moveItem {
      background: hsla(0, 0%, 100%, 0.05);
    }

    .thumb {
      background: hsla(0, 0%, 100%, 0.04);
    }

    .more:hover {
      background: hsla(0, 0%, 100%, 0.1);
    }

    .renameInput {
      background: #2c2c2e;
      color: #f5f5f7;
    }

    .search input {
      color: #f5f5f7;
    }
  }
}

.sidebar {
  width: 216px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 22px 12px 16px;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  overflow-y: auto;
}

.brand {
  padding: 2px 10px 18px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.navItem {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  &.active {
    background: rgba(64, 158, 255, 0.12);
    color: #409eff;
  }

  &.subtle {
    color: #8e8e93;
    font-size: 12px;
  }

  .icon {
    font-size: 14px;
    opacity: 0.8;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.sectionTitle {
  margin: 16px 10px 4px;
  font-size: 11px;
  letter-spacing: 0.6px;
  color: #8e8e93;
  text-transform: uppercase;
}

.folderNav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spacer {
  flex: 1;
  min-height: 24px;
}

.hint {
  margin: 6px 10px;
  font-size: 12px;
  color: #a1a1a6;
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 12px;
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 13px;
  color: #8e8e93;

  .sep {
    color: #c7c7cc;
  }

  .crumb {
    padding: 2px 4px;
    border: none;
    background: transparent;
    color: inherit;
    font-size: 13px;
    cursor: pointer;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      color: #409eff;
    }

    &.current {
      color: inherit;
      font-weight: 500;
      cursor: default;
    }
  }
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.search {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 210px;
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);

  .icon {
    font-size: 13px;
    color: #8e8e93;
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    font-size: 13px;
    color: inherit;
    outline: none;
  }

  .clear {
    border: none;
    background: transparent;
    color: #8e8e93;
    font-size: 14px;
    cursor: pointer;
  }
}

.primary,
.secondary {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.85;
  }
}

.primary {
  background: #409eff;
  color: #fff;
}

.secondary {
  background: rgba(0, 0, 0, 0.04);
  color: inherit;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 24px 32px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
  gap: 16px;
}

.card {
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.03);
  cursor: pointer;
  transition:
    transform 0.15s,
    box-shadow 0.15s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  }
}

.folderCard {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  min-height: 128px;
  padding: 16px;
}

.folderGlyph {
  width: 40px;
  height: 32px;
  border-radius: 6px;
  background: linear-gradient(180deg, #7cb8ff, #409eff);

  &::before {
    content: '';
    display: block;
    width: 16px;
    height: 6px;
    margin-top: -5px;
    margin-left: 4px;
    border-radius: 4px 4px 0 0;
    background: #7cb8ff;
  }
}

.folderHead {
  display: flex;
  align-items: center;
  gap: 6px;
}

.folderName {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folderMore {
  opacity: 0;
  background: transparent;
}

.folderCard:hover .folderMore {
  opacity: 1;
}

// 拖拽反馈：可放置的目标高亮，被拖动的卡片变淡
.folderCard.dragOver,
.navItem.dragOver,
.crumb.dragOver {
  background: rgba(64, 158, 255, 0.12);
  box-shadow: inset 0 0 0 2px #409eff;
}

.fileCard.dragging {
  opacity: 0.45;
}

.fileCard {
  overflow: hidden;
}

.thumb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 10;
  background: rgba(0, 0, 0, 0.02);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    -webkit-user-drag: none;
  }

  .placeholder {
    font-size: 26px;
    color: #c7c7cc;
  }
}

.menu {
  position: absolute;
  top: 8px;
  right: 8px;
}

.more {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 6px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;

  span {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #8e8e93;
  }
}

.card:hover .more {
  opacity: 1;
}

.card:hover .nameEdit {
  opacity: 1;
}

.appVersion {
  color: #8e8e93;
  font-size: 12px;
}

// 文件和文件夹共用同一个就地改名输入框
.renameInput {
  width: 100%;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: none;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 0 0 1px #409eff inset;
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
  outline: none;
}

.meta {
  padding: 10px 12px 12px;

  .nameRow {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nameEdit {
    flex-shrink: 0;
    padding: 2px;
    border: none;
    background: transparent;
    color: #8e8e93;
    font-size: 12px;
    cursor: pointer;
    opacity: 0;
    transition:
      opacity 0.15s,
      color 0.15s;

    &:hover {
      color: #409eff;
    }
  }

  .time {
    margin-top: 3px;
    font-size: 11px;
    color: #8e8e93;
  }
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 80px 0;
  color: #a1a1a6;

  .iconfont {
    font-size: 30px;
  }

  p {
    margin: 0;
    font-size: 13px;
  }
}

.moveCrumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #8e8e93;

  .crumb {
    border: none;
    background: transparent;
    color: inherit;
    font-size: 13px;
    cursor: pointer;

    &:hover {
      color: #409eff;
    }
  }
}

.moveList {
  max-height: 260px;
  overflow-y: auto;
}

.moveItem {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
  color: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  margin-bottom: 6px;

  &:hover {
    background: rgba(64, 158, 255, 0.12);
  }

  .icon {
    font-size: 14px;
    color: #409eff;
  }
}
</style>
