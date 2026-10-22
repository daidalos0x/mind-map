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

// 当前是否处于暗色模式：Index.vue 会把 isDark 类挂在 document.body 上
export const isDarkMode = () =>
  typeof document !== 'undefined' &&
  Boolean(document.body && document.body.classList.contains('isDark'))

export const ensureOfficialMermaid = (dark = isDarkMode()) => {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    // 暗色模式下必须用 dark 主题，否则连线/文字是深色，在深色画布上看不见
    theme: dark ? 'dark' : 'default',
    fontFamily: '"trebuchet ms", verdana, arial, sans-serif',
    mindmap: {
      useMaxWidth: true,
      padding: 10,
      maxNodeWidth: 200
    }
  })
}

/**
 * mermaid 开关内部会用 setFullData 恢复「进入 mermaid 之前的主题」，
 * 这会触发 view_theme_change。Theme.vue 监听到该事件后会按「主题是否暗色」
 * 反过来改写用户的 isDark 设置，导致关掉 mermaid 时整个界面从暗色跳回亮色。
 * 这里用一个标志位把这个自动同步屏蔽掉。
 */
let suppressThemeDarkSync = false

export const isThemeDarkSyncSuppressed = () => suppressThemeDarkSync

const withoutThemeDarkSync = fn => {
  const prev = suppressThemeDarkSync
  suppressThemeDarkSync = true
  try {
    return fn()
  } finally {
    suppressThemeDarkSync = prev
  }
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

const translateOf = value => {
  const match = /translate\(\s*([-\d.eE+]+)[,\s]+([-\d.eE+]+)\s*\)/.exec(value || '')
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 }
}

const pathPoints = value => {
  const nums = String(value || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)
  if (!nums || nums.length < 4) {
    return []
  }
  const points = []
  for (let index = 0; index + 1 < nums.length; index += 2) {
    points.push({ x: Number(nums[index]), y: Number(nums[index + 1]) })
  }
  return points
}

const separateMindmapOverlaps = svg => {
  const gap = 16
  const nodeEls = [...svg.querySelectorAll('g.mindmap-node')]
  if (nodeEls.length < 2) {
    return
  }
  const nodes = nodeEls.map(el => {
    const origin = translateOf(el.getAttribute('transform'))
    const box = el.getBBox()
    return {
      el,
      origin,
      x: origin.x + box.x,
      y: origin.y + box.y,
      w: box.width,
      h: box.height,
      dx: 0,
      dy: 0
    }
  })
  const center = node => ({
    x: node.x + node.dx + node.w / 2,
    y: node.y + node.dy + node.h / 2
  })
  const edges = [...svg.querySelectorAll('path.edge')].map(el => {
    const points = pathPoints(el.getAttribute('d'))
    const nearest = point => {
      let best = nodes[0]
      let bestDistance = Infinity
      nodes.forEach(node => {
        const c = center(node)
        const distance = (c.x - point.x) ** 2 + (c.y - point.y) ** 2
        if (distance < bestDistance) {
          best = node
          bestDistance = distance
        }
      })
      return best
    }
    return {
      el,
      points,
      start: points.length ? nearest(points[0]) : null,
      end: points.length ? nearest(points[points.length - 1]) : null
    }
  })
  for (let pass = 0; pass < 80; pass += 1) {
    let moved = false
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]
        const b = nodes[j]
        const ax = a.x + a.dx - gap
        const ay = a.y + a.dy - gap
        const bx = b.x + b.dx - gap
        const by = b.y + b.dy - gap
        const overlapX = Math.min(ax + a.w + gap * 2, bx + b.w + gap * 2) - Math.max(ax, bx)
        const overlapY = Math.min(ay + a.h + gap * 2, by + b.h + gap * 2) - Math.max(ay, by)
        if (overlapX <= 0 || overlapY <= 0) {
          continue
        }
        const ac = center(a)
        const bc = center(b)
        const push = Math.min(overlapX, overlapY) / 2 + 0.5
        if (overlapX < overlapY) {
          const direction = bc.x >= ac.x ? 1 : -1
          a.dx -= direction * push
          b.dx += direction * push
        } else {
          const direction = bc.y >= ac.y ? 1 : -1
          a.dy -= direction * push
          b.dy += direction * push
        }
        moved = true
      }
    }
    if (!moved) {
      break
    }
  }
  nodes.forEach(node => {
    node.el.setAttribute(
      'transform',
      'translate(' + (node.origin.x + node.dx) + ', ' + (node.origin.y + node.dy) + ')'
    )
  })
  edges.forEach(edge => {
    if (!edge.points.length || !edge.start || !edge.end) {
      return
    }
    const start = edge.points[0]
    const end = edge.points[edge.points.length - 1]
    const movedStart = {
      x: start.x + edge.start.dx,
      y: start.y + edge.start.dy
    }
    const movedEnd = {
      x: end.x + edge.end.dx,
      y: end.y + edge.end.dy
    }
    const mid = {
      x: (movedStart.x + movedEnd.x) / 2,
      y: (movedStart.y + movedEnd.y) / 2
    }
    edge.el.setAttribute(
      'd',
      'M ' + movedStart.x + ',' + movedStart.y + ' L ' + mid.x + ',' + mid.y + ' L ' + movedEnd.x + ',' + movedEnd.y
    )
  })
  const minX = Math.min(...nodes.map(node => node.x + node.dx))
  const minY = Math.min(...nodes.map(node => node.y + node.dy))
  const maxX = Math.max(...nodes.map(node => node.x + node.dx + node.w))
  const maxY = Math.max(...nodes.map(node => node.y + node.dy + node.h))
  const pad = 20
  const width = maxX - minX + pad * 2
  const height = maxY - minY + pad * 2
  svg.setAttribute('viewBox', minX - pad + ' ' + (minY - pad) + ' ' + width + ' ' + height)
  svg.style.maxWidth = width + 'px'
}

