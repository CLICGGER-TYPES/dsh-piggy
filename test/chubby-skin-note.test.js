// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { PIG, SNAPSHOT, contentOf, findByAttr, mount, openPanel } from './helpers/bundle.js'

const NOTE = '穿皮肤会变普通体型，胖胖只有默认皮肤有'

const SKINS = {
  current: 'default',
  entries: [
    { key: 'default', label: '默认小猪', emoji: '🐷', art: 'piglet', current: true, custom: false, author: 'dsh-piggy', description: '熟悉的小猪。', scenes: ['idle'] },
    { key: 'mint', label: '薄荷小猪', emoji: '🌿', art: 'skin-mint', current: false, custom: false, author: 'dsh-piggy', description: '清凉的薄荷色。', scenes: ['idle'] },
  ],
}

const DEX = {
  skins: [{
    key: 'mint', label: '薄荷小猪', emoji: '🌿', art: 'skin-mint', acquired: true, firstAt: 1_800_000_000_000,
    count: 1, description: '清凉的薄荷色。', hint: '换一种颜色，也还是熟悉的它。', condition: '随版本收录',
  }],
}

const body = bodyClass => ({ class: bodyClass, label: bodyClass === 'fat' ? '胖胖' : (bodyClass === 'round' ? '圆润' : '正常'), visible: bodyClass !== 'normal' })

const statusWith = bodyWeight => ({
  ...SNAPSHOT,
  ...(bodyWeight === undefined ? {} : { pig: { ...PIG, bodyWeight } }),
  skins: SKINS,
  dex: DEX,
})

test('胖体型打开换肤页会看到一句说明，不胖时完全不出现', async () => {
  for (const bodyClass of ['round', 'fat']) {
    const { dom } = await mount({ status: statusWith(body(bodyClass)) })
    openPanel(dom, 'skins')
    const note = findByAttr(contentOf(dom), 'data-skin-fat-note', 'true')
    assert.notEqual(note, undefined, bodyClass)
    assert.equal(note.textContent, NOTE)
    assert.match(note.className, /\bdp-hint\b/, '说明应沿用全站小字提示样式')
  }
  for (const status of [statusWith(body('normal')), statusWith(undefined)]) {
    const { dom } = await mount({ status })
    openPanel(dom, 'skins')
    assert.equal(findByAttr(contentOf(dom), 'data-skin-fat-note', 'true'), undefined)
  }
})

test('图鉴皮肤详情换肤时同样说明，不胖时不出现', async () => {
  for (const bodyClass of ['round', 'fat']) {
    const { dom } = await mount({ status: statusWith(body(bodyClass)) })
    openPanel(dom, 'dex')
    findByAttr(contentOf(dom), 'data-dex-section', 'skins').fire('click')
    findByAttr(contentOf(dom), 'data-dex-entry', 'mint').fire('click')
    const detail = findByAttr(contentOf(dom), 'data-dex-detail', 'mint')
    const note = findByAttr(detail, 'data-skin-fat-note', 'true')
    assert.notEqual(note, undefined, bodyClass)
    assert.equal(note.textContent, NOTE)
    assert.ok(detail.allText().includes(NOTE), '说明要出现在皮肤详情卡里')
  }
  const { dom } = await mount({ status: statusWith(body('normal')) })
  openPanel(dom, 'dex')
  findByAttr(contentOf(dom), 'data-dex-section', 'skins').fire('click')
  findByAttr(contentOf(dom), 'data-dex-entry', 'mint').fire('click')
  const detail = findByAttr(contentOf(dom), 'data-dex-detail', 'mint')
  assert.equal(findByAttr(detail, 'data-skin-fat-note', 'true'), undefined)
})
