// @ts-check
/**
 * 发布说明（scripts/release-notes.mjs）：正文之后要有「本版贡献者」段，
 * 由该版本 CHANGELOG 链接、提交作者与 merge PR 作者推导，不依赖 GitHub 自动生成的 compare 区间。
 * 维护者自己不算外部贡献；没有外部贡献时明确写一句。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const notes = version => execFileSync(process.execPath, [fileURLToPath(new URL('../../scripts/release-notes.mjs', import.meta.url)), version], { encoding: 'utf8' })
const contributorSection = text => text.slice(text.lastIndexOf('### 本版贡献者'))

test('release notes end with a contributor section', () => {
  const rc5 = notes('0.37.3-rc.5')
  assert.match(contributorSection(rc5), /- @WolalaQAQ（#144）/)
  assert.ok(!/@CLICGGER-TYPES|@clicgger/.test(contributorSection(rc5)), 'the maintainer is not listed as a contributor')

  assert.match(contributorSection(notes('0.37.3-rc.6')), /本版无外部贡献者/)
  assert.match(contributorSection(notes('0.34.0')), /- @tetezi/)
})
