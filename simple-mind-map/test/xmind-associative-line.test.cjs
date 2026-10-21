const assert = require('assert')
const path = require('path')
const Module = require('module')

const webNodeModules = path.join(__dirname, '../../web/node_modules')
const esbuild = require(path.join(webNodeModules, 'esbuild'))
const JSZip = require(path.join(webNodeModules, 'jszip'))

global.document = {
  documentElement: {},
  createElement() {
    return {
      set innerHTML(html) {
        this._html = String(html)
      },
      get textContent() {
        return (this._html || '').replace(/<[^>]+>/g, '')
      }
    }
  }
}

async function loadXmind() {
  const result = await esbuild.build({
    absWorkingDir: path.join(__dirname, '..'),
    entryPoints: ['src/parse/xmind.js'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    nodePaths: [webNodeModules]
  })
  const filename = path.join(__dirname, 'xmind-bundle.cjs')
  const mod = new Module(filename)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod._compile(result.outputFiles[0].text, filename)
  return mod.exports.default || mod.exports
}

function findNode(root, uid) {
  if (root.data && root.data.uid === uid) return root
  for (const child of root.children || []) {
    const found = findNode(child, uid)
    if (found) return found
  }
  return null
}

async function readContent(blob) {
  const buffer = Buffer.from(await blob.arrayBuffer())
  const zip = await JSZip.loadAsync(buffer)
  return JSON.parse(await zip.file('content.json').async('string'))
}

async function main() {
  const xmind = await loadXmind()
  const data = {
    data: {
      text: '根节点',
      uid: 'root-1',
      associativeLineTargets: ['child-b'],
      associativeLineText: { 'child-b': '依赖' },
      associativeLineStyle: {
        'child-b': {
          associativeLineColor: '#ff0000',
          associativeLineWidth: 3,
          associativeLineDasharray: '6,4'
        }
      },
      associativeLinePoint: [
        {
          startPoint: { x: 1, y: 2, dir: 'right', range: 0 },
          endPoint: { x: 9, y: 8, dir: 'left', range: 0 }
        }
      ],
      associativeLineTargetControlOffsets: [
        [
          { x: 20, y: 0 },
          { x: -12, y: 4 }
        ]
      ]
    },
    children: [
      {
        data: { text: '子节点A', uid: 'child-a' },
        children: []
      },
      {
        data: {
          text: '子节点B',
          uid: 'child-b',
          associativeLineTargets: ['child-a'],
          associativeLineText: { 'child-a': '回链' }
        },
        children: []
      }
    ]
  }

  const content = await readContent(await xmind.transformToXmind(data, '关联线'))
  const relationships = content[0].relationships || []
  assert.deepStrictEqual(
    relationships.map(item => ({
      end1Id: item.end1Id,
      end2Id: item.end2Id,
      title: item.title
    })),
    [
      { end1Id: 'root-1', end2Id: 'child-b', title: '依赖' },
      { end1Id: 'child-b', end2Id: 'child-a', title: '回链' }
    ]
  )

  const imported = await xmind.transformXmind(JSON.stringify(content), {})
  const root = findNode(imported, 'root-1')
  const childA = findNode(imported, 'child-a')
  const childB = findNode(imported, 'child-b')
  assert.ok(root && childA && childB)
  assert.deepStrictEqual(root.data.associativeLineTargets, ['child-b'])
  assert.deepStrictEqual(root.data.associativeLineText, { 'child-b': '依赖' })
  assert.deepStrictEqual(root.data.associativeLineStyle['child-b'], {
    associativeLineColor: '#ff0000',
    associativeLineWidth: 3,
    associativeLineDasharray: '6,4'
  })
  assert.deepStrictEqual(root.data.associativeLinePoint, data.data.associativeLinePoint)
  assert.deepStrictEqual(
    root.data.associativeLineTargetControlOffsets,
    data.data.associativeLineTargetControlOffsets
  )
  assert.deepStrictEqual(childB.data.associativeLineTargets, ['child-a'])
  assert.deepStrictEqual(childB.data.associativeLineText, { 'child-a': '回链' })

  const native = [
    {
      id: 'sheet-1',
      class: 'sheet',
      title: '原生',
      rootTopic: {
        id: 'root',
        title: '根',
        children: {
          attached: [
            { id: 'topic-a', title: 'A', children: { attached: [] } },
            { id: 'topic-b', title: 'B', children: { attached: [] } }
          ]
        }
      },
      relationships: [
        {
          id: 'rel-1',
          end1Id: 'topic-a',
          end2Id: 'topic-b',
          title: '相关',
          style: {
            properties: {
              'line-color': '#336699',
              'line-width': '4pt'
            }
          }
        }
      ]
    }
  ]
  const nativeTree = await xmind.transformXmind(JSON.stringify(native), {})
  const topicA = findNode(nativeTree, 'topic-a')
  assert.deepStrictEqual(topicA.data.associativeLineTargets, ['topic-b'])
  assert.deepStrictEqual(topicA.data.associativeLineText, { 'topic-b': '相关' })
  assert.strictEqual(
    topicA.data.associativeLineStyle['topic-b'].associativeLineColor,
    '#336699'
  )
  assert.strictEqual(
    topicA.data.associativeLineStyle['topic-b'].associativeLineWidth,
    4
  )

  const plain = {
    data: { text: '只有节点', uid: 'only' },
    children: []
  }
  const plainContent = await readContent(
    await xmind.transformToXmind(plain, '无关联线')
  )
  assert.strictEqual(plainContent[0].relationships, undefined)

  console.log('xmind associative line round-trip ok')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
