// @ts-check
/**
 * 文档里的相对链接都要能打开（2026-10-09 整理文档挪了一批文件，以后再挪也靠这个兜底）。
 * 只查仓库里的 .md；外链（http、mailto）和页内锚点不查。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

test('relative links in tracked markdown files point at files that exist', () => {
  const docs = execFileSync('git', ['ls-files', '*.md'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
  const broken = []
  for (const doc of docs) {
    const text = readFileSync(join(ROOT, doc), 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
    for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1].split('#')[0]
      if (target === '' || /^[a-z]+:/i.test(target) || target.startsWith('/')) continue
      const path = join(ROOT, dirname(doc), decodeURIComponent(target))
      if (!existsSync(path)) broken.push(`${doc} → ${match[1]}`)
    }
  }
  assert.deepEqual(broken, [])
})
