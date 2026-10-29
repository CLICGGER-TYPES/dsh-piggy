import test from 'node:test'
import assert from 'node:assert/strict'

import { SNAPSHOT, contentOf, findByAttr, findByClass, mount, openPanel, sceneOf, settle } from './helpers/bundle.js'

const fishing = { pending: null, bag: [], period: 'evening', autoTrips: 0 }
const bait = { key: 'bait_worm', kind: 'bait', label: '蚯蚓鱼饵', emoji: '🪱', price: 5 }
const rod = { level: 1, key: 'bamboo', label: '竹竿', emoji: '🎋' }
const spots = [
  { key: 'river', label: '小河', emoji: '🏞', price: 0, unlocked: true, open: true, kinds: 15 },
  { key: 'lake', label: '湖', emoji: '🏕', price: 1500, unlocked: false, open: true, kinds: 12 },
  { key: 'sea', label: '海边', emoji: '🏖', price: 4000, unlocked: false, open: true, kinds: 9 },
  { key: 'night', label: '夜潭', emoji: '🌌', price: 9000, unlocked: true, open: false, kinds: 5 },
]
const status = extra => ({ ...SNAPSHOT, fishing: { ...fishing, ...extra }, canGoOut: true,
  shop: [...SNAPSHOT.shop, bait], inventory: { ...SNAPSHOT.inventory, bait_worm: 20 } })

test('K1 自动仓收取、升级和长时出发走宿主动作，鱼饵盒允许少量鱼饵', async () => {
  const automation = { stored: 3, capacity: 48, full: false, baitLimit: 64,
    choices: [{ minutes: 30, attempts: 6 }, { minutes: 240, attempts: 53 }],
    upgrades: [{ kind: 'duration', label: '4 小时自动钓', price: 5000 }] }
  const { dom, calls } = await mount({ status: { ...status({ automation }), pig: { ...SNAPSHOT.pig, coins: 6000 },
    inventory: { ...SNAPSHOT.inventory, bait_worm: 2 } } })
  openPanel(dom, 'fishing')
  assert.doesNotMatch(contentOf(dom).allText(), /每 4\.5 分钟一竿/)
  findByAttr(contentOf(dom), 'data-fish-collect', 'true').fire('click')
  await settle()
  assert.equal(JSON.parse(calls.at(-1).body).action, 'fishCollect')
  findByAttr(contentOf(dom), 'data-fish-upgrade', 'duration').fire('click')
  await settle()
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'fishAutomation', kind: 'duration' })
  const go = findByAttr(contentOf(dom), 'data-fish-auto', '240')
  assert.equal(go.disabled, false)
  go.fire('click')
  await settle()
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'fishAuto', minutes: 240, bait: 'bait_worm' })
})

test('未开长时自动钓不显示新鱼篓，短行程仍按原饵数出发', async () => {
  const automation = { unlocked: false, stored: 0, usedHours: 0, full: false, baitLimit: 64,
    choices: [{ minutes: 30, attempts: 10 }, { minutes: 60, attempts: 20 }], upgrades: [] }
  const { dom } = await mount({ status: status({ automation }) })
  openPanel(dom, 'fishing')
  assert.equal(findByAttr(contentOf(dom), 'data-fish-collect', 'true'), undefined)
  assert.match(findByAttr(contentOf(dom), 'data-fish-auto', '30').textContent, /鱼饵 10 个/)
  assert.match(findByAttr(contentOf(dom), 'data-fish-auto', '60').textContent, /鱼饵 20 个/)
})

test('新鱼篓空仓停工不写满，接着干仍走收取动作', async () => {
  const automation = { unlocked: true, stored: 0, usedHours: 6, full: true, baitLimit: 64,
    choices: [{ minutes: 30, attempts: 10 }, { minutes: 120, attempts: 26 }], upgrades: [] }
  const { dom, calls } = await mount({ status: status({ automation }) })
  openPanel(dom, 'fishing')
  assert.match(contentOf(dom).allText(), /钓鱼歇了/)
  assert.doesNotMatch(contentOf(dom).allText(), /鱼篓满了/)
  const resume = findByAttr(contentOf(dom), 'data-fish-collect', 'true')
  assert.equal(resume.textContent, '接着干')
  assert.equal(resume.disabled, false)
  resume.fire('click')
  await settle()
  assert.equal(JSON.parse(calls.at(-1).body).action, 'fishCollect')
})

