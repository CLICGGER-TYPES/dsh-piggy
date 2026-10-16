// @ts-check
/**
 * Gitee 发行版小工具（CI 和手动发扩展用），令牌从环境变量 GITEE_TOKEN 读，不落盘。
 *   node scripts/gitee-release.mjs ensure <tag> [说明.md]   有就复用、没有就建，打印发行版 id
 *   node scripts/gitee-release.mjs upload <id> <文件>...     上传附件（先传新的，成功后删掉旧的同名附件）
 *   node scripts/gitee-release.mjs prune <保留的tag>          稳定版发布时清理旧游戏版安装包附件（游戏包留着，回退用）
 * 仓库默认 clicgger/dsh-piggy，可用 GITEE_REPO 改。Gitee 附件单个 ≤100MB、单仓库总量 ≤1GB。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const TOKEN = process.env.GITEE_TOKEN
const REPO = process.env.GITEE_REPO || 'clicgger/dsh-piggy'
const API = `https://gitee.com/api/v5/repos/${REPO}`
if (!TOKEN) { console.error('缺少环境变量 GITEE_TOKEN'); process.exit(2) }

/** @param {string} path @param {RequestInit} [init] */
async function call(path, init = {}) {
  const url = new URL(API + path)
  if (!(init.body instanceof FormData)) url.searchParams.set('access_token', TOKEN ?? '')
  // 海外 CI 连 Gitee 偶尔断线（ECONNABORTED）：网络错误和 5xx 重试 3 次。
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, init)
      const text = await res.text()
      if (res.status >= 500 && attempt < 4) throw new Error('retry ' + res.status)
      if (!res.ok) throw Object.assign(new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${text.slice(0, 300)}`), { fatal: true })
      return text ? JSON.parse(text) : null
    } catch (error) {
      if (/** @type {any} */ (error).fatal || attempt >= 4) throw error
      await new Promise(resolve => setTimeout(resolve, attempt * 5000))
    }
  }
}

async function releases() {
  const all = []
  for (let page = 1; page < 20; page += 1) {
    const batch = await call(`/releases?per_page=100&page=${page}&direction=desc`)
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
  }
  return all
}

/** @param {number|string} id */
const attachments = async id => (await call(`/releases/${id}/attach_files?per_page=100`)) ?? []

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'ensure') {
  const [tag, notesFile] = args
  const found = (await releases()).find(r => r.tag_name === tag)
  if (found) { console.log(found.id); process.exit(0) }
  const created = await call('/releases', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ access_token: TOKEN, tag_name: tag, name: tag, body: notesFile ? readFileSync(notesFile, 'utf8') : tag, prerelease: tag.includes('-'), target_commitish: 'main' }),
  })
  console.log(created.id)
} else if (cmd === 'upload') {
  const [id, ...files] = args
  const existing = await attachments(id)
  for (const file of files) {
    const name = basename(file)
    const stale = existing.filter(a => a.name === name)
    // 大文件从海外 CI 传到 Gitee 很慢：用 curl，30 分钟超时、失败重试 3 次（fetch 默认 5 分钟就放弃）。
    const out = execFileSync('curl', ['-sS', '--fail-with-body', '--max-time', '1800', '--retry', '3', '--retry-all-errors', '--retry-delay', '10',
      '-F', `access_token=${TOKEN}`, '-F', `file=@${file};filename=${name}`, `${API}/releases/${id}/attach_files`], { encoding: 'utf8', maxBuffer: 1 << 20 })
    console.log('uploaded', name, JSON.parse(out)?.size ?? '')
    // 新的传成功了再删旧的同名附件：中途断线也不会丢文件。
    for (const old of stale) await call(`/releases/${id}/attach_files/${old.id}`, { method: 'DELETE' })
  }
} else if (cmd === 'prune') {
  const [keep] = args
  if (!/^v\d+\.\d+\.\d+$/.test(keep ?? '')) {
    console.log('prune: skipped for prerelease or non-game release')
    process.exit(0)
  }
  const INSTALLER = /\.(exe|dmg|AppImage|blockmap|zip)$|^(latest|rc).*\.yml$/
  let freed = 0
  for (const release of await releases()) {
    if (release.tag_name === keep || !/^v\d/.test(release.tag_name)) continue
    for (const file of await attachments(release.id)) {
      if (!INSTALLER.test(file.name)) continue
      await call(`/releases/${release.id}/attach_files/${file.id}`, { method: 'DELETE' })
      freed += Number(file.size) || 0
      console.log('removed', release.tag_name, file.name)
    }
  }
  console.log(`prune: 释放约 ${(freed / 1048576).toFixed(1)}MB`)
} else {
  console.error('usage: gitee-release.mjs ensure|upload|prune ...')
  process.exit(2)
}
