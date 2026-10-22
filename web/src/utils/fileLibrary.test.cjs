const assert = require('assert')
const esbuild = require('esbuild')
const path = require('path')
const vm = require('vm')

const bundled = esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'fileLibrary.js')],
  bundle: true,
  format: 'cjs',
  write: false,
  platform: 'node'
})
const sandbox = { module: { exports: {} }, exports: {}, require }
sandbox.exports = sandbox.module.exports
vm.runInNewContext(bundled.outputFiles[0].text, sandbox)
const api = sandbox.module.exports

function memoryStorage(initial) {
  const map = new Map(Object.entries(initial || {}))
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  }
}

const stored = {
  SIMPLE_MIND_MAP_DATA: JSON.stringify({
    root: { data: { text: '<p>个人知识管理</p>' }, children: [] }
  })
}
const library = api.createFileLibrary(memoryStorage(stored))
const first = library.list()
assert.strictEqual(first.length, 1)
assert.strictEqual(first[0].name, '个人知识管理')

const created = library.create(api.blankDocument())
assert.strictEqual(created.name, '未命名')
assert.strictEqual(created.data.theme.template, 'classic7')
assert.strictEqual(library.currentId(), created.id)

const again = library.create(api.blankDocument())
assert.strictEqual(again.name, '未命名 2')

const renamed = library.rename(created.id, '未命名 2')
assert.strictEqual(renamed.name, '未命名 2 2')

library.save(created.id, created.data, 'data:image/jpeg;base64,abc')
const saved = library.list().find(item => item.id === created.id)
assert.strictEqual(saved.thumbnail, 'data:image/jpeg;base64,abc')
library.saveThumbnail(created.id, 'data:image/jpeg;base64,new')
const refreshed = library.list().find(item => item.id === created.id)
assert.strictEqual(refreshed.thumbnail, 'data:image/jpeg;base64,new')
assert.strictEqual(refreshed.updatedAt, saved.updatedAt)
assert.strictEqual(refreshed.data.theme.template, 'classic7')
assert.strictEqual(library.saveThumbnail(created.id, ''), null)
assert.strictEqual(library.saveThumbnail('missing', 'data:image/jpeg;base64,x'), null)

const wrapped = api.asDocument({
  data: { text: 'AI Agent 入门' },
  children: []
})
assert.strictEqual(wrapped.root.data.text, 'AI Agent 入门')
assert.strictEqual(wrapped.theme.template, 'classic7')
assert.strictEqual(wrapped.layout, 'logicalStructure')
const kept = api.asDocument({
  root: { data: { text: '保持' }, children: [] },
  layout: 'mindMap',
  theme: { template: 'classic4', config: {} }
})
assert.strictEqual(kept.theme.template, 'classic4')
assert.strictEqual(kept.layout, 'mindMap')

library.remove(created.id)
assert.strictEqual(library.currentId(), again.id)
library.remove(again.id)
assert.strictEqual(library.currentId(), null)
assert.strictEqual(library.list()[0].name, '个人知识管理')

const empty = api.createFileLibrary(memoryStorage({}))
assert.strictEqual(empty.list().length, 0)

console.log('file library ok')
