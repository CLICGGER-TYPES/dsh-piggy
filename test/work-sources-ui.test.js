// @ts-check
/** 设置页「最近投递」只读列表：两个来源、空列表、失败隐藏和相对时间边界。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fakeDom, findByAttr, settle } from './helpers/bundle.js'
import { relativeTime, renderWorkSources, topTypes } from '../src/client/work-sources.js'

const NOW = 1_800_000_000_000

function setup(api) {
  const oldDocument = globalThis.document
  const oldNow = Date.now
  Date.now = () => NOW
  const dom = fakeDom()
  globalThis.document = dom.document
  const content = dom.document.createElement('div')
  const ui = {
    tab: 'settings',
    renderContent() {
      content.textContent = ''
      renderWorkSources(ui, content, api)
    },
  }
  ui.renderContent()
  return {
    dom, content, ui,
    restore() {
      globalThis.document = oldDocument
      Date.now = oldNow
    },
  }
}

test('两个来源各占一行：来源、相对时间、条数和最多两个主要类型', async () => {
  const api = async () => ({
    ok: true,
    sources: [
      { source: 'dsh', count: 42, lastAt: NOW - 30_000, types: { turn: 37, tool: 5, message: 0 } },
      { source: 'opencode', count: 3, lastAt: NOW - 2 * 86_400_000, types: { agentError: 1, turn: 2 } },
    ],
  })
  const s = setup(api)
  try {
    await settle()
    const block = findByAttr(s.content, 'data-work-sources', 'true')
    assert.ok(block, s.content.allText())
    assert.match(block.allText(), /最近投递/)
    const rows = s.content.querySelectorAll('.dp-work-source')
    assert.equal(rows.length, 2)

    const dsh = findByAttr(s.content, 'data-work-source', 'dsh')
    assert.match(dsh.allText(), /dsh/)
    assert.match(dsh.allText(), /刚刚/)
    assert.match(dsh.allText(), /42 条/)
    assert.match(dsh.allText(), /turn 37 · tool 5/)
    assert.doesNotMatch(dsh.allText(), /message 0/)

    const other = findByAttr(s.content, 'data-work-source', 'opencode')
    assert.match(other.allText(), /2 天前/)
    assert.match(other.allText(), /3 条/)
    assert.match(other.allText(), /turn 2 · agentError 1/)
  } finally { s.restore() }
})

test('空列表显示「还没有 agent 投递」，没有可点的操作', async () => {
  const s = setup(async () => ({ ok: true, sources: [] }))
  try {
    await settle()
    const block = findByAttr(s.content, 'data-work-sources', 'true')
    assert.ok(block)
    assert.match(block.allText(), /还没有 agent 投递/)
    assert.equal(s.content.querySelectorAll('.dp-work-source').length, 0)
    assert.equal(s.content.querySelectorAll('button').length, 0)
  } finally { s.restore() }
})

test('旧外壳或失败时整块隐藏，不显示错误文案', async () => {
  for (const api of [
    undefined,
    async () => ({ ok: false, sources: [{ source: 'dsh', count: 1, lastAt: NOW, types: { turn: 1 } }] }),
    async () => { throw new Error('worker closed') },
  ]) {
    const s = setup(api)
    try {
      await settle()
      assert.equal(findByAttr(s.content, 'data-work-sources', 'true'), undefined)
      assert.doesNotMatch(s.content.allText(), /最近投递|还没有 agent 投递|worker closed/)
    } finally { s.restore() }
  }
})

test('相对时间在分钟、小时、天的边界处切换', () => {
  assert.equal(relativeTime(NOW, NOW), '刚刚')
  assert.equal(relativeTime(NOW - 59_999, NOW), '刚刚')
  assert.equal(relativeTime(NOW - 60_000, NOW), '1 分钟前')
  assert.equal(relativeTime(NOW - 59 * 60_000 - 59_999, NOW), '59 分钟前')
  assert.equal(relativeTime(NOW - 60 * 60_000, NOW), '1 小时前')
  assert.equal(relativeTime(NOW - 23 * 3_600_000 - 59 * 60_000, NOW), '23 小时前')
  assert.equal(relativeTime(NOW - 24 * 3_600_000, NOW), '1 天前')
  assert.equal(relativeTime(NOW - 3 * 86_400_000, NOW), '3 天前')
  assert.equal(relativeTime(NOW + 5_000, NOW), '刚刚')
  assert.equal(relativeTime(NaN, NOW), '')
})

test('主要类型按条数排序，同数按名称，最多两个', () => {
  assert.deepEqual(topTypes({ tool: 5, turn: 37, message: 2 }), [['turn', 37], ['tool', 5]])
  assert.deepEqual(topTypes({ b: 2, a: 2, c: 9 }), [['c', 9], ['a', 2]])
  assert.deepEqual(topTypes({}), [])
})
