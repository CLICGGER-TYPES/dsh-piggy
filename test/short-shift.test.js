// 10 分钟短班（J1 第 1 节）：时长、金币、饱食、清洁都按比例；不算「完整一班」。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { decay, hatchEgg, migrate, startWork } from '../packages/pet-core/src/core.js'
import { JOBS, SHORT_SHIFT_MINUTES, SKINS, jobByKey } from '../packages/pet-core/src/data.js'
import { SNAPSHOT, contentOf, findByAttr, hostOf, mount, openPanel, settle } from './helpers/bundle.js'

const T0 = new Date(2026, 9, 9, 9, 0).getTime()

test('短班 10 分钟，钱按时长比例给，时薪跟整班一样', () => {
  const job = jobByKey('bricks')
  const pig = hatchEgg(T0)
  const coins = pig.coins
  assert.equal(startWork(pig, 'bricks', T0, true).ok, true)
  assert.equal(pig.activity.endsAt - pig.activity.startedAt, SHORT_SHIFT_MINUTES * 60_000)
  assert.equal(pig.activity.label, '搬砖（短班）')
  decay(pig, pig.activity.endsAt + 1000)
  assert.equal(pig.activity, null)
  assert.equal(pig.coins - coins, Math.round(job.coins * SHORT_SHIFT_MINUTES / job.minutes))
})

test('短班不进打工次数、不解锁职业外观、不算连续出门', () => {
  const pig = hatchEgg(T0)
  pig.level = 60
  pig.xp = 10_000_000
  pig.lessons = { mathematics: 95, pe: 95, wushu: 40, chinese: 95, manners: 95, politics: 40 }
  const astronaut = SKINS.find(skin => 'unlockJob' in skin && skin.unlockJob === 'astronaut')
  let clock = T0
  for (let i = 0; i < 4; i += 1) {
    pig.satiety = 100
    pig.cleanliness = 100
    assert.equal(startWork(pig, 'astronaut', clock, true).ok, true, `shift ${i}`)
    clock = pig.activity.endsAt + 1000
    decay(pig, clock)
  }
  assert.equal(pig.stats.jobs, 0)
  assert.equal(pig.stats.shortShifts, 4)
  assert.equal(pig.outingStreak ?? 0, 0)
  assert.equal(pig.dex.skins[astronaut.key], undefined, 'a 10-minute shift is not 当过宇航员')
  // 饱食和清洁也按比例扣：宇航员整班 8 小时，短班只扣 1/48。
  const job = jobByKey('astronaut')
  assert.ok(pig.satiety >= 100 + Math.round(job.satiety * SHORT_SHIFT_MINUTES / job.minutes) - 6)
})

test('整班照旧；存档里的短班比例原样保留，乱写的丢掉', () => {
  const pig = hatchEgg(T0)
  startWork(pig, 'bricks', T0)
  assert.equal(pig.activity.share, undefined)
  decay(pig, pig.activity.endsAt + 1000)
  assert.equal(pig.stats.jobs, 1)
  const saved = hatchEgg(T0)
  startWork(saved, 'bricks', T0, true)
  assert.equal(migrate(JSON.parse(JSON.stringify(saved)), T0).activity.share, saved.activity.share)
  saved.activity.share = 7
  assert.equal(migrate(JSON.parse(JSON.stringify(saved)), T0).activity.share, undefined)
  for (const job of JOBS) assert.ok(job.minutes >= SHORT_SHIFT_MINUTES, `${job.key} is at least a short shift long`)
})

test('打工详情里有短班按钮，发出去带 short', async () => {
  const job = { key: 'bricks', label: '搬砖', emoji: '🧱', trait: 'strong', minutes: 30, coins: 40, shortMinutes: 10, shortCoins: 13, available: true, qualified: true, requirements: [], traitEmoji: '💪', traitLabel: '武力', traitPoints: 0, payPercent: 0, satiety: -6, cleanliness: -4 }
  const { dom, calls } = await mount({ status: { ...SNAPSHOT, jobs: [job] } })
  openPanel(dom, 'work')
  findByAttr(contentOf(dom), 'data-skill', 'strong').fire('click')
  findByAttr(contentOf(dom), 'data-job-tile', 'bricks').fire('click')
  const quick = findByAttr(hostOf(dom), 'data-job-short', 'bricks')
  assert.match(quick.allText(), /短班 10 分钟 · 13/)
  quick.fire('click')
  await settle()
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'work', job: 'bricks', short: true })
  const old = await mount({ status: { ...SNAPSHOT, jobs: [{ ...job, shortMinutes: 0 }] } })
  openPanel(old.dom, 'work')
  findByAttr(contentOf(old.dom), 'data-skill', 'strong').fire('click')
  findByAttr(contentOf(old.dom), 'data-job-tile', 'bricks').fire('click')
  assert.equal(findByAttr(hostOf(old.dom), 'data-job-short', 'bricks'), undefined, 'an old host has no short shift')
})
