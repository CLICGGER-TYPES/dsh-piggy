// 扩展中心的客户端部分：关掉的扩展不在主菜单、图鉴、猪身上出现；「扩展」App 里能开关。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeExtensions } from '../../../src/client/extensions.js'
import { SNAPSHOT, contentOf, findByAttr, mount, openPanel, settle } from '../../helpers/bundle.js'

const ext = (pomodoro, fishing) => [
  { key: 'pomodoro', label: '番茄钟', emoji: '🍅', description: '专注', on: pomodoro, apps: ['pomodoro'], dexSections: [], shopKinds: [] },
  { key: 'fishing', label: '钓鱼', emoji: '🎣', description: '钓鱼', on: fishing, apps: ['fishing'], dexSections: ['fish'], shopKinds: ['bait'] },
]

/** 素材包卡片的测试数据：动作包 4 个 / 音效包 1 个。 */
const actionPack = (pack, extra = {}) => ({
  kind: 'actions', pack: pack, namespace: 'ext-assetpack',
  base: '/dsh-piggy/ext/assetpack/actions/' + pack + '/',
  entries: 1, frames: 2, files: 3, bytes: 100, available: true, ...extra,
})
const soundPack = (extra = {}) => ({
  kind: 'sounds', pack: 'sfx', namespace: 'ext-assetpack',
  base: '/dsh-piggy/ext/assetpack/sounds/sfx/',
  entries: 3, frames: 0, files: 4, bytes: 50, available: true, ...extra,
})
function assetExtension(overrides = {}) {
  return {
    key: 'assetpack', label: '素材扩展', emoji: '🎨', description: '', on: true, installed: true, builtin: false,
    version: '1.0.0', apps: [], dexSections: [], shopKinds: [],
    assetPacks: {
      actions: [actionPack('wave'), actionPack('idle'), actionPack('walk'), actionPack('sit')],
      sounds: [soundPack()],
    },
    ...overrides,
  }
}

const jsonResponse = value => ({ ok: true, status: 200, async text() { return JSON.stringify(value) } })

/** 只回应素材包 pack.json；其他请求交回挂具的默认 /state。 */
async function assetFetch(url) {
  const path = String(url)
  const action = /\/actions\/([a-z-]+)\/pack\.json$/.exec(path)
  if (action !== null) {
    return jsonResponse({ pack: action[1], actions: [{ key: 'hello', kind: 'action', source: 'hello.png', durationMs: 200 }] })
  }
  if (/\/sounds\/[a-z-]+\/pack\.json$/.test(path)) {
    return jsonResponse({ pack: 'sfx', sounds: [{ key: 'beep', synth: { tones: [{ type: 'sine', from: 440, to: 660, ms: 80, gain: 0.3 }] } }] })
  }
  return undefined
}

/** 让运行时注册/试播链上的微任务跑完。 */
async function flush(times = 16) {
  for (let index = 0; index < times; index += 1) await settle()
}


function openExtensions(dom) {
  openPanel(dom, 'settings')
  findByAttr(contentOf(dom), 'data-open-extensions', 'true').fire('click')
}

test('素材包摘要只做归一化：保留 kind/基址/可用状态，旧宿主缺字段时不报错', () => {
  const [entry] = normalizeExtensions([{
    key: 'assetpack', label: '素材扩展', on: true, installed: true, builtin: false,
    assetPacks: {
      actions: [{ kind: 'actions', pack: 'wave', namespace: 'ext-assetpack', base: '/dsh-piggy/ext/assetpack/actions/wave/', entries: 1, frames: 2, files: 3, bytes: 99, available: true }],
      sounds: [{ pack: 'sfx', namespace: 'ext-assetpack', entries: 1, files: 2, bytes: 10 }],
    },
  }])
  assert.deepEqual(entry.assetPacks.actions[0], {
    kind: 'actions', pack: 'wave', namespace: 'ext-assetpack',
    base: '/dsh-piggy/ext/assetpack/actions/wave/',
    entries: 1, frames: 2, files: 3, bytes: 99, available: true,
  })
  // 老宿主没有 kind/base/available：按列表种类补 kind，可用状态保持宽松。
  assert.equal(entry.assetPacks.sounds[0].kind, 'sounds')
  assert.equal(entry.assetPacks.sounds[0].base, '')
  assert.equal(entry.assetPacks.sounds[0].available, true)
  const [old] = normalizeExtensions([{ key: 'old', label: '旧扩展', on: true }])
  assert.deepEqual(old.assetPacks, { actions: [], sounds: [] })
})

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
  const { enabledTabs } = await import('../../../src/client/extensions.js')
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
  assert.equal(input.getAttribute('accept'), '.piggyext,.zip,.json,.js')
  assert.match(findByAttr(contentOf(dom), 'data-extension', 'piggybank').allText(), /存钱罐 1\.0\.0 · 本地导入/)
  assert.doesNotMatch(findByAttr(contentOf(dom), 'data-extension', 'pomodoro').allText(), /本地导入/)
})

