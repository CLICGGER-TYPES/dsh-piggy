// @ts-check
/**
 * 轮询短路：菜园快照里「每 4 秒都在变、画面上看不出来」的字段不该触发重绘；
 * 真该看到的变化一个都不能漏（漏了界面就停在旧数字上）。
 *
 * 这里用真的 farm.view() 造快照，所以菜园以后给 view 加了新的「一直在动」的字段，
 * 第一个测试会当场失败——提醒把字段加进 poll-key.js 的表。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import farm from '../extensions/farm/server.js'
import { pollKey } from '../src/client/poll-key.js'
import { SNAPSHOT } from './helpers/bundle.js'
import { api, establishedFarm, H, T0 } from './helpers/farm-ui.js'

/** 三样灾害都不在（1e15 是「很久以后」）。 */
const NO_PEST = 1e15

/** 大农场一屏：18 块地，第 10 块 7 小时前下的种（还剩 7 小时），帮工雇着。 */
function farmData() {
  const data = establishedFarm()
  data.unlocked = 18
  data.plots[10] = { crop: 'radish', season: 1, plantedAt: T0 - 7 * H, boostMs: 0, roll: 0, pests: { weed: NO_PEST, bug: NO_PEST, dry: NO_PEST } }
  data.helper = { hired: true, level: 1, barn: 0, usedMs: 0, lastAt: T0, stock: { radish: 12 } }
  return data
}

/** 宿主 /state 的形状：extViews 里放真的 farm.view。 */
function snapshotAt(data, at) {
  const t = api()
  t.now = at
  return { ...structuredClone(SNAPSHOT), extViews: { farm: farm.view(data, t) } }
}

test('菜园：4 秒后只有看不到的字段在动 → 指纹不变（不重画）', () => {
  const now = snapshotAt(farmData(), T0)
  const later = snapshotAt(farmData(), T0 + 4000)
  assert.notEqual(JSON.stringify(now), JSON.stringify(later), '宿主正文确实变了：时间戳 / 生长期 / 帮工计时')
  assert.equal(pollKey(now), pollKey(later))
})

test('菜园：跨过一分钟、跨过一个小时 → 指纹变了（画面上真会变）', () => {
  const now = snapshotAt(farmData(), T0)
  assert.notEqual(pollKey(now), pollKey(snapshotAt(farmData(), T0 + 60000)), '剩余时间少一分钟，悬停卡上的字就变了')
  assert.notEqual(pollKey(now), pollKey(snapshotAt(farmData(), T0 + 3600000)), '背景按小时换')
})

test('菜园：真该看到的变化一个都不能漏', () => {
  const base = snapshotAt(farmData(), T0)
  const cases = {
    余额: s => { s.extViews.farm.balance += 1 },
    等级经验: s => { s.extViews.farm.exp += 5000 },
    种子数: s => { s.extViews.farm.seeds[0].count += 1 },
    收成数: s => { s.extViews.farm.harvest[0].count += 1 },
    熟了: s => { s.extViews.farm.plots[10].ripe = true },
    长草: s => { s.extViews.farm.plots[10].pests = ['weed'] },
    天气: s => { s.extViews.farm.weather = s.extViews.farm.weather === 'rain' ? 'sunny' : 'rain' },
    工具到手: s => { s.extViews.farm.tools[0].owned = true },
    帮工谷仓: s => { s.extViews.farm.helper.stored += 1 },
    开了新地: s => { s.extViews.farm.unlocked += 1 },
    金币: s => { s.pig.coins += 1 },
    饱食度: s => { s.pig.satiety -= 1 },
  }
  for (const [label, mutate] of Object.entries(cases)) {
    const changed = snapshotAt(farmData(), T0)
    mutate(changed)
    assert.notEqual(pollKey(base), pollKey(changed), label + ' 变了却没重画')
  }
})

test('别的扩展的 view 一点不压：它有变化就重画', () => {
  assert.equal(pollKey({ extViews: { mine: { now: T0 } } }), pollKey({ extViews: { mine: { now: T0 } } }))
  assert.notEqual(pollKey({ extViews: { mine: { now: T0 } } }), pollKey({ extViews: { mine: { now: T0 + 1 } } }))
})

test('压到什么精度：就是界面画出来的精度', () => {
  const view = patch => ({ extViews: { farm: Object.assign({ now: T0, remainingMs: 25200000, progress: 0.5, usedHours: 0.25 }, patch) } })
  const base = pollKey(view({}))
  // 时间戳只按小时看：4 秒不算变，跨一小时才算
  assert.equal(pollKey(view({ now: T0 + 4000 })), base)
  assert.notEqual(pollKey(view({ now: T0 + 3600000 })), base)
  // 剩余时间按分钟向上取整（和 shortTime 一样）
  assert.equal(pollKey(view({ remainingMs: 25200000 - 4000 })), base)
  assert.notEqual(pollKey(view({ remainingMs: 25200000 - 60000 })), base)
  // 进度按整百分比画（悬停卡进度条）
  assert.equal(pollKey(view({ progress: 0.5001 })), base)
  assert.notEqual(pollKey(view({ progress: 0.51 })), base)
  // 帮工计时画面上没有（谷仓按个数报）
  assert.equal(pollKey(view({ usedHours: 3.25 })), base)
})

test('没有 extViews 或不是对象也不炸', () => {
  assert.equal(pollKey({ ok: true }), pollKey({ ok: true }))
  assert.notEqual(pollKey({ ok: true }), pollKey({ ok: false }))
  assert.equal(typeof pollKey({ extViews: null }), 'string')
  assert.equal(typeof pollKey('x'), 'string')
})
