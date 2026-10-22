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
    proxy: {
      '^/api/v3/': {
        target: 'http://ark.cn-beijing.volces.com',
        changeOrigin: true
      }
    }
  }
}
