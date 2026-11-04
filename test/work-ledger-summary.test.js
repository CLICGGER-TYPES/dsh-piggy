// @ts-check
/** 来源聚合：只统计窗口内收据，不返回正文。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { summarizeWorkSources } from '../runtime/work-ledger-summary.js'

const NOW = 1_800_000_000_000
const DAY = 24 * 3600_000
const receipt = (source, id, at, type = 'turn') => ({ version: 1, source, id, type, at, disposition: 'applied' })

test('按来源聚合、按最近时间排序并统计类型', () => {
  const sources = summarizeWorkSources([
    receipt('dsh', '1', NOW - 1000, 'turn'),
    receipt('dsh', '2', NOW - 500, 'tool'),
    receipt('opencode', '1', NOW - 2000, 'turn'),
    receipt('opencode', '2', NOW - 100, 'turn'),
  ], { now: NOW })
  assert.deepEqual(sources.map(entry => entry.source), ['opencode', 'dsh'])
  assert.deepEqual(sources[0], { source: 'opencode', count: 2, lastAt: NOW - 100, types: { turn: 2 } })
  assert.deepEqual(sources[1], { source: 'dsh', count: 2, lastAt: NOW - 500, types: { turn: 1, tool: 1 } })
})

test('窗口外与损坏收据被跳过，limit 生效', () => {
  const list = [
    receipt('old', '1', NOW - 8 * DAY),
    receipt('a', '1', NOW - 1),
    { source: 'broken' },
    null,
    receipt('b', '1', NOW - 2),
    receipt('c', '1', NOW - 3),
  ]
  const sources = summarizeWorkSources(list, { now: NOW, windowMs: 7 * DAY, limit: 2 })
  assert.deepEqual(sources.map(entry => entry.source), ['a', 'b'])
})

test('空输入返回空数组', () => {
  assert.deepEqual(summarizeWorkSources([]), [])
  assert.deepEqual(summarizeWorkSources(null), [])
})
