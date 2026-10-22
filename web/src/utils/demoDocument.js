// 内置示例导图：首次打开网页时展示，方便直观了解思维导图的效果
const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"

const node = (text, children) => ({
  data: { text },
  children: children || []
})

const demoRoot = () =>
  node('Personal Knowledge Management', [
    node('Information Capture', [
      node('Reading Material', [
        node('Books and Ebooks'),
        node('Articles and Blogs'),
        node('Research Papers')
      ]),
      node('Idea Collection', [node('Fleeting Thoughts'), node('Voice Memos')])
    ]),
    node('Organization and Storage', [
      node('Zettelkasten Method', [
        node('Literature Notes'),
        node('Permanent Notes')
      ]),
      node('Structure and Links', [
        node('Bidirectional Links'),
        node('Tagging System'),
        node('Map of Content')
      ])
    ]),
    node('Deep Processing', [
      node('Feynman Technique', [
        node('Plain Language Summary'),
        node('Teaching Others')
      ]),
      node('Knowledge Integration', [
        node('Connecting Concepts'),
        node('Critical Thinking')
      ])
    ]),
    node('Value Output', [
      node('Content Creation', [
        node('Technical Blogs'),
        node('Open Source Projects')
      ]),
      node('Work Application', [node('Project Reviews'), node('Problem Solving')])
    ]),
    node('Tool Ecosystem', [
      node('Primary Note Taking', [
        node('Obsidian'),
        node('Logseq'),
        node('Notion')
      ]),
      node('Supplementary Tools', [
        node('Zotero Reference'),
        node('Readwise Highlights')
      ])
    ])
  ])

export const DEMO_NAME = '示例 · Personal Knowledge Management'

export function demoDocument() {
  return {
    layout: 'mindMap',
    root: demoRoot(),
    theme: {
      template: 'classic7',
      config: {
        root: { fontFamily: FONT_FAMILY },
        second: { fontFamily: FONT_FAMILY },
        node: { fontFamily: FONT_FAMILY }
      }
    },
    view: null,
    demo: true
  }
}
