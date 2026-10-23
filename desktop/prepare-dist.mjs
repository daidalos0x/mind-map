import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const desktopDir = path.dirname(fileURLToPath(import.meta.url))
const repoDir = path.resolve(desktopDir, '..')
const webDir = path.join(repoDir, 'web')
const outputDir = path.join(repoDir, 'desktop-dist')

// Windows 上可执行文件是 npm.cmd，Node 18+ 不再自动补扩展名，需要显式交给 shell
const isWindows = process.platform === 'win32'
const NPM = isWindows ? 'npm.cmd' : 'npm'

function run(command, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit',
      shell: isWindows
    })
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited ${code}`))
      }
    })
  })
}

// md4 兼容由 web/build/md4-fallback.js 在构建进程内处理，不需要 NODE_OPTIONS
await run(NPM, ['run', 'build'], webDir, process.env)

fs.rmSync(outputDir, { recursive: true, force: true })
fs.mkdirSync(outputDir, { recursive: true })
fs.copyFileSync(
  path.join(repoDir, 'index.html'),
  path.join(outputDir, 'index.html')
)
fs.cpSync(path.join(repoDir, 'dist'), path.join(outputDir, 'dist'), {
  recursive: true
})