export const renderMermaidSvg = async (source, options = {}) => {
  const dark = options.dark === undefined ? isDarkMode() : Boolean(options.dark)
  ensureOfficialMermaid(dark)
  const id = 'mind-official-' + ++renderSerial
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;z-index:-1;'
  document.body.appendChild(host)
  try {
    const rendered = await mermaid.render(id, forMermaidRender(source))
    host.innerHTML = rendered.svg
    const svg = host.querySelector('svg')
    if (svg) {
      separateMindmapOverlaps(svg)
    }
    return host.innerHTML
  } catch (error) {
    // mermaid v10 的临时容器 id 是 "d" + id，异常路径下它自己不会清理
    ;[id, 'd' + id].forEach(nodeId => {
      const failed = document.getElementById(nodeId)
      if (failed && failed.parentNode) {
        failed.parentNode.removeChild(failed)
      }
    })
    throw error
  } finally {
    host.remove()
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
  const alreadyOn = stored.mermaidStyle === true
  const baked =
    !alreadyOn &&
    full.root &&
    full.root.data &&
    full.root.data.shape === 'circle' &&
    full.root.data.customLeft != null
  const layoutBefore = alreadyOn
    ? stored.layoutBeforeMermaid || full.layout
    : full.layout
  const themeBefore = alreadyOn
    ? stored.themeBeforeMermaid || full.theme
    : full.theme
  if (baked) {
    const root = stripMermaidStyle(full.root)
    withoutThemeDarkSync(() =>
      mindMap.setFullData({
        root,
        layout: layoutBefore,
        theme: themeBefore,
        view: null
      })
    )
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
    layoutBeforeMermaid: layoutBefore,
    themeBeforeMermaid: themeBefore
  })
}

export const disableMermaidStyle = mindMap => {
  const stored = getData() || {}
  const full = mindMap.getData(true)
  const root = stripMermaidStyle(full.root)
  const layout = stored.layoutBeforeMermaid || full.layout
  const theme = stored.themeBeforeMermaid || full.theme
  fitWhenReady(mindMap)
  withoutThemeDarkSync(() =>
    mindMap.setFullData({
      root,
      layout,
      theme,
      view: null
    })
  )
  storeData({
    mermaidStyle: false,
    root,
    layout,
    theme
  })
}
