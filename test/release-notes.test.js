// @ts-check
/**
 * 发布说明（scripts/release-notes.mjs）：CHANGELOG 里写的贡献者链接要变成纯文本 @名字，
 * GitHub 才会在发布页列出头像（用户 2026-10-09：v0.34.0 的发布页漏了 @tetezi）。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'

const notes = version => execFileSync(process.execPath, [new URL('../scripts/release-notes.mjs', import.meta.url).pathname, version], { encoding: 'utf8' })

test('release notes end with plain @mentions of the contributors named in that version', () => {
  assert.match(notes('0.34.0'), /感谢贡献者：@tetezi\s*$/)
  assert.ok(!/@CLICGGER-TYPES/.test(notes('0.34.0').split('感谢贡献者')[1]), 'the maintainer is not thanked as a contributor')
})
