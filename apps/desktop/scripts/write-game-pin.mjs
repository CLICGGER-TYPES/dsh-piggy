// @ts-check
/**
 * 给不带游戏的安装包（Gitee 的 Windows 包）写 game-pin.json：配套的游戏版本、manifest 和下载地址。
 * 外壳第一次启动按它下载游戏（lib/versions.js installPinned）。下载地址按当前渠道（lib/channel.js）拼：
 *   <downloadBase>/v<版本>/<文件名>，整包一个、分卷按 manifest.parts 的顺序。
 *
 * 用法：node scripts/write-game-pin.mjs <release-game 的输出目录> <输出的 game-pin.json>
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CHANNEL } from '../lib/channel.js'

/**
 * @param {string} dir release-game 的输出目录
 * @param {string} downloadBase 发行版附件的下载前缀
 */
export function gamePin(dir, downloadBase) {
  const manifests = readdirSync(dir).filter(name => /^game-.+\.manifest\.json$/.test(name))
  if (manifests.length !== 1) throw new Error(`${dir} 里要正好有一个 game-*.manifest.json，现在 ${manifests.length} 个`)
  const manifest = JSON.parse(readFileSync(join(dir, manifests[0]), 'utf8'))
  const names = Array.isArray(manifest.parts) ? manifest.parts.map(part => part.name) : [`game-${manifest.version}.json.gz`]
  for (const name of names) readFileSync(join(dir, name))
  const urls = names.map(name => `${downloadBase}/v${manifest.version}/${name}`)
  return { version: manifest.version, manifest, urls }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, out] = process.argv.slice(2)
  if (!dir || !out) { console.error('用法：node scripts/write-game-pin.mjs <游戏包目录> <game-pin.json>'); process.exit(1) }
  const pin = gamePin(dir, CHANNEL.downloadBase)
  writeFileSync(out, JSON.stringify(pin, null, 2))
  console.log(JSON.stringify(pin))
}
