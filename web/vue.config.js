// 必须最先引入：给 OpenSSL 3 补上 md4，早于 webpack / terser 加载
require('./build/md4-fallback')

const path = require('path')
const isDev = process.env.NODE_ENV === 'development'
const isLibrary = process.env.NODE_ENV === 'library'

const WebpackDynamicPublicPathPlugin = require('webpack-dynamic-public-path')

module.exports = {
  publicPath: isDev ? '' : './dist',
  outputDir: '../dist',
  lintOnSave: false,
  productionSourceMap: false,
  filenameHashing: false,
  transpileDependencies: ['yjs', 'lib0', 'quill'],
  chainWebpack: config => {
    // 移除 preload 插件
    config.plugins.delete('preload')
    // 移除 prefetch 插件
    config.plugins.delete('prefetch')
    // 支持运行时设置public path
    if (!isDev) {
      config
        .plugin('dynamicPublicPathPlugin')
        .use(WebpackDynamicPublicPathPlugin, [
          { externalPublicPath: 'window.externalPublicPath' }
        ])
    }
    // 给插入html页面内的js和css添加hash参数
    if (!isLibrary) {
      config.plugin('html').tap(args => {
        args[0].hash = true
        return args
      })
    }
  },
  configureWebpack: {
    // 用 sha256 替代 webpack 4 默认的 md4，避免依赖 --openssl-legacy-provider
    output: {
      hashFunction: 'sha256'
    },
    /**
     * webpack 默认的 244KiB 预算是给普通网页的，对一个内嵌整个思维导图引擎的编辑器
     * 并不适用。这里按**生产构建**的实测基线设定预算：
     *   入口（app + vendors + css）≈ 0.95MiB
     *   编辑器核心 chunk           ≈ 2.25MiB
     *   mermaid 按需 chunk         ≈ 3.19MiB（只有开启 Mermaid 时才下载）
     *
     * 开发服务器和库构建产出的都是未压缩代码（体积是生产的好几倍），拿生产预算去卡
     * 它们只会每次重编译都刷一屏告警，所以只在生产构建里启用。
     */
    performance:
      isDev || isLibrary
        ? { hints: false }
        : {
            hints: 'warning',
            maxEntrypointSize: 1.5 * 1024 * 1024,
            maxAssetSize: 3.5 * 1024 * 1024
          },
    module: {
      noParse: /[\\/]mermaid[\\/]dist[\\/]mermaid\.min\.js$/
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src/'),
        // 页面直接使用仓库里的库源码，改 simple-mind-map 会立刻进到开发服务
        'simple-mind-map/src': path.resolve(__dirname, '../simple-mind-map/src'),
        'simple-mind-map/example': path.resolve(
          __dirname,
          '../simple-mind-map/example'
        )
      },
      modules: [path.resolve(__dirname, 'node_modules'), 'node_modules']
    }
  },
  devServer: {
    /**
     * 关闭 webpack 的进度输出。它会把正在编译的模块路径整行打印出来，
     * 长路径（例如 assets/img/图片加载失败.svg）会被截断成
     * "...web/src/assets/img/图片加载失"，看起来像在报错。
     */
    progress: false,
    proxy: {
      '^/api/v3/': {
        target: 'http://ark.cn-beijing.volces.com',
        changeOrigin: true
      }
    }
  }
}
