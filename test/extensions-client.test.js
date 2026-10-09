// 扩展中心的客户端部分：关掉的扩展不在主菜单、图鉴、猪身上出现；「扩展」App 里能开关。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SNAPSHOT, contentOf, findByAttr, mount, openPanel, settle } from './helpers/bundle.js'

const ext = (pomodoro, fishing) => [
  { key: 'pomodoro', label: '番茄钟', emoji: '🍅', description: '专注', on: pomodoro, apps: ['pomodoro'], dexSections: [], shopKinds: [] },
  { key: 'fishing', label: '钓鱼', emoji: '🎣', description: '钓鱼', on: fishing, apps: ['fishing'], dexSections: ['fish'], shopKinds: ['bait'] },
]

function openExtensions(dom) {
  openPanel(dom, 'settings')
  findByAttr(contentOf(dom), 'data-open-extensions', 'true').fire('click')
}

test('主菜单没有「扩展」方块；全部打开时番茄钟、钓鱼都在', async () => {
  const { dom } = await mount({ status: { ...SNAPSHOT, extensions: ext(true, true) } })
  openPanel(dom)
  assert.equal(findByAttr(contentOf(dom), 'data-app', 'extensions'), undefined)
  for (const key of ['pomodoro', 'fishing']) assert.ok(findByAttr(contentOf(dom), 'data-app', key), key)
})

test('关掉钓鱼：主菜单没有钓鱼，图鉴没有鱼分区；番茄钟还在', async () => {
  const { dom } = await mount({ status: { ...SNAPSHOT, extensions: ext(true, false) } })
  openPanel(dom)
  assert.equal(findByAttr(contentOf(dom), 'data-app', 'fishing'), undefined)
  assert.ok(findByAttr(contentOf(dom), 'data-app', 'pomodoro'))
  findByAttr(contentOf(dom), 'data-app', 'dex').fire('click')
  assert.equal(findByAttr(contentOf(dom), 'data-dex-section', 'fish'), undefined)
  assert.ok(findByAttr(contentOf(dom), 'data-dex-section', 'items'))
})

test('关掉番茄钟：主菜单没有番茄钟，专注中的角标也不显示', async () => {
  const active = { active: true, minutes: 25, secondsLeft: 600, todayDone: 1, rewardedToday: 1, cap: 8, reward: { coins: 8, happiness: 6 }, options: [15, 25, 45] }
  const { dom } = await mount({ status: { ...SNAPSHOT, pomodoro: active, extensions: ext(false, true) } })
  openPanel(dom)
  assert.equal(findByAttr(contentOf(dom), 'data-app', 'pomodoro'), undefined)
  const pill = findByAttr(dom.body, 'data-pomo-pill', 'true')
  assert.equal(pill.hidden, true)
})

test('「扩展」App：每个扩展一张卡，点开关发 setExtension', async () => {
  const { dom, calls } = await mount({ status: { ...SNAPSHOT, extensions: ext(true, true) } })
  openExtensions(dom)
  assert.ok(findByAttr(contentOf(dom), 'data-extension', 'pomodoro'))
  findByAttr(contentOf(dom), 'data-extension-toggle', 'fishing').fire('click')
  await settle()
  const post = calls.find(call => call.method === 'POST')
  assert.deepEqual(JSON.parse(post.body), { action: 'setExtension', key: 'fishing', on: false })
})

test('老宿主不发扩展列表：当作全部打开', async () => {
  const { dom } = await mount({ status: { ...SNAPSHOT } })
  openPanel(dom)
  assert.ok(findByAttr(contentOf(dom), 'data-app', 'fishing'))
  assert.ok(findByAttr(contentOf(dom), 'data-app', 'pomodoro'))
})

test('正开着钓鱼页时钓鱼被关掉：退回主菜单', async () => {
  const { enabledTabs } = await import('../src/client/extensions.js')
  const ctx = { tab: 'fishing', view: { extensions: ext(true, false) } }
  const tabs = enabledTabs(ctx, [{ key: 'status' }, { key: 'fishing' }, { key: 'pomodoro' }])
  assert.equal(ctx.tab, 'home')
  assert.deepEqual(tabs.map(t => t.key), ['status', 'pomodoro'])
})

