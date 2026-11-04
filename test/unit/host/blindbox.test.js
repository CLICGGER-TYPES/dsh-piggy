// 盲盒 2.1（照明日方舟寻访）：extensions/blindbox/server.js 的规矩。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import blindbox, { CATALOG, THEMES, banners, normalize, period, sixChance } from '../../../extensions/blindbox/server.js'

const T0 = Date.UTC(2026, 9, 6)

function fakeApi({ coins = 1_000_000, tickets = 0, now = T0 } = {}) {
  const said = []
  const bag = {}
  const api = {
    now,
    coins: () => coins,
    spend: n => { if (coins < n) return false; coins -= n; return true },
    earn: n => { coins += n },
    give: (key, n = 1) => { if (key === 'boxticket') tickets += n; else bag[key] = (bag[key] ?? 0) + n; return true },
    say: text => said.push(text),
    count: key => (key === 'boxticket' ? tickets : 0),
    take: (key, n = 1) => { if (key !== 'boxticket' || tickets < n) return false; tickets -= n; return true },
  }
  return { api, said, bag, left: () => coins, tickets: () => tickets }
}

/** 按顺序给出的随机数，用完就一直给最后一个。 */
const seq = (...values) => { let i = 0; return () => values[Math.min(i++, values.length - 1)] }

test('36 figures: 6 six-stars, 8 five-stars, 10 four-stars, 12 three-stars, and the 1.0 keys survive', () => {
  const count = stars => CATALOG.filter(entry => entry.stars === stars).length
  assert.deepEqual([count(6), count(5), count(4), count(3)], [6, 8, 10, 12])
  for (const key of ['chick', 'goldpig', 'whale', 'lantern', 'crab', 'ramen', 'tea']) assert.ok(CATALOG.some(entry => entry.key === key), key)
})

test('six-star chance: 2% for 50 pulls, then +2% a pull, certain on the 99th', () => {
  assert.equal(sixChance(0), 0.02)
  assert.equal(sixChance(49), 0.02)
  assert.ok(Math.abs(sixChance(50) - 0.04) < 1e-9)
  assert.equal(sixChance(98), 1)
})

test('99 unlucky pulls end on a six-star; standard and limited keep separate counters', () => {
  const data = blindbox.init()
  const { api } = fakeApi()
  for (let i = 0; i < 98; i += 1) blindbox.actions.open(data, { banner: 'standard', count: 1 }, api, () => 0.99)
  assert.equal(data.pity.standard, 98)
  assert.equal(data.pity.limited, 0)
  blindbox.actions.open(data, { banner: 'standard', count: 1 }, api, () => 0.99)
  assert.equal(data.last.items[0].stars, 6)
  assert.equal(data.pity.standard, 0)
})

test('rates come out near 2 / 8 / 50 / 40 over many pulls', () => {
  const data = blindbox.init()
  const { api } = fakeApi({ coins: 1e9 })
  const tally = { 3: 0, 4: 0, 5: 0, 6: 0 }
  let state = 7
  const random = () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648 }
  for (let i = 0; i < 2000; i += 1) {
    blindbox.actions.open(data, { banner: 'standard', count: 10 }, api, random)
    for (const got of data.last.items) tally[got.stars] += 1
  }
  const total = 20000
  assert.ok(Math.abs(tally[3] / total - 0.40) < 0.02, JSON.stringify(tally))
  assert.ok(Math.abs(tally[4] / total - 0.50) < 0.02, JSON.stringify(tally))
  assert.ok(Math.abs(tally[5] / total - 0.08) < 0.01, JSON.stringify(tally))
  assert.ok(tally[6] / total > 0.02 && tally[6] / total < 0.035, JSON.stringify(tally)) // 保底会把 6★ 拉到 2% 以上
})

test('a limited six-star is the featured one 70% of the time', () => {
  const [, limited] = banners(T0)
  const data = blindbox.init()
  const { api } = fakeApi()
  blindbox.actions.open(data, { banner: 'limited', count: 1 }, api, seq(0.001, 0.5))
  assert.equal(data.last.items[0].key, limited.up6[0])
  blindbox.actions.open(data, { banner: 'limited', count: 1 }, api, seq(0.001, 0.8, 0))
  assert.notEqual(data.last.items[0].key, limited.up6[0])
})