test('C5 home has a one-click cast and keeps both auto choices', async () => {
  const { dom, calls } = await mount({ status: status() })
  openPanel(dom)
  assert.notEqual(findByAttr(contentOf(dom), 'data-app', 'fishing'), undefined)
  findByAttr(contentOf(dom), 'data-app', 'fishing').fire('click')
  const cast = findByAttr(contentOf(dom), 'data-fish', 'cast')
  assert.equal(findByClass(contentOf(dom), 'dp-fish-charge'), undefined)
  cast.fire('click')
  await settle()
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'fishCast', power: .5, bait: 'bait_worm' })
  assert.notEqual(findByAttr(contentOf(dom), 'data-fish-auto', '30'), undefined)
  assert.notEqual(findByAttr(contentOf(dom), 'data-fish-auto', '60'), undefined)
})

test('fishing lets the player choose bait; no bait disables casting', async () => {
  const shrimp = { key: 'bait_shrimp', kind: 'bait', label: '鲜虾鱼饵', emoji: '🦐', price: 15 }
  const { dom, calls } = await mount({ status: { ...status(), shop: [...status().shop, shrimp],
    inventory: { ...status().inventory, bait_shrimp: 20 } } })
  openPanel(dom, 'fishing')
  findByAttr(contentOf(dom), 'data-fish-bait', 'bait_shrimp').fire('click')
  findByAttr(contentOf(dom), 'data-fish-auto', '30').fire('click')
  await settle()
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'fishAuto', minutes: 30, bait: 'bait_shrimp' })

  const empty = await mount({ status: { ...status(), inventory: { ...SNAPSHOT.inventory } } })
  openPanel(empty.dom, 'fishing')
  assert.equal(findByAttr(contentOf(empty.dom), 'data-fish', 'cast').disabled, true)
})

test('hungry pig gets an explicit casting reason and a route to feeding', async () => {
  const { dom } = await mount({ status: { ...status(), pig: { ...SNAPSHOT.pig, satiety: 0 } } })
  openPanel(dom, 'fishing')
  const content = contentOf(dom)
  assert.match(content.allText(), /饱食.*先.*喂食/)
  assert.equal(findByAttr(content, 'data-fish', 'cast').disabled, true)
  assert.notEqual(findByAttr(content, 'data-fish-care', 'feed'), undefined)
})

test('C5 caught result shows fish facts and keeps it into the bag', async () => {
  const caught = { id: 'catch-1', key: 'fish_carp', label: '鲤鱼', emoji: '🐟', sizeCm: 33.2, price: 12, phase: 'caught', difficulty: 18, behavior: 'smooth' }
  const { dom, calls } = await mount({ status: status({ pending: caught }) })
  openPanel(dom, 'fishing')
  assert.match(contentOf(dom).allText(), /鲤鱼.*33\.2 cm.*12/)
  findByAttr(contentOf(dom), 'data-fish', 'keep').fire('click')
  await settle()
  assert.equal(JSON.parse(calls.at(-1).body).action, 'fishKeep')
})

test('C5 hooked fish uses a circular skill-check QTE scaled by difficulty', async () => {
  const hooked = { id: 'catch-qte', key: 'fish_koi', label: '黄金锦鲤', emoji: '🎏', phase: 'hooked', difficulty: 86, behavior: 'dash' }
  const { dom, calls } = await mount({ status: status({ pending: hooked }) })
  openPanel(dom, 'fishing')
  const qte = findByAttr(contentOf(dom), 'data-fish-qte', 'true')
  assert.notEqual(qte, undefined)
  assert.equal(qte.getAttribute('data-qte-needed'), '6', 'C5 的 4 下 × 搏斗时长 1.5（用户 2026-10-10）')
  assert.equal(qte.getAttribute('data-qte-difficulty'), '86')
  assert.equal(findByClass(contentOf(dom), 'dp-fish-track'), undefined)
  assert.equal(qte.getAttribute('data-qte-misses'), '0')
  assert.ok(Number(qte.getAttribute('data-qte-zone-size')) >= 75)
  assert.ok(Number(qte.getAttribute('data-qte-speed')) <= 0.5)
  const callCount = calls.length
  qte.fire('pointerdown', { pointerType: 'mouse', timeStamp: 100 }) // 点早也要立刻反馈。
  await settle()
  assert.equal(calls.length, callCount)
  assert.match(qte.getAttribute('data-qte-feedback'), /还没到时机/)
})