test('v0.30 delete asks once in the card, then sends removeExtension', async () => {
  const { dom, calls } = await mount({ status: SNAPSHOT })
  openExtensions(dom)
  findByAttr(contentOf(dom), 'data-ext-remove', 'fishing').fire('click')
  assert.match(contentOf(dom).allText(), /删掉会清空鱼篓里的鱼/)
  findByAttr(contentOf(dom), 'data-ext-remove-no', 'fishing').fire('click')
  assert.equal(findByAttr(contentOf(dom), 'data-ext-remove-yes', 'fishing'), undefined)
  findByAttr(contentOf(dom), 'data-ext-remove', 'fishing').fire('click')
  findByAttr(contentOf(dom), 'data-ext-remove-yes', 'fishing').fire('click')
  await settle()
  assert.deepEqual(JSON.parse(calls.filter(call => call.method === 'POST').at(-1).body), { action: 'removeExtension', key: 'fishing' })
})

test('v0.30 a removed built-in leaves the local list; a downloaded one gets its own app', async () => {
  const extensions = [
    { key: 'pomodoro', label: '番茄钟', emoji: '🍅', on: true, installed: true, builtin: true, apps: ['pomodoro'], dexSections: [], shopKinds: [] },
    { key: 'fishing', label: '钓鱼', emoji: '🎣', on: false, installed: false, builtin: true, apps: ['fishing'], dexSections: ['fish'], shopKinds: ['bait'] },
    { key: 'piggybank', label: '存钱罐', emoji: '🏺', on: true, installed: true, builtin: false, version: '1.0.0', app: { emoji: '🏺', label: '存钱罐' }, apps: [], dexSections: [], shopKinds: [] },
  ]
  const { dom } = await mount({ status: { ...SNAPSHOT, extensions, extViews: { piggybank: { saved: 10 } } } })
  openPanel(dom)
  assert.notEqual(findByAttr(contentOf(dom), 'data-app', 'ext:piggybank'), undefined, 'downloaded app on the home grid')
  assert.equal(findByAttr(contentOf(dom), 'data-app', 'fishing'), undefined)
  findByAttr(contentOf(dom), 'data-app', 'settings').fire('click')
  findByAttr(contentOf(dom), 'data-open-extensions', 'true').fire('click')
  assert.equal(findByAttr(contentOf(dom), 'data-extension', 'fishing'), undefined, 'removed: not in the local list')
  assert.notEqual(findByAttr(contentOf(dom), 'data-extension', 'piggybank'), undefined)
})

test('H2 扩展货架可购买，指定摆件先展开选择', async () => {
  const shelf = { extension: 'blindbox', key: 'blindbox', label: '盲盒', emoji: '🎁', color: 'orange', currency: { label: '资质凭证', emoji: '📜', balance: 128 }, items: [
    { key: 'ticket', emoji: '🎟', label: '盲盒券', note: '免费寻访 1 次', price: 20, disabled: false, pick: null },
    { key: 'pick5', emoji: '⭐', label: '指定五星', note: '选一件', price: 120, disabled: false, pick: [{ key: 'fox', emoji: '🦊', label: '狐狸' }] },
  ] }
  const extensions = [...ext(true, true), { key: 'blindbox', label: '盲盒', on: true, installed: true, builtin: false, apps: [], dexSections: [], shopKinds: [] }]
  const { dom, calls } = await mount({ status: { ...SNAPSHOT, extensions, extShelves: [shelf] } })
  openPanel(dom, 'shop')
  findByAttr(contentOf(dom), 'data-shelf', 'ext:blindbox').fire('click')
  assert.match(contentOf(dom).allText(), /🎁 盲盒 📜/)
  findByAttr(contentOf(dom), 'data-ext-buy', 'ticket').fire('click')
  await settle()
  assert.deepEqual(JSON.parse(calls.filter(call => call.method === 'POST').at(-1).body), { action: 'ext', key: 'blindbox', op: 'buy', data: { item: 'ticket', pick: null } })
  findByAttr(contentOf(dom), 'data-ext-buy', 'pick5').fire('click')
  assert.ok(findByAttr(contentOf(dom), 'data-ext-pick', 'fox'))
  findByAttr(contentOf(dom), 'data-ext-pick', 'fox').fire('click')
  await settle()
  assert.deepEqual(JSON.parse(calls.filter(call => call.method === 'POST').at(-1).body), { action: 'ext', key: 'blindbox', op: 'buy', data: { item: 'pick5', pick: 'fox' } })
})

