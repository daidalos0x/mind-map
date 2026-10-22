/**
 * OpenSSL 3（Node 17+）移除了 md4 算法，而 webpack 4 与 terser-webpack-plugin 1.x
 * 仍然硬编码 crypto.createHash('md4')，生产构建会直接抛：
 *
 *   Error: error:0308010C:digital envelope routines::unsupported
 *
 * 常见做法是设 NODE_OPTIONS=--openssl-legacy-provider，但那需要每个调用方都记得加，
 * 而且在 Node 16 以下反而会报错。这里改成在构建进程启动早期把 md4 透明替换为 sha256：
 *
 * - 只有在当前 Node 确实不支持 md4 时才生效，旧版本行为完全不变；
 * - 覆盖 webpack 自身（HashedModuleIdsPlugin 等）和 terser 的缓存 key 计算；
 * - 产物内容不受影响，只是内部 hash 算法变了。
 *
 * 引入位置必须是 vue.config.js 的最顶部，早于 webpack 及其插件的加载。
 */
const crypto = require('crypto')

let md4Supported = true
try {
  crypto.createHash('md4')
} catch (error) {
  md4Supported = false
}

if (!md4Supported) {
  const originalCreateHash = crypto.createHash
  crypto.createHash = function createHash(algorithm, options) {
    const name = String(algorithm).toLowerCase()
    return originalCreateHash.call(this, name === 'md4' ? 'sha256' : algorithm, options)
  }
}
