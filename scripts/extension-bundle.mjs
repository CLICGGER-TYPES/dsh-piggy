// 生成扩展包 ext-<key>-<版本>.piggyext（一个 JSON，装着扩展的三个文件和图片），发版时传到发布页。
// 0.36.1 起在线安装只下这一个文件（目录条目的 bundle 字段）；下载不了的人也可以拿到后在「设置 → 扩展 → 从文件导入」装。
// 用法：node scripts/extension-bundle.mjs farm [输出目录]     （默认输出到 dist/）
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeBundle } from '../store/ext-import.js'
import { extensionFiles } from './extension-files.mjs'

const key = process.argv[2]
if (!key) { console.error('usage: extension-bundle.mjs <key> [outDir]'); process.exit(1) }
const outDir = process.argv[3] ?? 'dist'
const files = extensionFiles(key)
const version = JSON.parse(String(files['manifest.json'])).version
mkdirSync(outDir, { recursive: true })
const out = join(outDir, `ext-${key}-${version}.piggyext`)
writeFileSync(out, makeBundle(files))
console.log(out)