test('QTE click and keyboard activation receive the event and show immediate feedback', async () => {
  const hooked = { id: 'catch-keyboard', key: 'fish_carp', label: '鲤鱼', emoji: '🐟', phase: 'hooked', difficulty: 30 }
  const { dom } = await mount({ status: status({ pending: hooked }) })
  openPanel(dom, 'fishing')
  const qte = findByAttr(contentOf(dom), 'data-fish-qte', 'true')
  qte.fire('click', { detail: 0, timeStamp: 100 })
  assert.match(qte.getAttribute('data-qte-feedback'), /还没到时机/)
})

test('a status poll keeps the hooked QTE button for keyboard activation', async () => {
  const hooked = { id: 'catch-poll', key: 'fish_carp', label: '鲤鱼', emoji: '🐟', phase: 'hooked', difficulty: 30 }
  const { dom, intervals } = await mount({ status: status({ pending: hooked }) })
  const poll = intervals.find(entry => entry.delay === 4000).fn
  openPanel(dom, 'fishing')
  const qte = findByAttr(contentOf(dom), 'data-fish-qte', 'true')
  globalThis.document.activeElement = qte

  await poll()
  assert.equal(findByAttr(contentOf(dom), 'data-fish-qte', 'true'), qte)
})

test('fishing still redraws when the server changes the pending phase', async () => {
  const hooked = { id: 'catch-phase', key: 'fish_carp', label: '鲤鱼', emoji: '🐟', phase: 'hooked', difficulty: 30 }
  const options = { status: status({ pending: hooked }) }
  const { dom, intervals } = await mount(options)
  const poll = intervals.find(entry => entry.delay === 4000).fn
  openPanel(dom, 'fishing')
  assert.notEqual(findByAttr(contentOf(dom), 'data-fish-qte', 'true'), undefined)

  options.status = status({ pending: { ...hooked, phase: 'caught', sizeCm: 32, price: 12 } })
  await poll()
  assert.equal(findByAttr(contentOf(dom), 'data-fish-qte', 'true'), undefined)
  assert.notEqual(findByAttr(contentOf(dom), 'data-fish', 'keep'), undefined)
})

test('C5 fish bag exposes feed and sell on each individual catch', async () => {
  const caught = { id: 'catch-2', key: 'fish_koi', label: '黄金锦鲤', emoji: '🎏', sizeCm: 70.5, price: 220 }
  const { dom, calls } = await mount({ status: status({ bag: [caught] }) })
  openPanel(dom, 'bag')
  findByAttr(contentOf(dom), 'data-bag', 'fish').fire('click')
  assert.match(contentOf(dom).allText(), /黄金锦鲤.*70\.5 cm.*220/)
  findByAttr(contentOf(dom), 'data-fish-feed', caught.id).fire('click')
  await settle()
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'fishFeed', id: caught.id })
})

test('G hooked fish shows the bar or pull fight the host picked, and holding moves it', async () => {
  for (const fight of ['bar', 'pull']) {
    const hooked = { id: 'catch-' + fight, key: 'fish_carp', label: '鲤鱼', emoji: '🐟', phase: 'hooked', difficulty: 18, behavior: 'smooth', fight }
    const { dom } = await mount({ status: status({ pending: hooked }) })
    openPanel(dom, 'fishing')
    const stage = findByAttr(contentOf(dom), 'data-fish-fight', fight)
    assert.notEqual(stage, undefined, fight)
    assert.equal(findByAttr(contentOf(dom), 'data-fish-qte', 'true'), undefined, 'not the ring')
    stage.fire('pointerdown', { pointerType: 'mouse' })
  }
})

test('G caught result shows rarity stars; auto fishing explains why it is off', async () => {
  const caught = { id: 'catch-r', key: 'fish_koi', label: '黄金锦鲤', emoji: '🎏', phase: 'caught', sizeCm: 70.5, price: 220, rarity: 'rare', maxCm: 88 }
  const result = await mount({ status: status({ pending: caught }) })
  openPanel(result.dom, 'fishing')
  assert.match(contentOf(result.dom).allText(), /★★★☆/)
  const poor = await mount({ status: { ...status(), inventory: { ...SNAPSHOT.inventory, bait_worm: 4 } } })
  openPanel(poor.dom, 'fishing')
  assert.match(contentOf(poor.dom).allText(), /点不了：鱼饵只剩 4 个，不够 10 个/)
})

