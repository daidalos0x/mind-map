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

const child = spawn('npm', ['run', 'serve'], {
  cwd: webDir,
  env: {
    ...process.env,
    NODE_OPTIONS: '--openssl-legacy-provider'
  },
  stdio: 'inherit'
})

child.on('exit', code => {
  process.exit(code ?? 1)
})
