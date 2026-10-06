import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createMeasure, reservedOutline, chooseCollapsedVertical, validOpenBox } from '../src/client/desktop/measure.js'

test('紧凑拖动不加收起面板的预留框，气泡预留区仍保留', () => {
  const content = { x: 20, y: 80, r: 90, b: 140 }
  const bubble = { x: 10, y: 10, r: 110, b: 80 }
  const saved = { l: -20, t: -400, r: 100, b: 60 }
  const pig = { x: 30, y: 90 }
  assert.deepEqual(reservedOutline([content, bubble], saved, pig, true), [content, bubble])
  assert.deepEqual(reservedOutline([content, bubble], saved, pig, false),
    [content, bubble, { x: 10, y: -310, r: 130, b: 150 }])
})

test('松手按猪的屏幕位置选收起朝向：上方优先，否则下方，都不够则保持', () => {
  const boxes = {
    // 键里的数字是「猪宽 ÷ 4」那一档（60px → 15）：更新改了立绘/字体时差一两像素不算变，
    // 否则整条记录作废，收起态不再预留面板，「更新后第一次右键」就成了第一次真的改窗口。
    'bottom|right|15': { l: -200, t: -420, r: 60, b: 60 },
    'top|right|15': { l: -200, t: -100, r: 60, b: 460 },
  }
  const area = { x: 0, y: 100, width: 1200, height: 800 }
  assert.equal(chooseCollapsedVertical(boxes, 'right', 60, 54, 600, area, 'top'), 'bottom')
  assert.equal(chooseCollapsedVertical(boxes, 'right', 60, 54, 150, area, 'bottom'), 'top')
  assert.equal(chooseCollapsedVertical(boxes, 'right', 60, 54, 450, area, 'bottom'), 'bottom')
  assert.equal(chooseCollapsedVertical({}, 'right', 60, 54, 600, area, 'top'), 'top')
})

test('旧存档里 top 名下的面板在上数据无效，不能据此选朝向或撑大收起窗口', () => {
  const wrong = { l: -232, t: -594, r: 60, b: 66 }
  const boxes = { 'top|right|14': wrong, 'bottom|right|14': { ...wrong } }
  const pig = { x: 250, y: 610, width: 54, height: 54 }
  const area = { x: 0, y: 0, width: 1920, height: 1080 }
  assert.equal(validOpenBox(boxes, 'top', 'right', pig), undefined)
  assert.deepEqual(validOpenBox(boxes, 'bottom', 'right', pig), wrong)
  assert.equal(chooseCollapsedVertical(boxes, 'right', 54, 54, 50, area, 'bottom'), 'bottom')
  assert.equal(chooseCollapsedVertical(boxes, 'right', 54, 54, 50, area, 'top'), 'top')

  const oldStorage = globalThis.localStorage
  const oldDocument = globalThis.document
  const oldStyle = globalThis.getComputedStyle
  const memory = new Map([
    ['dsh-piggy:desktop-open-box', JSON.stringify(boxes)],
    ['dsh-piggy:desktop-sides', JSON.stringify({ vertical: 'top', horizontal: 'right' })],
  ])
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
  globalThis.document = { body: {} }
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1' })
  const pigNode = { offsetLeft: 250, offsetTop: 610, offsetWidth: 54, offsetHeight: 54, offsetParent: document.body,
    closest: () => null }
  const host = { offsetLeft: 0, offsetTop: 0, offsetWidth: 320, offsetHeight: 680, offsetParent: document.body,
    closest: () => null, getAttribute: key => key === 'data-open' ? 'false' : '',
    querySelectorAll: () => [pigNode], querySelector: key => key === '.dp-pig' ? pigNode : null }
  try {
    const dirty = createMeasure({ platform: 'linux', geometry: () => null }).boxes(host)
    memory.set('dsh-piggy:desktop-open-box', '{}')
    const clean = createMeasure({ platform: 'linux', geometry: () => null }).boxes(host)
    assert.deepEqual(dirty?.content, clean?.content)
  } finally {
    globalThis.localStorage = oldStorage
    globalThis.document = oldDocument
    globalThis.getComputedStyle = oldStyle
  }
})