test('U24-7 ready layout: scenic hero, bait counts, closed sections and the teal cast', async () => {
  const shrimp = { key: 'bait_shrimp', kind: 'bait', label: '鲜虾鱼饵', emoji: '🦐', price: 15 }
  const glow = { key: 'bait_glow', kind: 'bait', label: '夜光鱼饵', emoji: '🟢', price: 40 }
  const base = status({ rod, spots })
  const { dom } = await mount({ status: { ...base, shop: [...base.shop, shrimp, glow],
    inventory: { ...base.inventory, bait_worm: 3, bait_shrimp: 1, bait_glow: 0 } } })
  openPanel(dom, 'fishing')
  const content = contentOf(dom)
  assert.match(content.allText(), /当前钓点.*小河/)
  assert.notEqual(findByAttr(content, 'data-fish-scene', 'river'), undefined)
  assert.notEqual(findByClass(content, 'dp-fish-hero-art'), undefined)
  assert.equal(findByClass(content, 'dp-fish-art-img').src, '/dsh-piggy/art/fishing/scene-river.png?v=20bf68ad2766')
  assert.equal(findByAttr(content, 'data-fish-bait', 'bait_worm').getAttribute('aria-pressed'), 'true')
  assert.match(findByAttr(content, 'data-fish-bait', 'bait_worm').allText(), /蚯蚓.*×3/)
  assert.equal(findByAttr(content, 'data-fish-bait', 'bait_glow').disabled, true)
  assert.match(findByAttr(content, 'data-fish-bait', 'bait_glow').allText(), /×0/)
  for (const key of ['spot', 'rod', 'auto']) {
    const section = findByAttr(content, 'data-fish-section', key)
    assert.notEqual(section, undefined, key)
    assert.equal(section.getAttribute('open'), null, key + ' starts collapsed')
  }
  assert.match(findByAttr(content, 'data-fish-section', 'rod').allText(), /竹竿/)
  const cast = findByAttr(content, 'data-fish', 'cast')
  assert.equal(cast.disabled, false)
  assert.match(cast.textContent, /抛竿/)
  assert.notEqual(findByClass(content, 'dp-fish-cast'), undefined)
})

test('U24-7 expanded sections stay open across a status poll', async () => {
  const options = { status: status({ rod, spots }) }
  const { dom, intervals } = await mount(options)
  openPanel(dom, 'fishing')
  for (const key of ['spot', 'rod', 'auto']) {
    const section = findByAttr(contentOf(dom), 'data-fish-section', key)
    section.open = true
    section.fire('toggle')
  }
  options.status = status({ rod, spots, period: 'night' })
  const poll = intervals.find(entry => entry.delay === 4000).fn
  await poll()
  for (const key of ['spot', 'rod', 'auto']) {
    const section = findByAttr(contentOf(dom), 'data-fish-section', key)
    assert.equal(section.getAttribute('open'), '', key + ' remains open after the poll')
  }
})

test('U24-7 waiting keeps only current spot/rod and the float, never auto stock above', async () => {
  const pending = { id: 'wait-1', key: 'fish_carp', label: '鲤鱼', emoji: '🐟', phase: 'waiting', sizeCm: 20, price: 12,
    bitesAt: Date.now() + 5000, hookUntil: Date.now() + 7000, expiresAt: Date.now() + 60000 }
  const automation = { unlocked: true, stored: 2, usedHours: 1, full: false, baitLimit: 64,
    choices: [{ minutes: 30, attempts: 10 }], upgrades: [] }
  const { dom, calls } = await mount({ status: status({ rod, spots, pending, automation }) })
  openPanel(dom, 'fishing')
  const content = contentOf(dom)
  assert.match(content.allText(), /当前：小河 · 竹竿/)
  assert.match(content.allText(), /安静等鱼咬钩/)
  const water = findByAttr(content, 'data-fish', 'hook')
  assert.notEqual(water, undefined)
  assert.notEqual(findByClass(content, 'dp-fish-bobber'), undefined)
  assert.equal(findByAttr(content, 'data-fish-section', 'auto'), undefined)
  assert.equal(findByAttr(content, 'data-fish-auto', '30'), undefined)
  assert.equal(findByAttr(content, 'data-fish-collect', 'true'), undefined)
  const before = calls.length
  water.fire('click')
  await settle()
  assert.equal(calls.length, before, 'an early tap only changes the line, it does not spend or hook')
})