test('banners rotate every 14 days: the limited theme cycles, the standard UP never equals it', () => {
  assert.equal(period(T0).index, 0)
  const later = T0 + 14 * 86_400_000
  assert.equal(period(later).index, 1)
  assert.equal(banners(T0)[1].label.includes(THEMES[0].label), true)
  assert.equal(banners(later)[1].label.includes(THEMES[1].label), true)
  for (let i = 0; i < 12; i += 1) {
    const [standard, limited] = banners(T0 + i * 14 * 86_400_000)
    assert.notEqual(standard.up6[0], limited.up6[0])
  }
})

test('duplicates raise potential up to 6 and pay certificates, doubled once maxed', () => {
  const data = blindbox.init()
  const { api } = fakeApi()
  // 6★ 掷中，非 UP，池子第一个 → 每次同一个
  for (let i = 0; i < 8; i += 1) blindbox.actions.open(data, { banner: 'standard', count: 1 }, api, seq(0.001, 0.9, 0))
  const key = data.last.items[0].key
  assert.equal(data.owned[key], 6)
  assert.equal(data.certs, 5 * 40 + 2 * 80)
})

test('the certificate shop sells tickets and a chosen missing five-star', () => {
  const data = blindbox.init()
  data.certs = 200
  const { api, tickets } = fakeApi()
  assert.equal(blindbox.actions.buy(data, { item: 'ticket' }, api).ok, true)
  assert.equal(tickets(), 1)
  assert.equal(blindbox.actions.buy(data, { item: 'pick5', pick: 'panda' }, api).ok, true)
  assert.equal(data.owned.panda, 1)
  assert.equal(data.certs, 200 - 20 - 120)
  assert.equal(blindbox.actions.buy(data, { item: 'pick5', pick: 'panda' }, api).reason, 'no-certs')
})

test('1.0 data moves over: figures kept as potential, shards become certificates', () => {
  const old = { series: { farm: { pulls: 12, since: 12, shards: 7, have: { chick: 3, goldpig: 1 } }, night: { have: { tea: 9 }, shards: 1 } }, last: null, seq: 4 }
  normalize(old)
  assert.equal(old.v, 2)
  assert.deepEqual(old.owned, { chick: 3, goldpig: 1, tea: 6 })
  assert.equal(old.certs, 16)
  assert.deepEqual(old.pity, { standard: 0, limited: 0 })
})

test('a ticket pulls once for free; the view has both banners and the whole catalog', () => {
  const data = blindbox.init()
  const t = fakeApi({ coins: 0, tickets: 1 })
  assert.equal(blindbox.actions.open(data, { banner: 'standard', count: 1, ticket: true }, t.api, () => 0.5).ok, true)
  assert.equal(blindbox.actions.open(data, { banner: 'standard', count: 1 }, t.api).reason, 'poor')
  const view = blindbox.view(data, t.api)
  assert.equal(view.banners.length, 2)
  assert.equal(view.catalog.length, 36)
  assert.equal(view.banners[0].pityLeft, 49)
})

test('H2 凭证货架和摆件图鉴来自同一份盲盒数据', () => {
  const data = blindbox.init()
  data.certs = 150
  data.owned.fox = 2
  const view = blindbox.view(data, fakeApi().api)
  assert.equal(view.shelf.currency.balance, 150)
  assert.equal(view.shelf.items.length, 5)
  assert.equal(view.shelf.items.find(item => item.key === 'pick6').disabled, true)
  assert.equal(view.shelf.items.find(item => item.key === 'pick5').pick.some(item => item.key === 'fox'), false)
  assert.equal(view.dex.entries.length, 36)
  assert.equal(view.dex.entries.find(item => item.key === 'fox').potential, 2)
  assert.equal(view.dex.entries.find(item => item.key === 'fox').acquired, true)
})
