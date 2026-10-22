const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const src = path.join(root, 'dist/index.html')
const dest = path.join(root, 'index.html')

if (fs.existsSync(dest)) {
  fs.unlinkSync(dest)
}

if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest)
  fs.unlinkSync(src)
}
