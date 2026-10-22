// 把发布 tag 的版本号写进各处清单，避免 tauri.conf / package.json / Cargo.toml 互相漂移。
// 用法：node scripts/sync-version.mjs 0.2.0  或  node scripts/sync-version.mjs v0.2.0
//
// 只做定点替换，不重新序列化 JSON —— 否则会把 ["app", "dmg"] 这类内联数组展开成多行，
// 在发布提交里制造一堆格式噪音。
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const raw = process.argv[2] || ''
const version = raw.replace(/^v/, '')

if (!/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`用法: node scripts/sync-version.mjs <x.y.z>（收到 "${raw}"）`)
  process.exit(1)
}

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const replaceOnce = (file, pattern, replacement) => {
  const full = path.join(repoDir, file)
  const source = fs.readFileSync(full, 'utf8')
  if (!pattern.test(source)) {
    throw new Error(`${file} 里没找到需要替换的版本字段`)
  }
  const next = source.replace(pattern, replacement)
  if (next !== source) {
    fs.writeFileSync(full, next)
    console.log(`  ${file} -> ${version}`)
  } else {
    console.log(`  ${file} 已经是 ${version}`)
  }
}

console.log(`同步版本到 ${version}：`)

// 顶层 version 字段（这两个 JSON 的 version 都在第一层，缩进 2 个空格）
replaceOnce('desktop/src-tauri/tauri.conf.json', /^ {2}"version": "[^"]*"/m, `  "version": "${version}"`)
replaceOnce('web/package.json', /^ {2}"version": "[^"]*"/m, `  "version": "${version}"`)

// Cargo.toml 只改 [package] 段里的第一个 version
const cargoPath = 'desktop/src-tauri/Cargo.toml'
const cargoFull = path.join(repoDir, cargoPath)
const cargo = fs.readFileSync(cargoFull, 'utf8')
const pkgIndex = cargo.indexOf('[package]')
if (pkgIndex === -1) {
  throw new Error(`${cargoPath} 里没有 [package] 段`)
}
const head = cargo.slice(0, pkgIndex)
const tail = cargo
  .slice(pkgIndex)
  .replace(/^version = "[^"]*"/m, `version = "${version}"`)
const nextCargo = head + tail
if (nextCargo !== cargo) {
  fs.writeFileSync(cargoFull, nextCargo)
  console.log(`  ${cargoPath} -> ${version}`)
} else {
  console.log(`  ${cargoPath} 已经是 ${version}`)
}

// 同一个版本号在 Cargo.lock 的根包条目里也有一份，不同步的话
// 下一次 --locked 构建会报 lock 需要更新
replaceOnce(
  'desktop/src-tauri/Cargo.lock',
  /(\[\[package\]\]\r?\nname = "mind-map-desktop"\r?\nversion = ")[^"]*(")/,
  `$1${version}$2`
)
