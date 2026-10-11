// 生成在线扩展目录（extensions/registry.json）里的一条：读扩展的 manifest，算整包和每个文件的 sha256，
// 地址指向本仓库的发行版「ext-<key>-<版本>」：默认 GitHub，加 --host gitee 指向 Gitee（写进 extensions/registry-gitee.json）。
// - bundle：整个扩展包 ext-<key>-<版本>.piggyext，0.36.1 起在线安装只下它（用户 2026-10-11：发行版别堆几十张图）。
// - files：逐个文件的地址，给 0.36.0 及更早的游戏用；认官方扩展也按它对。
// 用法：node scripts/extension-entry.mjs blindbox [--host gitee]   → 打印这一条（JSON）
// 发布步骤见 docs/guides/writing-extensions.md「发版」和 docs/HANDOFF.md 9.3。
import { createHash } from 'node:crypto'
import { CHANNEL as GITHUB } from '../channels/github.js'
import { CHANNEL as GITEE } from '../channels/gitee.js'
import { makeBundle } from '../store/ext-import.js'
import { assetNames, fileList } from '../store/ext-files.js'
import { extensionFiles } from './extension-files.mjs'

const key = process.argv[2]
const host = process.argv.includes('--host') ? process.argv[process.argv.indexOf('--host') + 1] : 'github'
if (!key || !['github', 'gitee'].includes(host)) { console.error('usage: extension-entry.mjs <key> [--host github|gitee]'); process.exit(1) }
const base = (host === 'gitee' ? GITEE : GITHUB).downloadBase
const contents = extensionFiles(key)
const manifest = JSON.parse(String(contents['manifest.json']))
const sha256 = body => createHash('sha256').update(body).digest('hex')
const tag = `ext-${key}-${manifest.version}`
const files = {}
// 图片在发行版里平铺（附件名不能带斜杠），在目录里记作 assets/<名字>。
for (const name of fileList(assetNames(manifest) ?? [])) {
  files[name] = { url: `${base}/${tag}/${name.replace(/^assets\//, '')}`, sha256: sha256(contents[name]) }
}
const { app, assets, ...rest } = manifest
const bundle = { url: `${base}/${tag}/${tag}.piggyext`, sha256: sha256(makeBundle(contents)) }
console.log(JSON.stringify({ ...rest, bundle, files }, null, 2))