test('H2 扩展图鉴有进度、闪卡墙和摆件详情', async () => {
  const dex = { extension: 'blindbox', key: 'figures', label: '摆件', emoji: '🧸', color: 'orange', style: 'holo', entries: [
    { key: 'whale', emoji: '🐳', label: '大鲸鱼', stars: 6, blurb: '会下雨', potential: 2, acquired: true },
    { key: 'fox', emoji: '🦊', label: '狐狸', stars: 5, blurb: '很聪明', potential: 0, acquired: false },
  ] }
  const extensions = [...ext(true, true), { key: 'blindbox', label: '盲盒', on: true, installed: true, builtin: false, apps: [], dexSections: [], shopKinds: [] }]
  const { dom } = await mount({ status: { ...SNAPSHOT, extensions, extDex: [dex] } })
  openPanel(dom, 'dex')
  const section = findByAttr(contentOf(dom), 'data-dex-section', 'ext:blindbox:figures')
  assert.ok(section)
  assert.match(section.allText(), /1\/2/)
  section.fire('click')
  assert.ok(findByAttr(contentOf(dom), 'data-dex-entry', 'whale'))
  assert.match(contentOf(dom).allText(), /？？？/)
  findByAttr(contentOf(dom), 'data-dex-entry', 'whale').fire('click')
  assert.ok(findByAttr(contentOf(dom), 'data-dex-detail', 'whale'))
  assert.match(contentOf(dom).allText(), /会下雨/)
})

test('H2 关掉下载扩展后，货架与图鉴分区隐藏', async () => {
  const status = { ...SNAPSHOT,
    extensions: [...ext(true, true), { key: 'blindbox', label: '盲盒', on: false, installed: true, builtin: false, apps: [], dexSections: [], shopKinds: [] }],
    extShelves: [{ extension: 'blindbox', key: 'blindbox', label: '盲盒', items: [] }],
    extDex: [{ extension: 'blindbox', key: 'figures', label: '摆件', entries: [] }],
  }
  const { dom } = await mount({ status })
  openPanel(dom, 'shop')
  assert.equal(findByAttr(contentOf(dom), 'data-shelf', 'ext:blindbox'), undefined)
  const second = await mount({ status })
  openPanel(second.dom, 'dex')
  assert.equal(findByAttr(contentOf(second.dom), 'data-dex-section', 'ext:blindbox:figures'), undefined)
})

test('扩展页有「从文件导入」；本地导入的非官方扩展卡片标「本地导入」', async () => {
  const extensions = [...ext(true, true),
    { key: 'piggybank', label: '存钱罐', emoji: '🏺', on: true, installed: true, builtin: false, local: true, version: '1.0.0', app: { emoji: '🏺', label: '存钱罐' }, apps: [], dexSections: [], shopKinds: [] }]
  const { dom } = await mount({ status: { ...SNAPSHOT, extensions, extViews: { piggybank: { saved: 0 } } } })
  openExtensions(dom)
  const input = findByAttr(contentOf(dom), 'data-ext-import', 'file')
  assert.notEqual(input, undefined, 'the import picker is there')
  assert.equal(input.getAttribute('accept'), '.piggyext,.json,.js')
  assert.match(findByAttr(contentOf(dom), 'data-extension', 'piggybank').allText(), /存钱罐 1\.0\.0 · 本地导入/)
  assert.doesNotMatch(findByAttr(contentOf(dom), 'data-extension', 'pomodoro').allText(), /本地导入/)
})
