const path = require('path')
const webpack = require('webpack')
const isDev = process.env.NODE_ENV === 'development'
const isLibrary = process.env.NODE_ENV === 'library'

/**
 * 等价于 webpack-dynamic-public-path@1.0.8，但去掉了它 emit 阶段那句
 * `console.log('WebpackDynamicPublicPath: publicPath replaced.')`。
 * 行为完全一致：把产物里写死的 output.publicPath 换成全局变量，
 * 让客户端在运行时指定资源路径。
 *
 * webpack 5 用 processAssets + updateAsset 实现：直接改写
 * compilation.assets[file].source 不行，RawSource 在构造时就把内容缓存成
 * buffer，重写 source() 不会改变真正写盘的字节。
 */
class DynamicPublicPathPlugin {
  constructor(options) {
    this.options = options
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap('DynamicPublicPath', compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: 'DynamicPublicPath',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE
        },
        () => {
          const publicPath = compiler.options.output.publicPath || ''
          // webpack 生成代码时可能带也可能不带结尾斜杠，两种都认
          const placeholders = [`"${publicPath}/"`, `"${publicPath}"`]
          compilation.chunks.forEach(chunk => {
            chunk.files.forEach(file => {
              if (!/\.js$/.test(file)) {
                return
              }
              const asset = compilation.getAsset(file)
              if (!asset) {
                return
              }
              const code = asset.source.source().toString()
              const placeholder = placeholders.find(item => code.includes(item))
              if (!placeholder) {
                return
              }
              compilation.updateAsset(
                file,
                new webpack.sources.RawSource(
                  code.replace(placeholder, this.options.externalPublicPath)
                )
              )
            })
          })
        }
      )
    })
  }
}

/**
 * 生产构建里样式模块由 mini-css-extract 生成，默认只写 `export {}`，没有默认导出；
 * 而 vue-loader 15（每个 SFC 的 style 块）和 babel-plugin-component（element-ui 的
 * 按需样式）都用默认导入，webpack 5 因此逐条报
 * "export 'default' (imported as 'style0') was not found"（本项目 89 条）。
 *
 * defaultExport 是这个插件自己的选项，打开后它输出 `export {};export default {};`，
 * 导入方拿到空对象，警告从根上消失，样式产物与运行行为不变。
 * 选项必须在 loader 链装配完成后写，所以这里直接改 compiler.options。
 */
class CssDefaultExportPlugin {
  apply(compiler) {
    const patch = rule => {
      if (!rule) {
        return
      }
      const uses = []
      if (Array.isArray(rule.use)) {
        uses.push(...rule.use)
      } else if (rule.use) {
        uses.push(rule.use)
      }
      uses.forEach(use => {
        if (
          use &&
          typeof use.loader === 'string' &&
          use.loader.includes('mini-css-extract-plugin')
        ) {
          use.options = { ...(use.options || {}), defaultExport: true }
        }
      })
      if (Array.isArray(rule.oneOf)) {
        rule.oneOf.forEach(patch)
      }
      if (Array.isArray(rule.rules)) {
        rule.rules.forEach(patch)
      }
    }
    ;(compiler.options.module.rules || []).forEach(patch)
  }
}

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
        .use(DynamicPublicPathPlugin, [
          { externalPublicPath: 'window.externalPublicPath' }
        ])
    }
    // 生产构建里让样式模块带上默认导出，见 CssDefaultExportPlugin
    if (!isDev) {
      config.plugin('cssDefaultExport').use(CssDefaultExportPlugin)
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
      /**
       * webpack 5 不再自动注入 Node 内置模块的 polyfill。sax 里是
       * `try { require('stream').Stream } catch {}` 的写法，浏览器端根本用不到，
       * 这里给它一个空模块即可，省掉一条 Module not found 警告。
       */
      fallback: {
        stream: false
      },
      alias: {
        '@': path.resolve(__dirname, './src/'),
        // 页面直接使用仓库里的库源码，改 simple-mind-map 会立刻进到开发服务
        'simple-mind-map/src': path.resolve(
          __dirname,
          '../simple-mind-map/src'
        ),
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
     * webpack-dev-server 4 把它挪到了 client 选项下。
     */
    client: {
      progress: false
    },
    proxy: {
      '^/api/v3/': {
        target: 'http://ark.cn-beijing.volces.com',
        changeOrigin: true
      }
    }
  }
}