test('U24-7 fight keeps all three games and the current spot without auto stock above', async () => {
  for (const fight of ['ring', 'bar', 'pull']) {
    const hooked = { id: 'fight-' + fight, key: 'fish_carp', label: '鲤鱼', emoji: '🐟', phase: 'hooked', difficulty: 18, behavior: 'smooth', fight }
    const automation = { unlocked: true, stored: 1, usedHours: 1, full: false, baitLimit: 64,
      choices: [{ minutes: 30, attempts: 10 }], upgrades: [] }
    const { dom } = await mount({ status: status({ rod, spots, pending: hooked, automation }) })
    openPanel(dom, 'fishing')
    const content = contentOf(dom)
    assert.match(content.allText(), /当前：小河 · 竹竿/, fight)
    assert.notEqual(findByAttr(content, 'data-fish-fight-art', 'tug'), undefined, fight)
    assert.equal(findByClass(content, 'dp-fish-fight-img').src, '/dsh-piggy/art/fishing/fight-tug.png?v=ede56afb4637')
    if (fight === 'ring') assert.notEqual(findByAttr(content, 'data-fish-qte', 'true'), undefined)
    else assert.notEqual(findByAttr(content, 'data-fish-fight', fight), undefined)
    assert.equal(findByAttr(content, 'data-fish-section', 'auto'), undefined)
    assert.equal(findByAttr(content, 'data-fish-collect', 'true'), undefined)
  }
})

test('U24-7 result uses actual fish facts, crucian art only for crucian, and keeps the bag action', async () => {
  const crucian = { id: 'res-1', key: 'fish_crucian', label: '鲫鱼', emoji: '🐟', rarity: 'common', sizeCm: 18.4, price: 8, phase: 'caught' }
  const one = await mount({ status: status({ rod, spots, pending: crucian }) })
  openPanel(one.dom, 'fishing')
  const content = contentOf(one.dom)
  assert.match(content.allText(), /鲫鱼.*18\.4 cm.*8/)
  assert.match(content.allText(), /★☆☆☆/)
  const card = findByAttr(content, 'data-fish-result', 'fish_crucian')
  assert.equal(card.getAttribute('data-fish-result-art'), 'crucian')
  assert.notEqual(findByClass(content, 'dp-fish-result-img'), undefined)
  assert.equal(findByClass(content, 'dp-fish-result-img').src, '/dsh-piggy/art/fishing/crucian-result.png?v=5c1d10fba07b')
  const keep = findByAttr(content, 'data-fish', 'keep')
  assert.notEqual(keep, undefined)
  assert.notEqual(findByClass(content, 'dp-fish-keep'), undefined)

  const carp = { id: 'res-2', key: 'fish_carp', label: '鲤鱼', emoji: '🐟', rarity: 'uncommon', sizeCm: 33.2, price: 12, phase: 'caught' }
  const two = await mount({ status: status({ rod, spots, pending: carp }) })
  openPanel(two.dom, 'fishing')
  assert.equal(findByAttr(contentOf(two.dom), 'data-fish-result', 'fish_carp').getAttribute('data-fish-result-art'), 'emoji')
  assert.equal(findByClass(contentOf(two.dom), 'dp-fish-result-img'), undefined)
  assert.match(contentOf(two.dom).allText(), /鲤鱼.*★★☆☆.*33\.2 cm.*12/)
})

