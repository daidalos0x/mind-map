const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const src = path.join(root, 'dist/index.html')
const dest = path.join(root, 'index.html')

if (fs.existsSync(dest)) {
  fs.unlinkSync(dest)
}

if (fs.existsSync(src)) {
  // favicon 按内容哈希命名：换了图标，URL 跟着变，浏览器不会再复用旧缓存
  const iconSrc = path.join(root, 'dist/logo.ico')
  let iconHref = './dist/logo.ico'
  if (fs.existsSync(iconSrc)) {
    const hash = crypto
      .createHash('sha1')
      .update(fs.readFileSync(iconSrc))
      .digest('hex')
      .slice(0, 8)
    const iconName = `logo.${hash}.ico`
    fs.renameSync(iconSrc, path.join(root, 'dist', iconName))
    iconHref = `./dist/${iconName}`
  }

  // 产物里的资源引用是相对产物根的（./js/app.js），而 index.html 会被提到仓库根目录，
  // 真正的位置是 dist/js/app.js，所以复制时补上 dist/ 前缀。
  const html = fs
    .readFileSync(src, 'utf8')
    .replace(/(src|href)="\.\/(js|css|img|fonts)\//g, '$1="./dist/$2/')
    .replace(/(src|href)="\.\/(logo\.ico)(\?[^"]*)?"/g, `$1="${iconHref}"`)
  fs.writeFileSync(dest, html)
  fs.unlinkSync(src)
}
