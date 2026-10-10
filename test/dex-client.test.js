// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SNAPSHOT, contentOf, findByAttr, findByClass, mount, openPanel } from './helpers/bundle.js'

const DEX = {
  forms: [
    {
      key: 'king', label: '猪猪王', emoji: '👑', art: 'pig-king', acquired: false, firstAt: null, count: 0,
      condition: '使用王冠完成加冕',
      hint: '当阅历足以服众，三种本事不再偏科，金色会选择它的主人。',
      description: '阅历与本事都攒够了，戴上自己的王冠。',
      requirements: [
        { key: 'level', label: '等级', have: 40, need: 40, met: true },
        { key: 'charm', label: '魅力', have: 12, need: 20, met: false },
      ],
    },
    {
      key: 'devil', label: '恶魔猪', emoji: '😈', art: 'pig-devil', acquired: true, firstAt: 1_800_000_000_000, count: 2,
      condition: '使用恶魔契约完成签约', hint: '嬉闹声足够多时，一纸约定会来敲门。',
      description: '玩出了本事，也玩出了自己的小脾气。', requirements: [],
    },
  ],
  skins: [],
  fish: [],
  items: [
    { key: 'apple', label: '苹果', emoji: '🍎', kind: 'food', kindLabel: '食物', acquired: true, firstAt: 1_800_000_000_000, count: 3, condition: '商店购买' },
    { key: 'crown', label: '王冠', emoji: '👑', kind: 'promotion', kindLabel: '晋升', acquired: false, firstAt: null, count: 0, condition: '商店购买 · 3000 金币' },
  ],
  souvenirs: [
    { key: 'shell', label: '一枚海螺', emoji: '🐚', acquired: false, firstAt: null, count: 0, condition: '旅行到看海获得' },
  ],
}

test('C4 the 图鉴 replaces 加冕 in the same home slot and exposes five sections', async () => {
  const { dom } = await mount({ status: { ...SNAPSHOT, dex: DEX } })
  openPanel(dom)
  const content = contentOf(dom)
  assert.equal(findByAttr(content, 'data-app', 'crown'), undefined)
  const app = findByAttr(content, 'data-app', 'dex')
  assert.notEqual(app, undefined)
  assert.match(app.allText(), /图鉴/)
  app.fire('click')
  for (const key of ['forms', 'skins', 'fish', 'items', 'souvenirs']) {
    const section = findByAttr(contentOf(dom), 'data-dex-section', key)
    assert.notEqual(section, undefined, key)
    assert.notEqual(findByClass(section, 'dp-dex-progress'), undefined, key + ' progress')
  }
})

test('C4 form shelf uses SVG flash cards and keeps exact requirements secret', async () => {
  const { dom } = await mount({ status: { ...SNAPSHOT, dex: DEX } })
  openPanel(dom, 'dex')
  findByAttr(contentOf(dom), 'data-dex-section', 'forms').fire('click')
  const king = findByAttr(contentOf(dom), 'data-dex-entry', 'king')
  const devil = findByAttr(contentOf(dom), 'data-dex-entry', 'devil')
  assert.notEqual(findByClass(contentOf(dom), 'dp-dex-flash-grid'), undefined)
  assert.match(king.className, /dp-dex-card-locked/)
  assert.doesNotMatch(king.className, /dp-dex-card-foil/)
  assert.equal(findByClass(king, 'dp-dex-art').src, '/dsh-piggy/art/pigs/forms/pig-king/idle.png')
  assert.match(king.allText(), /🔒/)
  assert.doesNotMatch(king.allText(), /猪猪王|等级|魅力|40\/40|12\/20/)
  assert.equal(findByClass(devil, 'dp-dex-art').src, '/dsh-piggy/art/pigs/forms/pig-devil/idle.png')
  assert.match(devil.allText(), /恶魔猪/)
  assert.match(devil.className, /dp-dex-card-foil/)
})

