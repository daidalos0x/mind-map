import http from 'http'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const desktopDir = path.dirname(fileURLToPath(import.meta.url))
const webDir = path.resolve(desktopDir, '../web')

function webIsUp() {
  return new Promise(resolve => {
    const request = http.get('http://127.0.0.1:8080', response => {
      response.resume()
      resolve(true)
    })
    request.on('error', () => resolve(false))
    request.setTimeout(1000, () => {
      request.destroy()
      resolve(false)
    })
  })
}

if (await webIsUp()) {
  process.exit(0)
}

// Windows 上可执行文件是 npm.cmd，Node 18+ 不再自动补扩展名，需要显式交给 shell
const isWindows = process.platform === 'win32'
const child = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'serve'], {
  cwd: webDir,
  env: process.env,
  stdio: 'inherit',
  shell: isWindows
})

child.on('error', error => {
  console.error(error)
  process.exit(1)
})

child.on('exit', code => {
  process.exit(code ?? 1)
})
