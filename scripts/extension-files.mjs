// 读 extensions/<key>/ 下一个扩展的全部文件（代码三件 + manifest 里列的图片 + 素材包），打包脚本、目录条目脚本和测试共用。
import { readFileSync, readdirSync } from 'node:fs'
import { BUNDLE_FILES } from '../store/ext-import.js'
import { assetNames, isAssetPackFile } from '../store/ext-files.js'
import { declaredAssetPacks } from '../store/ext-asset-packs.js'

/** @param {string} key @param {URL} [root] @returns {Record<string, string|Buffer>} */
export function extensionFiles(key, root = new URL('../extensions/', import.meta.url)) {
  const dir = new URL(`${key}/`, root)
  /** @type {Record<string, string|Buffer>} */
  const files = Object.fromEntries(BUNDLE_FILES.map(name => [name, readFileSync(new URL(name, dir), 'utf8')]))
  const manifest = JSON.parse(String(files['manifest.json']))
  const names = assetNames(manifest)
  // 名单写坏（名字不合规、重复）时 assetNames 返回 null：必须停下来，
  // 不能让打包脚本「成功」发出一个一张图都没有的包、目录条目也漏掉全部图片。
  if (names === null) throw new Error(`${key}/manifest.json 的 assets 名单不对（名字只许小写字母、数字、横线加 .webp/.png，不许重复）`)
  for (const name of names) files['assets/' + name] = readFileSync(new URL('assets/' + name, dir))
  const packs = declaredAssetPacks(manifest)
  if (packs.problems.length > 0) throw new Error(`${key}/manifest.json 的素材包声明不对：${packs.problems.join('；')}`)
  /** @param {string} relative */
  const add = relative => {
    if (!isAssetPackFile(relative)) throw new Error(`${key}/${relative} 不是允许的素材包文件`)
    files[relative] = readFileSync(new URL(relative, dir))
  }
  for (const kind of ['actions', 'sounds']) {
    for (const pack of packs[kind]) {
      const base = `${kind}/${pack}/`
      add(base + 'pack.json')
      const entries = readdirSync(new URL(base, dir), { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === 'pack.json' || entry.name === 'PROVENANCE.md') continue
        if (entry.isDirectory() && kind === 'actions') {
          for (const frame of readdirSync(new URL(base + entry.name + '/', dir))) add(base + entry.name + '/' + frame)
        } else if (entry.isFile() && kind === 'sounds') {
          add(base + entry.name)
        } else {
          throw new Error(`${key}/${base}${entry.name} 不是允许的素材包文件`)
        }
      }
    }
  }
  return files
}
