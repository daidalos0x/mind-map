const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const src = path.join(root, 'dist/index.html')
const dest = path.join(root, 'index.html')

if (fs.existsSync(dest)) {
  fs.unlinkSync(dest)
}

if (fs.existsSync(src)) {
  // 产物里的资源引用是相对产物根的（./js/app.js），而 index.html 会被提到仓库根目录，
  // 真正的位置是 dist/js/app.js，所以复制时补上 dist/ 前缀。
  const html = fs
    .readFileSync(src, 'utf8')
    .replace(/(src|href)="\.\/(js|css|img|fonts)\//g, '$1="./dist/$2/')
    .replace(/(src|href)="\.\/(logo\.ico)"/g, '$1="./dist/$2"')
  fs.writeFileSync(dest, html)
  fs.unlinkSync(src)
}
