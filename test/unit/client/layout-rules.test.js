// @ts-check
/**
 * 布局门禁：把 tools/layout-audit.mjs 的最小内边距/间距口径接进 npm test。
 * 完整审计仍按 docs/guides/layout-audit.md 连真实 CDP 页面跑；这里守 CSS 静态可查的部分。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { MIN_CONTROL_GAP, MIN_TEXT_PADDING } from '../../../tools/layout-metrics.mjs'
import { lintCssText, cssFiles, lintLayout, readBaseline } from '../../../tools/layout-lint.mjs'

const fingerprint = item => item.file + '|' + item.selector + '|' + item.metric

test('布局门禁：阈值不能低于审计口径', () => {
  // 数值来自 tools/layout-image-audit.mjs 的素材内边距 6/8px；改小等于掩盖违例。
  assert.equal(MIN_TEXT_PADDING, 6)
  assert.equal(MIN_CONTROL_GAP, 4)
})

test('布局门禁：基线覆盖当前全部违例，且没有新增', () => {
  const baseline = readBaseline()
  assert.ok(Array.isArray(baseline.violations), '基线文件缺失或格式不对：node tools/layout-lint.mjs --write-baseline')
  assert.equal(baseline.count, baseline.violations.length)
  assert.equal(baseline.thresholds.MIN_TEXT_PADDING, MIN_TEXT_PADDING)
  assert.equal(baseline.thresholds.MIN_CONTROL_GAP, MIN_CONTROL_GAP)
  const known = new Set(baseline.violations.map(fingerprint))
  const current = lintLayout()
  const added = current.filter(item => !known.has(fingerprint(item)))
  assert.deepEqual(added, [], '新增了内边距/间距违例；修布局或说明原因后更新基线：' + added.map(fingerprint).join(', '))
  const currentKeys = new Set(current.map(fingerprint))
  const fixed = baseline.violations.filter(item => !currentKeys.has(fingerprint(item)))
  if (fixed.length > 0) {
    console.log('布局门禁：基线里 ' + fixed.length + ' 条已经修复，可以重新生成基线：' + fixed.map(fingerprint).join(', '))
  }
})

test('布局门禁：检查范围覆盖核心样式和下载扩展', () => {
  const files = cssFiles()
  assert.ok(files.includes('src/client/css-base.js'))
  assert.ok(files.some(file => file.startsWith('src/extensions/roulette/')))
  assert.ok(files.length > 10)
})

test('布局门禁：新写的紧凑控件会被抓到', () => {
  const sample = [
    "'.rt-demo{display:inline-flex;padding:2px 8px;background:#fff;border:1px solid #ccc;cursor:pointer}'",
    "'.rt-demo-actions{display:flex;gap:2px}'",
  ].join('\n')
  const found = lintCssText(sample, 'sample.js')
  assert.deepEqual(found.map(item => item.metric).sort(), ['gap', 'padding-bottom', 'padding-top'])
  // 只补横向 padding 的子规则不误伤。
  assert.deepEqual(lintCssText("'.rt-demo{padding:0 8px}'", 'sample.js'), [])
})
