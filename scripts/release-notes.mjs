// 从 CHANGELOG.md 抽出某个版本的全部小节，当 GitHub Release 的说明。
// 用法：node scripts/release-notes.mjs 0.25.1 > notes.md
// 同一版本可能有多个小节（「## [0.25.0] — 日期 · 主题」），全部按原顺序收进来。
import { readFileSync } from 'node:fs'

const version = (process.argv[2] ?? '').replace(/^v/, '')
if (!version) { console.error('usage: release-notes.mjs <version>'); process.exit(1) }
const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split('\n')
const out = []
let keep = false
for (const line of lines) {
  if (line.startsWith('## ')) {
    keep = line.startsWith(`## [${version}]`)
    // 小节标题降一级，并去掉重复的版本号前缀，Release 页面上读起来更顺
    if (keep) out.push('### ' + line.replace(/^## \[[^\]]+\]\s*—?\s*/, '').replace(/^[\d-]+\s*·\s*—?\s*/, '').trim())
    continue
  }
  if (keep) out.push(line.replace(/^### /, '#### '))
}
const body = out.join('\n').trim()
if (!body) { console.error(`CHANGELOG 里没有 ${version} 的小节`); process.exit(1) }
// 贡献者要用纯文本 @名字，GitHub 才会在发布页底部列出头像；CHANGELOG 里写的是 [@名字](链接)，这里补一行（用户 2026-10-09：0.34.0 漏了 @tetezi）。
const people = [...new Set([...body.matchAll(/\(https:\/\/github\.com\/([A-Za-z0-9-]+)\)/g)].map(match => match[1]))]
  .filter(login => login !== 'CLICGGER-TYPES')
console.log(people.length > 0 ? `${body}\n\n感谢贡献者：${people.map(login => '@' + login).join(' ')}` : body)