test('打开面板第一轮按实际卡片位置存范围，不沿用上一次朝向', () => {
  const oldStorage = globalThis.localStorage
  const oldDocument = globalThis.document
  const oldStyle = globalThis.getComputedStyle
  const memory = new Map([['dsh-piggy:desktop-sides', JSON.stringify({ vertical: 'top', horizontal: 'right' })]])
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
  globalThis.document = { body: {} }
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1' })
  const pig = { offsetLeft: 250, offsetTop: 610, offsetWidth: 54, offsetHeight: 54, offsetParent: document.body,
    hidden: false, closest: () => null }
  const card = { offsetLeft: 0, offsetTop: 0, offsetWidth: 300, offsetHeight: 570, offsetParent: document.body,
    hidden: false, style: { maxHeight: '570px' }, closest: key => key === '.dp-card' ? card : null }
  const host = { offsetLeft: 0, offsetTop: 0, offsetWidth: 320, offsetHeight: 680, offsetParent: document.body,
    closest: () => null, getAttribute: key => key === 'data-open' ? 'true' : '',
    querySelectorAll: () => [card, pig], querySelector: key => key === '.dp-pig' ? pig : key === '.dp-card' ? card : null }
  try {
    createMeasure({ platform: 'linux', geometry: () => null }).boxes(host)
    const stored = JSON.parse(memory.get('dsh-piggy:desktop-open-box'))
    assert.equal(stored.v, 2, '新写入要带存储版本')
    assert.ok(stored.boxes['bottom|right|14'], '猪宽按 4px 一档做 key（54px → 14）')
    assert.equal(stored.boxes['top|right|14'], undefined)
  } finally {
    globalThis.localStorage = oldStorage
    globalThis.document = oldDocument
    globalThis.getComputedStyle = oldStyle
  }
})

test('面板范围存储：认不出的版本直接丢掉，不让它撑大收起窗口', () => {
  const oldStorage = globalThis.localStorage
  const oldDocument = globalThis.document
  const oldStyle = globalThis.getComputedStyle
  // 未来版本（v99）写的东西：这一版读不懂，不能拿来撑窗口。
  const memory = new Map([['dsh-piggy:desktop-open-box', JSON.stringify({ v: 99, boxes: { 'bottom|right|14': { l: -232, t: -594, r: 60, b: 66 } } })]])
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
  globalThis.document = { body: {} }
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1' })
  const pig = { offsetLeft: 250, offsetTop: 610, offsetWidth: 54, offsetHeight: 54, offsetParent: document.body,
    hidden: false, closest: () => null }
  const host = { offsetLeft: 0, offsetTop: 0, offsetWidth: 320, offsetHeight: 680, offsetParent: document.body,
    closest: () => null, getAttribute: key => key === 'data-open' ? 'false' : '',
    querySelectorAll: () => [pig], querySelector: key => key === '.dp-pig' ? pig : null }
  try {
    const dirty = createMeasure({ platform: 'linux', geometry: () => null }).boxes(host)
    memory.set('dsh-piggy:desktop-open-box', JSON.stringify({ v: 2, boxes: {} }))
    const clean = createMeasure({ platform: 'linux', geometry: () => null }).boxes(host)
    assert.deepEqual(dirty.content, clean.content, '认不出的版本等同于没有：不能拿它撑大收起窗口')
  } finally {
    globalThis.localStorage = oldStorage
    globalThis.document = oldDocument
    globalThis.getComputedStyle = oldStyle
  }
})

test('测量不许改收起朝向（2026-10-07 窗口在两个几何之间反复横跳的回归）', () => {
  // 以前每量一次就重新挑「上/下哪个放得下」，放不下就翻朝向；翻完窗口挪了、猪的屏幕位置变了，
  // 下一轮又翻回来 —— 自激振荡，用户看到「猪瞬移到上面去再瞬移下来」。
  // 现在朝向只由用户动作改（拖动松手走 collapsedSide），测量只管按当前朝向挂预留区。
  const oldStorage = globalThis.localStorage
  const oldDocument = globalThis.document
  const oldStyle = globalThis.getComputedStyle
  const saved = { l: -232, t: -104, r: 60, b: 594 }
  const memory = new Map([
    ['dsh-piggy:desktop-open-box', JSON.stringify({ v: 2, boxes: { 'top|right|14': saved } })],
    ['dsh-piggy:desktop-sides', JSON.stringify({ vertical: 'top', horizontal: 'right' })],
  ])
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
  globalThis.document = { body: {} }
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1' })
  const pig = { offsetLeft: 250, offsetTop: 610, offsetWidth: 54, offsetHeight: 54, offsetParent: document.body,
    hidden: false, closest: () => null }
  // 猪贴屏幕底边：旧逻辑在这里会翻朝向
  const host = { offsetLeft: 0, offsetTop: 0, offsetWidth: 320, offsetHeight: 680, offsetParent: document.body,
    closest: () => null, getAttribute: key => key === 'data-open' ? 'false' : '',
    querySelectorAll: () => [pig], querySelector: key => key === '.dp-pig' ? pig : null }
  try {
    const measure = createMeasure({ platform: 'linux', geometry: () => ({ window: { x: 0, y: 700, width: 320, height: 680 }, workArea: { x: 0, y: 29, width: 1920, height: 985 } }) })
    const first = measure.boxes(host)
    const sideAfterFirst = measure.state.vertical
    const second = measure.boxes(host)
    assert.equal(measure.state.vertical, sideAfterFirst, '测量不该改朝向')
    assert.deepEqual(second.content, first.content, '同样的布局量两次必须一样（不然窗口会来回跳）')
  } finally {
    globalThis.localStorage = oldStorage
    globalThis.document = oldDocument
    globalThis.getComputedStyle = oldStyle
  }
})
