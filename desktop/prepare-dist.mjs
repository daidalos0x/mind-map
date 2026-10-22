import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const desktopDir = path.dirname(fileURLToPath(import.meta.url))
const repoDir = path.resolve(desktopDir, '..')
const webDir = path.join(repoDir, 'web')
const outputDir = path.join(repoDir, 'desktop-dist')

function run(command, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit'
    })
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
await run('npm', ['run', 'build'], webDir, process.env)

fs.rmSync(outputDir, { recursive: true, force: true })
fs.mkdirSync(outputDir, { recursive: true })
fs.copyFileSync(path.join(repoDir, 'index.html'), path.join(outputDir, 'index.html'))
fs.cpSync(path.join(repoDir, 'dist'), path.join(outputDir, 'dist'), {
  recursive: true
})
