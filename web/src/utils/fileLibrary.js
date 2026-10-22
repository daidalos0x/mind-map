import { DEMO_NAME, demoDocument } from './demoDocument'

const LIBRARY_KEY = 'SIMPLE_MIND_MAP_LIBRARY'
const CURRENT_ID_KEY = 'SIMPLE_MIND_MAP_CURRENT_ID'
const DATA_KEY = 'SIMPLE_MIND_MAP_DATA'
const DEMO_KEY = 'SIMPLE_MIND_MAP_DEMO'
const UNTITLED = '未命名'

const clone = value => JSON.parse(JSON.stringify(value))

export function blankDocument() {
  return {
    layout: 'logicalStructure',
    root: {
      data: { text: '根节点' },
      children: []
    },
    theme: {
      template: 'classic7',
      config: {}
    },
    view: null
  }
}

export function asDocument(data) {
  if (data && data.root && data.root.data) {
    return {
      ...data,
      layout: data.layout || 'logicalStructure',
      theme:
        data.theme && data.theme.template
          ? data.theme
          : { template: 'classic7', config: {} },
      view: data.view == null ? null : data.view
    }
  }
  const root =
    data && (data.data || data.children)
      ? data
      : { data: { text: '根节点' }, children: [] }
  return {
    layout: 'logicalStructure',
    root,
    theme: { template: 'classic7', config: {} },
    view: null
  }
}

export function plainTitle(data) {
  const raw =
    data && data.root && data.root.data && data.root.data.text
      ? data.root.data.text
      : ''
  const text = String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text || UNTITLED
}

const createId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const readList = storage => {
  const raw = storage.getItem(LIBRARY_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch (error) {
    return null
  }
}

const writeList = (storage, items) => {
  storage.setItem(LIBRARY_KEY, JSON.stringify(items))
}

export function uniqueName(base, items, exceptId) {
  const used = new Set(
    items.filter(item => item.id !== exceptId).map(item => item.name)
  )
  const title = base || UNTITLED
  if (!used.has(title)) {
    return title
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = title + ' ' + index
    if (!used.has(candidate)) {
      return candidate
    }
  }
  return title + ' ' + Date.now()
}

export function createFileLibrary(storage) {
  const ensure = () => {
    const existing = readList(storage)
    if (existing) {
      return existing
    }
    const raw = storage.getItem(DATA_KEY)
    if (!raw) {
      writeList(storage, [])
      return []
    }
    let data = null
    try {
      data = JSON.parse(raw)
    } catch (error) {
      data = null
    }
    if (!data || typeof data !== 'object') {
      writeList(storage, [])
      return []
    }
    const item = {
      id: createId(),
      name: plainTitle(data),
      updatedAt: Date.now(),
      data,
      thumbnail: ''
    }
    const items = [item]
    writeList(storage, items)
    return items
  }

  const list = () =>
    ensure()
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)

  const rememberCurrent = item => {
    storage.setItem(CURRENT_ID_KEY, item.id)
    storage.setItem(DATA_KEY, JSON.stringify(item.data))
  }

  return {
    list,
    currentId: () => storage.getItem(CURRENT_ID_KEY),
    create(data, name) {
      const items = ensure()
      const item = {
        id: createId(),
        name: uniqueName(name || UNTITLED, items),
        updatedAt: Date.now(),
        data: clone(data || blankDocument()),
        thumbnail: ''
      }
      items.unshift(item)
      writeList(storage, items)
      rememberCurrent(item)
      return item
    },
    open(id) {
      const item = ensure().find(entry => entry.id === id)
      if (!item) {
        return null
      }
      rememberCurrent(item)
      return item
    },
    rename(id, name) {
      const items = ensure()
      const item = items.find(entry => entry.id === id)
      if (!item) {
        return null
      }
      item.name = uniqueName(String(name || '').trim() || UNTITLED, items, id)
      item.updatedAt = Date.now()
      writeList(storage, items)
      return item
    },
    remove(id) {
      const items = ensure().filter(entry => entry.id !== id)
      writeList(storage, items)
      if (storage.getItem(CURRENT_ID_KEY) === id) {
        storage.removeItem(CURRENT_ID_KEY)
      }
      return items
    },
    save(id, data, thumbnail) {
      const items = ensure()
      const item = items.find(entry => entry.id === id)
      if (!item) {
        return null
      }
      item.data = clone(data)
      item.updatedAt = Date.now()
      if (typeof thumbnail === 'string') {
        item.thumbnail = thumbnail
      }
      writeList(storage, items)
      if (storage.getItem(CURRENT_ID_KEY) === id) {
        storage.setItem(DATA_KEY, JSON.stringify(item.data))
      }
      return item
    },
    saveThumbnail(id, thumbnail) {
      if (typeof thumbnail !== 'string' || !thumbnail) {
        return null
      }
      const items = ensure()
      const item = items.find(entry => entry.id === id)
      if (!item) {
        return null
      }
      item.thumbnail = thumbnail
      writeList(storage, items)
      return item
    }
  }
}

export const browserFileLibrary = () => createFileLibrary(localStorage)

// 首次打开网页时内置一个示例导图，已有文件或已经内置过时返回 null
export function seedDemoDocument(storage) {
  if (storage.getItem(DEMO_KEY)) {
    return null
  }
  const library = createFileLibrary(storage)
  if (library.list().length > 0) {
    return null
  }
  const item = library.create(demoDocument(), DEMO_NAME)
  storage.setItem(DEMO_KEY, item.id)
  return item
}