test('下载扩展的图片清单和框材质穿过快照归一化，不回退旧背景', () => {
  const layout = { 'card-frame.webp': { size: [512, 264], nine_slice: { insets: [113, 113, 113, 113] }, inner_insets: [61, 22, 1, 22] } }
  const entry = normalizeExtensions([{ key: 'farm', builtin: false, assets: ['bg-big-night-rain.webp', 'card-frame.webp', 123], assetLayout: layout }])[0]
  assert.deepEqual(entry.assets, ['bg-big-night-rain.webp', 'card-frame.webp'])
  assert.deepEqual(entry.assetLayout, layout)
})

test('M3 扩展卡片只读展示素材包摘要，动作/音效计数与包名最多 3 个', async () => {
  const { dom } = await mount({
    status: { ...SNAPSHOT, extensions: [...ext(true, true), assetExtension()] },
    fetch: assetFetch,
  })
  openExtensions(dom)
  const card = findByAttr(contentOf(dom), 'data-extension', 'assetpack')
  assert.notEqual(card, undefined)
  const assets = findByAttr(card, 'data-ext-assets', 'assetpack')
  assert.notEqual(assets, undefined)
  assert.match(assets.allText(), /动作包 4 个 · 4 个动作 · 8 帧/)
  assert.match(assets.allText(), /wave · idle · walk \+1/)
  assert.match(assets.allText(), /音效包 1 个 · 3 条/)
  assert.equal(findByAttr(assets, 'data-ext-asset-play', 'actions').textContent, '试播')
  assert.equal(findByAttr(assets, 'data-ext-asset-play', 'sounds').textContent, '试听')
})

test('M3 扩展停用或素材包不可用时显示「不可用」，且不出现试播按钮', async () => {
  const off = assetExtension({ on: false })
  const first = await mount({ status: { ...SNAPSHOT, extensions: [...ext(true, true), off] } })
  openExtensions(first.dom)
  let card = findByAttr(contentOf(first.dom), 'data-extension', 'assetpack')
  assert.match(card.allText(), /不可用/)
  assert.equal(findByAttr(card, 'data-ext-asset-play', 'actions'), undefined)
  assert.equal(findByAttr(card, 'data-ext-asset-play', 'sounds'), undefined)

  const broken = assetExtension({
    assetPacks: {
      actions: [actionPack('wave', { available: false })],
      sounds: [soundPack()],
    },
  })
  const second = await mount({ status: { ...SNAPSHOT, extensions: [...ext(true, true), broken] }, fetch: assetFetch })
  openExtensions(second.dom)
  card = findByAttr(contentOf(second.dom), 'data-extension', 'assetpack')
  assert.match(card.allText(), /动作包 1 个 · 1 个动作 · 2 帧 不可用/)
  assert.equal(findByAttr(card, 'data-ext-asset-play', 'actions'), undefined, '不可用动作包没有试播')
  assert.notEqual(findByAttr(card, 'data-ext-asset-play', 'sounds'), undefined, '可用音效包照常试听')
})

test('M3 试播/试听派发公开事件和正确的 ext handle', async () => {
  const seen = []
  const one = assetExtension({
    assetPacks: { actions: [actionPack('wave')], sounds: [soundPack()] },
  })
  const { dom } = await mount({
    status: { ...SNAPSHOT, extensions: [...ext(true, true), one] },
    fetch: assetFetch,
  })
  dom.document.dispatchEvent = event => {
    for (const listener of dom.documentListeners[event.type] ?? []) listener(event)
  }
  dom.document.addEventListener('dsh-piggy:action', event => seen.push([event.type, event.detail.key]))
  dom.document.addEventListener('dsh-piggy:sound', event => seen.push([event.type, event.detail.key]))
  openExtensions(dom)

  findByAttr(contentOf(dom), 'data-ext-asset-play', 'actions').fire('click')
  await flush()
  findByAttr(contentOf(dom), 'data-ext-asset-play', 'sounds').fire('click')
  await flush()

  assert.deepEqual(seen, [
    ['dsh-piggy:action', 'ext-assetpack/wave/hello'],
    ['dsh-piggy:sound', 'ext-assetpack/sfx/beep'],
  ])
})

test('M3 旧快照没有 assetPacks 字段时整块隐藏，不报错', async () => {
  const { dom } = await mount({ status: SNAPSHOT })
  openExtensions(dom)
  assert.equal(findByAttr(contentOf(dom), 'data-ext-assets', 'pomodoro'), undefined)
  assert.equal(findByAttr(contentOf(dom), 'data-ext-assets', 'fishing'), undefined)
  assert.doesNotMatch(contentOf(dom).allText(), /动作包|音效包/)
})
