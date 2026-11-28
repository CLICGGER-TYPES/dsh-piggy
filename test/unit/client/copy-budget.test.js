// @ts-check
/** 文案预算：左轮轮盘所有可渲染界面的单条中文字不超过 18。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { MAX_COPY_CJK, cjkCount, collectCopy, violationsOf } from '../../helpers/copy-budget.js'

test('文案预算：单条中文字不超过 18', async () => {
  const rows = await collectCopy()
  assert.ok(rows.length > 100, '至少要把牌桌和联机大厅的主要状态都走一遍')
  const violations = violationsOf(rows)
  assert.deepEqual(violations, [], '超预算文案：' + violations.map(row => row.page + ' ' + row.cjk + '字「' + row.text + '」').join('；'))
  for (const row of rows) assert.ok(row.cjk <= MAX_COPY_CJK)
})

test('文案预算：阈值和中文计数口径固定', () => {
  assert.equal(MAX_COPY_CJK, 18)
  assert.equal(cjkCount('联机 1v1 只支持两人'), 7)
  assert.equal(cjkCount('AI 对战'), 2)
  assert.equal(cjkCount('v0.2.3'), 0)
})
