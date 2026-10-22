const SHAPES = [
  { name: 'bang', pattern: /^\)\)([\s\S]*)\(\($/ },
  { name: 'cloud', pattern: /^\)([\s\S]*)\($/ },
  { name: 'circle', pattern: /^\(\(([\s\S]*)\)\)$/ },
  { name: 'rounded', pattern: /^\(([\s\S]*)\)$/ },
  { name: 'square', pattern: /^\[([\s\S]*)\]$/ },
  { name: 'hexagon', pattern: /^\{\{([\s\S]*)\}\}$/ },
  { name: 'brace', pattern: /^\{([\s\S]*)\}$/ }
]

function fail(code) {
  const error = new Error(code)
  error.code = code
  return error
}

export function plainText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function unwrapFence(source) {
  const text = String(source || '').replace(/^\uFEFF/, '')
  const fence = text.match(/```(?:mermaid)?\s*([\s\S]*?)```/i)
  return fence ? fence[1] : text
}

function nodeLabel(token) {
  let value = token.replace(/::icon\([^)]*\)/gi, '').trim()
  value = value.replace(/^[\w.-]+(?=\s*[\[({])/, '').trim()
  let shape = ''
  for (let index = 0; index < SHAPES.length; index++) {
    const match = value.match(SHAPES[index].pattern)
    if (match) {
      value = match[1]
      shape = SHAPES[index].name
      break
    }
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }
  return {
    text: value.replace(/\\"/g, '"').replace(/<br\s*\/?>/gi, '\n').trim(),
    shape
  }
}

function indentWidth(line) {
  const match = line.match(/^[ \t]*/)
  return match[0].replace(/\t/g, '  ').length
}

export function mermaidDiagramSource(source) {
  const text = unwrapFence(source).trim()
  const start = text.search(/mindmap\b/)
  if (start < 0) {
    throw fail('missing')
  }
  return text.slice(start)
}

export function forMermaidRender(source) {
  const diagram = mermaidDiagramSource(source)
  return diagram
    .split('\n')
    .map((line, index) => {
      if (index === 0) {
        return line
      }
      return line.replace(
        /^(\s*(?:\(\(|\)\)|\{\{|\[|\(|\)|\{)?)(\d+)\.(?=\s)/,
        (all, prefix, number) => prefix + number + '\\.'
      )
    })
    .join('\n')
}

export function parseMermaidMindmap(source) {
  const lines = unwrapFence(source).replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex(line => /^\s*mindmap\b/.test(line))
  if (start < 0) {
    throw fail('missing')
  }
  const items = []
  for (let index = start + 1; index < lines.length; index++) {
    const raw = lines[index]
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('%%') || trimmed.startsWith(':::')) {
      continue
    }
    if (trimmed.startsWith('```')) {
      break
    }
    const label = nodeLabel(raw.trim())
    if (!label.text) {
      continue
    }
    items.push({
      indent: indentWidth(raw),
      text: label.text,
      shape: label.shape
    })
  }
  if (!items.length) {
    throw fail('empty')
  }
  const root = {
    data: { text: items[0].text },
    children: []
  }
  if (items[0].shape) {
    root.data.mermaidShape = items[0].shape
  }
  const stack = [{ indent: items[0].indent, node: root }]
  for (let index = 1; index < items.length; index++) {
    const item = items[index]
    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) {
      stack.pop()
    }
    const parent = stack[stack.length - 1].node
    const node = {
      data: { text: item.text },
      children: []
    }
    if (item.shape) {
      node.data.mermaidShape = item.shape
    }
    parent.children.push(node)
    stack.push({ indent: item.indent, node })
  }
  return root
}

function mermaidText(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function mermaidLine(text, shape) {
  const cleaned = mermaidText(text).replace(/\n/g, '<br/>') || ' '
  const safe = /^[^[\](){}#`"]+$/.test(cleaned)
  const body = safe ? cleaned : '"' + cleaned.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
  if (shape === 'circle') {
    return '((' + body + '))'
  }
  if (shape === 'rounded') {
    return '(' + body + ')'
  }
  if (shape === 'square') {
    return '[' + body + ']'
  }
  if (shape === 'hexagon') {
    return '{{' + body + '}}'
  }
  if (shape === 'cloud') {
    return ')' + body + '('
  }
  if (shape === 'bang') {
    return '))' + body + '(('
  }
  if (shape === 'brace') {
    return '{' + body + '}'
  }
  if (safe) {
    return cleaned
  }
  return '["' + cleaned.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]'
}

export function applyMermaidAppearance(root, preview) {
  const tree = JSON.parse(JSON.stringify(root || { data: { text: '' }, children: [] }))
  const svg = preview && preview.querySelector && preview.querySelector('svg')
  const elements = svg ? [...svg.querySelectorAll('g.mindmap-node')] : []
  const ordered = []
  const walk = node => {
    ordered.push(node)
    ;(node.children || []).forEach(walk)
  }
  walk(tree)
  if (!elements.length || elements.length !== ordered.length) {
    return tree
  }
  const boxes = elements.map(element => element.getBoundingClientRect())
  const placed = boxes.map(box => {
    const leftTop = svgUserPoint(svg, box.left, box.top)
    const rightBottom = svgUserPoint(svg, box.right, box.bottom)
    return {
      left: Math.min(leftTop.x, rightBottom.x),
      top: Math.min(leftTop.y, rightBottom.y),
      width: Math.abs(rightBottom.x - leftTop.x),
      height: Math.abs(rightBottom.y - leftTop.y)
    }
  })
  const rootBox = placed[0]
  const rootCenterX = rootBox.left + rootBox.width / 2
  const rootCenterY = rootBox.top + rootBox.height / 2
  const ourRootSize = 220
  const mermaidRootSize = Math.max(rootBox.width, rootBox.height, 1)
  const spread = Math.max(1.8, ourRootSize / mermaidRootSize)
  const minX = Math.min(
    ...placed.map(box => {
      const centerX = box.left + box.width / 2
      return rootCenterX + (centerX - rootCenterX) * spread - box.width / 2
    })
  )
  const minY = Math.min(
    ...placed.map(box => {
      const centerY = box.top + box.height / 2
      return rootCenterY + (centerY - rootCenterY) * spread - box.height / 2
    })
  )
  ordered.forEach((node, index) => {
    const element = elements[index]
    const box = placed[index]
    const centerX = box.left + box.width / 2
    const centerY = box.top + box.height / 2
    const left = rootCenterX + (centerX - rootCenterX) * spread - box.width / 2
    const top = rootCenterY + (centerY - rootCenterY) * spread - box.height / 2
    const shape = element.querySelector('.node-bkg')
    const label = element.querySelector('.mindmap-node-label') || element
    const shapeStyle = shape ? window.getComputedStyle(shape) : null
    const labelStyle = window.getComputedStyle(label)
    const fill = usableColor(shapeStyle && shapeStyle.fill)
    const textColor = usableColor(labelStyle.color) || '#333333'
    const isRoot = element.classList.contains('section-root') || index === 0
    Object.assign(node.data, {
      fillColor: fill,
      color: textColor,
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: isRoot ? 0 : 12,
      shape: isRoot ? 'circle' : 'roundedRectangle',
      fontSize: 16,
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
      customTextWidth: 200,
      paddingX: 10,
      paddingY: 6,
      lineColor: fill,
      lineWidth: 3,
      customLeft: Math.round(left - minX) + 1,
      customTop: Math.round(top - minY) + 1
    })
  })
  return tree
}

function svgUserPoint(svg, x, y) {
  const point = svg.createSVGPoint()
  point.x = x
  point.y = y
  const matrix = svg.getScreenCTM()
  if (!matrix) {
    return { x, y }
  }
  const local = point.matrixTransform(matrix.inverse())
  return { x: local.x, y: local.y }
}

function usableColor(value) {
  if (!value || value === 'none' || value === 'transparent') {
    return ''
  }
  return value
}

export function stringifyMermaidMindmap(root) {
  const lines = ['mindmap']
  const walk = (node, depth) => {
    const data = (node && node.data) || {}
    const shape = data.mermaidShape || (depth === 0 ? 'circle' : '')
    lines.push('  '.repeat(depth + 1) + mermaidLine(data.text, shape))
    const children = (node && node.children) || []
    children.forEach(child => walk(child, depth + 1))
  }
  walk(root || { data: { text: '' }, children: [] }, 0)
  return lines.join('\n') + '\n'
}

export function extractMermaidMindmap(reply) {
  const text = unwrapFence(reply).trim()
  if (!/mindmap\b/.test(text)) {
    throw fail('noMindmap')
  }
  return text
}

export function chatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (!trimmed) {
    return ''
  }
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed
  }
  return trimmed + '/chat/completions'
}

export function mindmapMessages(prompt) {
  return [
    {
      role: 'system',
      content:
        'You write Mermaid mindmap diagrams. Reply with one fenced mermaid code block and nothing else. Use the same language as the user. The diagram must start with the line "mindmap". Use indentation for hierarchy. Do not use other diagram types.'
    },
    {
      role: 'user',
      content: prompt
    }
  ]
}