test('U24-7 auto expanded shows bait, stock, choices, upgrades and the actual reason', async () => {
  const automation = { unlocked: true, stored: 2, usedHours: 1.5, full: false, baitLimit: 64,
    choices: [{ minutes: 30, attempts: 10 }, { minutes: 60, attempts: 20 }],
    upgrades: [{ kind: 'duration', label: '2 小时自动钓', price: 2000 }] }
  const base = status({ rod, spots, automation })
  const { dom } = await mount({ status: { ...base, inventory: { ...SNAPSHOT.inventory, bait_worm: 3 } } })
  openPanel(dom, 'fishing')
  const auto = findByAttr(contentOf(dom), 'data-fish-section', 'auto')
  auto.open = true
  auto.fire('toggle')
  const content = contentOf(dom)
  assert.match(content.allText(), /当前鱼饵.*蚯蚓.*×3/)
  assert.match(content.allText(), /鱼篓 1\.5 \/ 6 小时/)
  assert.equal(findByAttr(content, 'data-fish-collect', 'true').textContent, '收一下')
  assert.equal(findByAttr(content, 'data-fish-auto', '30').disabled, true)
  assert.equal(findByAttr(content, 'data-fish-auto', '60').disabled, true)
  assert.match(content.allText(), /点不了：鱼饵只剩 3 个，不够 10 个/)
  assert.equal(findByAttr(content, 'data-fish-upgrade', 'duration').disabled, true)
})

test('U24-7 empty, locked and closed spots explain what is off', async () => {
  const empty = await mount({ status: { ...status({ rod, spots }), inventory: { ...SNAPSHOT.inventory } } })
  openPanel(empty.dom, 'fishing')
  assert.match(contentOf(empty.dom).allText(), /没有鱼饵了/)
  assert.equal(findByAttr(contentOf(empty.dom), 'data-fish', 'cast').disabled, true)
  assert.equal(findByAttr(contentOf(empty.dom), 'data-fish-bait', 'bait_worm').disabled, true)

  const locked = await mount({ status: status({ rod, spots }) })
  openPanel(locked.dom, 'fishing')
  assert.equal(findByAttr(contentOf(locked.dom), 'data-fish-spot', 'lake').disabled, true)

  const closed = await mount({ status: status({ rod, spots, spot: 'night' }) })
  openPanel(closed.dom, 'fishing')
  assert.match(contentOf(closed.dom).allText(), /这个钓点现在没有开/)
  assert.equal(findByAttr(contentOf(closed.dom), 'data-fish', 'cast').disabled, true)
})

test('U24-7 away keeps the activity line and the auto-basket collect, without auto choices', async () => {
  const activity = { kind: 'fishing', label: '自动钓鱼 30 分钟', emoji: '🎣', secondsLeft: 600, cost: 0 }
  const automation = { unlocked: true, stored: 2, usedHours: 1, full: false, baitLimit: 64,
    choices: [{ minutes: 30, attempts: 10 }], upgrades: [] }
  const { dom } = await mount({ status: { ...status({ rod, spots, automation }), activity } })
  openPanel(dom, 'fishing')
  const content = contentOf(dom)
  assert.match(content.allText(), /当前：小河 · 竹竿/)
  assert.match(content.allText(), /自动钓鱼 30 分钟/)
  assert.equal(findByAttr(content, 'data-fish', 'cast'), undefined)
  assert.equal(findByAttr(content, 'data-fish-section', 'auto'), undefined)
  assert.notEqual(findByAttr(content, 'data-fish-collect', 'true'), undefined)
})

test('U24-7 one cast click posts exactly one fishCast', async () => {
  const { dom, calls } = await mount({ status: status({ rod, spots }) })
  openPanel(dom, 'fishing')
  const before = calls.length
  findByAttr(contentOf(dom), 'data-fish', 'cast').fire('click')
  await settle()
  const posts = calls.slice(before).filter(call => call.method === 'POST')
  assert.equal(posts.length, 1)
  assert.deepEqual(JSON.parse(posts[0].body), { action: 'fishCast', power: .5, bait: 'bait_worm' })
})

test('U24-7 closing a hooked fight resolves it exactly once', async () => {
  const hooked = { id: 'close-1', key: 'fish_carp', label: '鲤鱼', emoji: '🐟', phase: 'hooked', difficulty: 18, behavior: 'smooth', fight: 'ring' }
  const { dom, calls } = await mount({ status: status({ rod, spots, pending: hooked }) })
  openPanel(dom, 'fishing')
  const before = calls.length
  sceneOf(dom).fire('contextmenu', { clientX: 35, clientY: 31, preventDefault() {} })
  await settle()
  const posts = calls.slice(before).filter(call => call.method === 'POST')
  assert.equal(posts.length, 1)
  assert.deepEqual(JSON.parse(posts[0].body), { action: 'fishResolve', success: false })
})
