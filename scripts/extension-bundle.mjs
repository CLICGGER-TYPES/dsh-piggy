// 生成扩展包 ext-<key>-<版本>.piggyext（一个 JSON，装着扩展的三个文件和图片），发版时跟三个文件一起传到发布页，
// 给下载不了附件的人从别处拿到后在「设置 → 扩展 → 从文件导入」装。
// 用法：node scripts/extension-bundle.mjs farm [输出目录]     （默认输出到 dist/）
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BUNDLE_FILES, makeBundle } from '../store/ext-import.js'
import { assetNames } from '../store/ext-files.js'

const key = process.argv[2]
if (!key) { console.error('usage: extension-bundle.mjs <key> [outDir]'); process.exit(1) }
const outDir = process.argv[3] ?? 'dist'
const dir = new URL(`../extensions/${key}/`, import.meta.url)
/** @type {Record<string, string|Buffer>} */
const files = Object.fromEntries(BUNDLE_FILES.map(name => [name, readFileSync(new URL(name, dir), 'utf8')]))
const manifest = JSON.parse(String(files['manifest.json']))
for (const name of assetNames(manifest) ?? []) files['assets/' + name] = readFileSync(new URL('assets/' + name, dir))
const version = manifest.version
mkdirSync(outDir, { recursive: true })
const out = join(outDir, `ext-${key}-${version}.piggyext`)
writeFileSync(out, makeBundle(files))
console.log(out)
