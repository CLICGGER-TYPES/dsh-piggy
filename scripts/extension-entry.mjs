// 生成在线扩展目录（extensions/registry.json）里的一条：读扩展的 manifest，算每个文件的 sha256，
// 地址指向本仓库的发行版「ext-<key>-<版本>」：默认 GitHub，加 --host gitee 指向 Gitee（写进 extensions/registry-gitee.json）。
// 用法：node scripts/extension-entry.mjs blindbox [--host gitee]   → 打印这一条（JSON）
// 发布步骤见 docs/guides/writing-extensions.md「发版」和 docs/HANDOFF.md 9.3。
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { CHANNEL as GITHUB } from '../channels/github.js'
import { CHANNEL as GITEE } from '../channels/gitee.js'

const key = process.argv[2]
const host = process.argv.includes('--host') ? process.argv[process.argv.indexOf('--host') + 1] : 'github'
if (!key || !['github', 'gitee'].includes(host)) { console.error('usage: extension-entry.mjs <key> [--host github|gitee]'); process.exit(1) }
const base = (host === 'gitee' ? GITEE : GITHUB).downloadBase
const dir = new URL(`../extensions/${key}/`, import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'))
const tag = `ext-${key}-${manifest.version}`
const files = {}
for (const name of ['manifest.json', 'server.js', 'client.js']) {
  const buffer = readFileSync(new URL(name, dir))
  files[name] = {
    url: `${base}/${tag}/${name}`,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  }
}
const { app, ...rest } = manifest
console.log(JSON.stringify({ ...rest, files }, null, 2))
