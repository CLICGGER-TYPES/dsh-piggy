// 运行日志（设置 → 日志 → 导出）：内存环形缓冲、落盘、和浏览器那半边的合并。
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createJournal } from '../../../store/journal.js'

function setup(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-journal-'))
  const journal = createJournal({ dir, now: () => 1_791_260_000_000, ...options })
  return { dir, journal, done: () => rmSync(dir, { recursive: true, force: true }) }
}

test('keeps only the newest entries and says how many rolled off', () => {
  const { journal, done } = setup({ limit: 3 })
  try {
    for (let i = 1; i <= 5; i += 1) journal.record('info', 'test', 'line ' + i)
    assert.deepEqual(journal.entries().map(entry => entry.message), ['line 3', 'line 4', 'line 5'])
    assert.match(journal.text(), /更早的 2 条已滚出内存/)
  } finally { done() }
})

test('the exported text leads with the environment and reads as one line per event', () => {
  const { journal, done } = setup()
  try {
    journal.header({ 游戏版本: '0.31.0', 发布渠道: 'github', 存档路径: '/tmp/state.json' })
    journal.record('warn', 'ext', 'extension download failed', { file: 'server.js', attempt: 2 })
    const text = journal.text()
    assert.match(text, /游戏版本： 0\.31\.0/)
    assert.match(text, /发布渠道： github/)
    assert.match(text, /存档路径： \/tmp\/state\.json/)
    assert.match(text, /WARN\s+ext\s+extension download failed\s+file="server\.js" attempt="2"/)
    assert.match(text, /共 2 条/)
  } finally { done() }
})

test('writes JSON lines next to the save and survives a missing directory', async () => {
  const { dir, journal, done } = setup()
  try {
    journal.record('error', 'save', '存档写入失败', { path: '/tmp/state.json' })
    await journal.flush()
    const lines = readFileSync(join(dir, 'logs', 'dsh-piggy.log'), 'utf8').trim().split('\n')
    assert.equal(lines.length, 1)
    const parsed = JSON.parse(lines[0])
    assert.equal(parsed.level, 'error')
    assert.equal(parsed.scope, 'save')
    assert.equal(parsed.message, '存档写入失败')
    assert.equal(parsed.fields.path, '/tmp/state.json')
  } finally { done() }
})

test('browser entries merge in once, with junk dropped', () => {
  const { journal, done } = setup()
  try {
    const added = journal.attachClient([
      { id: 'c1', at: 1, level: 'error', scope: 'client', message: 'uncaught: boom', fields: { line: 12 } },
      { id: 'c1', at: 1, level: 'error', scope: 'client', message: 'uncaught: boom' },
      { id: 'c2', at: 2, level: 'nonsense', message: 'no scope' },
      null,
      { message: '' },
      'not an object',
    ])
    assert.equal(added, 2, 'duplicate id and junk must not get in')
    assert.equal(journal.attachClient([{ id: 'c1', message: 'uncaught: boom' }]), 0)
    const entries = journal.entries()
    assert.equal(entries.length, 2)
    assert.equal(entries[0].scope, 'client')
    assert.equal(entries[1].level, 'info', 'unknown level falls back')
    assert.equal(entries[1].scope, 'client')
  } finally { done() }
})

test('entries are handed out in time order even when the browser was behind', () => {
  const { journal, done } = setup()
  try {
    journal.record('info', 'app', 'host line')
    journal.attachClient([{ id: 'c1', at: 1, level: 'warn', scope: 'client', message: 'older line' }])
    assert.deepEqual(journal.entries().map(entry => entry.message), ['host line', 'older line'])
    const text = journal.text()
    assert.ok(text.indexOf('older line') < text.indexOf('host line'), 'export sorts by time')
  } finally { done() }
})
