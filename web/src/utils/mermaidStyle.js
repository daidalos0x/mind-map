import mermaid from 'mermaid/dist/mermaid.min.js'
import { getData, storeData } from '@/api'
import { forMermaidRender, mermaidDiagramSource, stringifyMermaidMindmap } from '@/utils/mermaidMindmap'

const STYLE_KEYS = [
  'fillColor',
  'color',
  'borderColor',
  'borderWidth',
  'borderRadius',
  'shape',
  'fontSize',
  'fontFamily',
  'customTextWidth',
  'paddingX',
  'paddingY',
  'lineColor',
  'lineWidth',
  'customLeft',
  'customTop'
]

export const ensureOfficialMermaid = () => {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'default',
    fontFamily: '"trebuchet ms", verdana, arial, sans-serif',
    mindmap: {
      useMaxWidth: true,
      padding: 10,
      maxNodeWidth: 200
    }
  })
}

export const isMermaidStyleOn = () => {
  const data = getData()
  if (!data) {
    return false
  }
  if (data.mermaidStyle) {
    return true
  }
  const root = data.root
  return Boolean(
    root && root.data && root.data.shape === 'circle' && root.data.customLeft != null
  )
}

export const stripMermaidStyle = root => {
  const tree = JSON.parse(JSON.stringify(root || { data: { text: '' }, children: [] }))
  const walk = node => {
    STYLE_KEYS.forEach(key => {
      delete node.data[key]
    })
    ;(node.children || []).forEach(walk)
  }
  walk(tree)
  return tree
}

export const mermaidSourceFor = mindMap => {
  const stored = getData() || {}
  if (typeof stored.mermaidSource === 'string' && stored.mermaidSource.trim()) {
    return mermaidDiagramSource(stored.mermaidSource)
  }
  return stringifyMermaidMindmap(stripMermaidStyle(mindMap.getData()))
}

let renderSerial = 0

export const renderMermaidSvg = async source => {
  ensureOfficialMermaid()
  const id = 'mind-official-' + ++renderSerial
  try {
    const rendered = await mermaid.render(id, forMermaidRender(source))
    return rendered.svg
  } catch (error) {
    const failed = document.getElementById(id)
    if (failed && failed.parentNode) {
      failed.parentNode.removeChild(failed)
    }
    throw error
  }
}

const fitWhenReady = mindMap => {
  const fitOnce = () => {
    mindMap.off('node_tree_render_end', fitOnce)
    mindMap.view.fit()
  }
  mindMap.on('node_tree_render_end', fitOnce)
}

export const enableMermaidStyle = mindMap => {
  const stored = getData() || {}
  const full = mindMap.getData(true)
  const baked =
    full.root &&
    full.root.data &&
    full.root.data.shape === 'circle' &&
    full.root.data.customLeft != null
  const layoutBefore = stored.layoutBeforeMermaid || (baked ? 'logicalStructure' : full.layout)
  const themeBefore = stored.themeBeforeMermaid || full.theme
  if (baked) {
    const root = stripMermaidStyle(full.root)
    mindMap.setFullData({
      root,
      layout: layoutBefore,
      theme: themeBefore,
      view: null
    })
    storeData({
      mermaidStyle: true,
      layoutBeforeMermaid: layoutBefore,
      themeBeforeMermaid: themeBefore,
      root,
      layout: layoutBefore,
      theme: themeBefore
    })
    return
  }
  storeData({
    mermaidStyle: true,
    layoutBeforeMermaid: stored.layoutBeforeMermaid || full.layout,
    themeBeforeMermaid: stored.themeBeforeMermaid || full.theme
  })
}

export const disableMermaidStyle = mindMap => {
  const stored = getData() || {}
  const full = mindMap.getData(true)
  const root = stripMermaidStyle(full.root)
  const layout = stored.layoutBeforeMermaid || 'logicalStructure'
  const theme = stored.themeBeforeMermaid || full.theme
  fitWhenReady(mindMap)
  mindMap.setFullData({
    root,
    layout,
    theme,
    view: null
  })
  storeData({
    mermaidStyle: false,
    root,
    layout,
    theme
  })
}
