// 从 CHANGELOG.md 抽出某个版本的全部小节，当 GitHub Release 的说明。
// 用法：node scripts/release-notes.mjs 0.25.1 > notes.md
// 同一版本可能有多个小节（「## [0.25.0] — 日期 · 主题」），全部按原顺序收进来。
//
// 末尾的「本版贡献者」不依赖 GitHub 自动生成的 compare 区间：
//   - CHANGELOG 小节里链到的 GitHub 用户（issue/PR 作者）；
//   - 该 tag 相对上一个 v* 标签之间的提交作者（noreply 邮箱）与 merge 提交里的 PR 作者。
// 维护者自己不算外部贡献；没有外部贡献时明确写一句，避免发布页完全没人。
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const version = (process.argv[2] ?? '').replace(/^v/, '')
if (!version) { console.error('usage: release-notes.mjs <version>'); process.exit(1) }
const root = fileURLToPath(new URL('..', import.meta.url))
const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split('\n')
const out = []
let keep = false
for (const line of lines) {
  if (line.startsWith('## ')) {
    keep = line.startsWith(`## [${version}]`)
    if (keep) out.push('### ' + line.replace(/^## \[[^\]]+\]\s*—?\s*/, '').replace(/^[\d-]+\s*·\s*—?\s*/, '').trim())
    continue
  }
  if (keep) out.push(line.replace(/^### /, '#### '))
}
const body = out.join('\n').trim()
if (!body) { console.error(`CHANGELOG 里没有 ${version} 的小节`); process.exit(1) }

const MAINTAINERS = new Set(['clicgger', 'clicgger-types'])
const isMaintainer = login => MAINTAINERS.has(String(login).toLowerCase())
const people = new Map()
const add = (login, pr) => {
  if (typeof login !== 'string' || login === '' || isMaintainer(login)) return
  if (!people.has(login)) people.set(login, new Set())
  if (Number.isInteger(pr) && pr > 0) people.get(login).add(pr)
}

// CHANGELOG 里的 [@名字](https://github.com/名字) 链接；同一行里紧挨着的 #N 就是对应 PR。
for (const line of body.split('\n')) {
  for (const match of line.matchAll(/\[@([A-Za-z0-9-]+)\]\(https:\/\/github\.com\/\1\)/g)) {
    const before = line.slice(Math.max(0, match.index - 12), match.index)
    const after = line.slice(match.index + match[0].length, match.index + match[0].length + 32)
    const number = /#(\d+)[^#\n]{0,6}$/.exec(before)?.[1] ?? /^[^#\n]{0,24}#(\d+)/.exec(after)?.[1]
    add(match[1], number === undefined ? undefined : Number(number))
  }
}

// 上一个 v* 标签（必须是当前 tag 的祖先），只统计这一版新增的提交。
function previousTag(tag) {
  try {
    const tags = execFileSync('git', ['-C', root, 'tag', '--merged', tag, '--list', 'v[0-9]*', '--sort=-v:refname'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim().split('\n').filter(Boolean).filter(name => name !== tag)
    return tags[0] ?? null
  } catch { return null }
}
try {
  const tag = `v${version}`
  const previous = previousTag(tag)
  const range = previous === null ? tag : `${previous}..${tag}`
  const commits = execFileSync('git', ['-C', root, 'log', '--format=%an%x1f%ae%x1f%s', range], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .trim().split('\n').filter(Boolean)
  for (const line of commits) {
    const [name, email, subject] = line.split('\x1f')
    // 合并 PR：merge 提交里写着 PR 号和来源分支的 owner。
    const merge = /Merge pull request #(\d+) from ([^/\s]+)\//.exec(subject ?? '')
    if (merge !== null) add(merge[2], Number(merge[1]))
    // 提交作者：noreply 邮箱能直接还原 GitHub 登录名。
    const noreply = /^(?:\d+\+)?([A-Za-z0-9-]+)@users\.noreply\.github\.com$/i.exec(email ?? '')
    if (noreply !== null) add(noreply[1])
  }
} catch { /* 没有 git 历史（例如只解出 CHANGELOG）时退化为 CHANGELOG 链接 */ }

const section = ['### 本版贡献者', '']
if (people.size === 0) section.push('本版无外部贡献者（修复由维护者提交）。')
else {
  for (const [login, prs] of people) {
    const numbers = [...prs].sort((a, b) => a - b)
    section.push(`- @${login}${numbers.length > 0 ? '（' + numbers.map(n => '#' + n).join('、') + '）' : ''}`)
  }
}
console.log(`${body}\n\n${section.join('\n')}`)
