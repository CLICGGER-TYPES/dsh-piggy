// 读 extensions/<key>/ 下一个扩展的全部文件（代码三件 + manifest 里列的图片），打包脚本、目录条目脚本和测试共用。
import { readFileSync } from 'node:fs'
import { BUNDLE_FILES } from '../store/ext-import.js'
import { assetNames } from '../store/ext-files.js'

/** @param {string} key @returns {Record<string, string|Buffer>} */
export function extensionFiles(key) {
  const dir = new URL(`../extensions/${key}/`, import.meta.url)
  /** @type {Record<string, string|Buffer>} */
  const files = Object.fromEntries(BUNDLE_FILES.map(name => [name, readFileSync(new URL(name, dir), 'utf8')]))
  for (const name of assetNames(JSON.parse(String(files['manifest.json']))) ?? []) files['assets/' + name] = readFileSync(new URL('assets/' + name, dir))
  return files
}
