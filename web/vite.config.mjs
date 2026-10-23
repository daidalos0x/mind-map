import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import fs from 'fs'
import path from 'path'

// simple-mind-map 以源码形式引入（../simple-mind-map/src），而那个目录在仓库里没有
// node_modules，裸包名按默认规则解析不到。把引擎用到的第三方包显式指到 web/node_modules。
const ENGINE_DEPS = [
  '@svgdotjs/svg.js',
  'deepmerge',
  'eventemitter3',
  'jszip',
  'katex',
  'mdast-util-from-markdown',
  'pdf-lib',
  'parchment',
  'quill',
  'quill-delta',
  'uuid',
  'xml-js',
  'y-webrtc',
  'yjs'
]

const engineAlias = ENGINE_DEPS.filter(name => {
  const pkgDir = path.resolve(__dirname, 'node_modules', name)
  if (!fs.existsSync(pkgDir)) {
    throw new Error(`缺少引擎依赖 ${name}，请先在 web 下安装`)
  }
  return true
}).map(name => ({
  find: name,
  replacement: path.resolve(__dirname, 'node_modules', name)
}))

/**
 * 产物目录结构沿用 webpack 时代：js/、css/、img/ 平铺在 dist 下，
 * index.html 由 scripts/copy.js 提到仓库根目录并把资源前缀补成 ./dist/。
 */
const buildOutput = {
  entryFileNames: 'js/[name].js',
  chunkFileNames: 'js/[name].js',
  assetFileNames: assetInfo => {
    const name = assetInfo.names?.[0] || assetInfo.name || ''
    if (name.endsWith('.css')) {
      return 'css/[name][extname]'
    }
    // index.html 也算 asset，不处理会被塞进 img/ 目录
    if (name.endsWith('.html')) {
      return '[name][extname]'
    }
    if (/\.(woff2?|ttf|eot|svg|png|jpe?g|gif|webp|ico)$/.test(name)) {
      return 'img/[name][extname]'
    }
    return 'js/[name][extname]'
  }
}

export default defineConfig(({ command }) => ({
  // 页面最终被 copy.js 提到仓库根目录，资源留在 dist/ 下
  base: command === 'build' ? './' : '/',
  plugins: [
    vue(),
    // 模板里的 el-* 按需引入：只打包用到的组件和它们各自的样式，
    // 不再整包引入 element-plus（整包 CSS 有 405KB）
    Components({
      dts: false,
      resolvers: [ElementPlusResolver({ importStyle: 'css' })]
    })
  ],
  resolve: {
    alias: [
      ...engineAlias,
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      // sax 只在 Node 下才用 stream，构建期给它一个空模块，避免 "externalized for browser" 提示
      {
        find: /^stream$/,
        replacement: path.resolve(__dirname, 'build/empty-module.js')
      },
      {
        find: 'simple-mind-map/src',
        replacement: path.resolve(__dirname, '../simple-mind-map/src')
      },
      {
        find: 'simple-mind-map/example',
        replacement: path.resolve(__dirname, '../simple-mind-map/example')
      }
    ]
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      command === 'build' ? 'production' : 'development'
    )
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true
      }
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: 'js',
    sourcemap: false,
    cssCodeSplit: true,
    /**
     * mermaid 自带的构建产物就有 3.3MB，是这里最大的单块，属于已知上限
     * （webpack 时代也是按 3.5MB 设的预算）。把阈值调到实际基线，
     * 免得每次构建都拿一条跟代码无关的提示刷屏。
     */
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      output: buildOutput
    }
  },
  server: {
    port: 8080,
    proxy: {
      '^/api/v3/': {
        target: 'http://ark.cn-beijing.volces.com',
        changeOrigin: true
      }
    }
  }
}))
