const assert = require('assert')
const esbuild = require('esbuild')
const path = require('path')
const vm = require('vm')

const bundled = esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'mermaidMindmap.js')],
  bundle: true,
  format: 'cjs',
  write: false,
  platform: 'node'
})
const sandbox = { module: { exports: {} }, exports: {}, require }
sandbox.exports = sandbox.module.exports
vm.runInNewContext(bundled.outputFiles[0].text, sandbox)
const api = sandbox.module.exports

const tree = api.parseMermaidMindmap(`
\`\`\`mermaid
mindmap
  root((主题))
    A[分支]
      leaf(叶子)
    ::icon(fa fa-book)
    另一支
\`\`\`
`)
assert.strictEqual(tree.data.text, '主题')
assert.strictEqual(tree.data.mermaidShape, 'circle')
assert.strictEqual(tree.children[0].data.text, '分支')
assert.strictEqual(tree.children[0].data.mermaidShape, 'square')
assert.strictEqual(tree.children[0].children[0].data.text, '叶子')
assert.strictEqual(tree.children[0].children[0].data.mermaidShape, 'rounded')
assert.strictEqual(tree.children[1].data.text, '另一支')
assert.strictEqual(tree.children[1].data.mermaidShape, undefined)

const tabs = api.parseMermaidMindmap('mindmap\n\t主题\n\t\t分支\n')
assert.strictEqual(tabs.children[0].data.text, '分支')

const exported = api.stringifyMermaidMindmap({
  data: { text: '<p>根节点</p>' },
  children: [{ data: { text: '二级节点' }, children: [] }]
})
assert.ok(exported.startsWith('mindmap\n'))
assert.ok(exported.includes('((根节点))'))
assert.ok(!exported.includes('<p>'))
assert.deepStrictEqual(api.parseMermaidMindmap(exported).children[0].data.text, '二级节点')

const pkm = api.parseMermaidMindmap(`mindmap
  root((个人知识管理<br/>PKM 体系))
    (1. 信息输入<br/>Input)
      [高效阅读]
        索引页 MOC (Map of Content)
`)
assert.strictEqual(pkm.data.mermaidShape, 'circle')
assert.strictEqual(pkm.data.text, '个人知识管理\nPKM 体系')
assert.strictEqual(pkm.children[0].data.mermaidShape, 'rounded')
assert.strictEqual(pkm.children[0].children[0].data.mermaidShape, 'square')
const pkmSource = api.stringifyMermaidMindmap(pkm)
assert.ok(pkmSource.includes('((个人知识管理<br/>PKM 体系))'))
assert.ok(pkmSource.includes('(1. 信息输入<br/>Input)'))
assert.ok(pkmSource.includes('[高效阅读]'))

assert.strictEqual(
  api.chatCompletionsUrl('https://api.openai.com/v1/'),
  'https://api.openai.com/v1/chat/completions'
)
assert.strictEqual(
  api.chatCompletionsUrl('https://example.com/chat/completions'),
  'https://example.com/chat/completions'
)

assert.throws(() => api.parseMermaidMindmap('flowchart TD\n  A-->B'), error => error.code === 'missing')
assert.throws(() => api.parseMermaidMindmap('mindmap\n'), error => error.code === 'empty')
assert.strictEqual(api.extractMermaidMindmap('```mermaid\nmindmap\n  主题\n```').startsWith('mindmap'), true)
assert.strictEqual(
  api.forMermaidRender('mindmap\n  root\n    1. 信息输入\n      灵感\n').includes('1\\. 信息输入'),
  true
)
assert.strictEqual(
  api.forMermaidRender('mindmap\n  root((主题))\n    (1. 信息输入<br/>Input)\n').includes('(1\\. 信息输入<br/>Input)'),
  true
)
assert.throws(() => api.extractMermaidMindmap('hello'), error => error.code === 'noMindmap')

console.log('mermaid mindmap ok')