test('C4 opening a locked card reveals a riddle, while an unlocked card reveals its story', async () => {
  const { dom } = await mount({ status: { ...SNAPSHOT, dex: DEX } })
  openPanel(dom, 'dex')
  findByAttr(contentOf(dom), 'data-dex-section', 'forms').fire('click')

  findByAttr(contentOf(dom), 'data-dex-entry', 'king').fire('click')
  const locked = findByAttr(contentOf(dom), 'data-dex-detail', 'king')
  assert.equal(findByAttr(contentOf(dom), 'data-dex-entry', 'king'), undefined)
  assert.match(locked.allText(), /解锁谜面/)
  assert.match(locked.allText(), /金色会选择它的主人/)
  assert.doesNotMatch(locked.allText(), /使用王冠|等级 40\/40|魅力 12\/20/)

  findByAttr(contentOf(dom), 'data-dex-detail-back', 'forms').fire('click')
  findByAttr(contentOf(dom), 'data-dex-entry', 'devil').fire('click')
  const unlocked = findByAttr(contentOf(dom), 'data-dex-detail', 'devil')
  assert.match(unlocked.allText(), /玩出了本事，也玩出了自己的小脾气/)
  assert.match(unlocked.allText(), /获得 2 次/)
})

test('C4 items use a searchable filtered catalogue instead of flash cards', async () => {
  const { dom } = await mount({ status: { ...SNAPSHOT, dex: DEX } })
  openPanel(dom, 'dex')
  findByAttr(contentOf(dom), 'data-dex-section', 'items').fire('click')
  assert.notEqual(findByAttr(contentOf(dom), 'data-dex-search', 'items'), undefined)
  assert.notEqual(findByClass(contentOf(dom), 'dp-dex-catalog'), undefined)
  assert.equal(findByClass(contentOf(dom), 'dp-dex-flash-grid'), undefined)

  const search = findByAttr(contentOf(dom), 'data-dex-search', 'items')
  search.value = '苹果'
  search.fire('input')
  assert.equal(findByAttr(contentOf(dom), 'data-dex-entry', 'apple').getAttribute('data-search-hidden'), null)
  assert.equal(findByAttr(contentOf(dom), 'data-dex-entry', 'crown').getAttribute('data-search-hidden'), 'true')

  search.value = ''
  search.fire('input')
  findByAttr(contentOf(dom), 'data-dex-filter', 'promotion').fire('click')
  assert.equal(findByAttr(contentOf(dom), 'data-dex-entry', 'apple'), undefined)
  assert.notEqual(findByAttr(contentOf(dom), 'data-dex-entry', 'crown'), undefined)
})

test('search input keeps its focused node through a status poll', async () => {
  const { dom, intervals } = await mount({ status: { ...SNAPSHOT, dex: DEX } })
  const poll = intervals.find(entry => entry.delay === 4000).fn
  openPanel(dom, 'dex')
  findByAttr(contentOf(dom), 'data-dex-section', 'items').fire('click')
  const search = findByAttr(contentOf(dom), 'data-dex-search', 'items')
  search.value = '苹果'
  search.fire('input')
  globalThis.document.activeElement = search

  await poll()
  assert.equal(findByAttr(contentOf(dom), 'data-dex-search', 'items'), search)
  assert.equal(search.value, '苹果')
})

test('C4 souvenirs use the compact museum grid', async () => {
  const { dom } = await mount({ status: { ...SNAPSHOT, dex: DEX } })
  openPanel(dom, 'dex')
  findByAttr(contentOf(dom), 'data-dex-section', 'souvenirs').fire('click')
  assert.notEqual(findByClass(contentOf(dom), 'dp-dex-museum'), undefined)
  assert.equal(findByClass(contentOf(dom), 'dp-dex-flash-grid'), undefined)
})

test('C4 a host without dex data degrades to empty sections', async () => {
  const { dom } = await mount({ status: { ...SNAPSHOT, dex: undefined } })
  openPanel(dom, 'dex')
  assert.match(contentOf(dom).allText(), /形态/)
  findByAttr(contentOf(dom), 'data-dex-section', 'fish').fire('click')
  assert.match(contentOf(dom).allText(), /还没有/)
})
