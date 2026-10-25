// @ts-check
/**
 * 台词框架：按场景挑台词、放进消息队列、主人回复。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { act, hatchEgg, pickLine, replyToLine, say } from '../core.js'
import { LINES, LINE_SCENES, REPLY_HAPPINESS } from '../data.js'
import { announce } from '../packages/pet-core/src/core/effects.js'

const T0 = 1_700_000_000_000
const sequence = values => {
  let index = 0
  return () => values[index++ % values.length]
}

test('every scene has at least one line, and replies are well-formed', () => {
  assert.ok(LINE_SCENES.length >= 10)
  for (const scene of LINE_SCENES) {
    assert.ok(LINES[scene].length > 0, `${scene} has no lines`)
    for (const line of LINES[scene]) {
      assert.ok(line.text.trim().length > 0)
      for (const reply of line.replies ?? []) assert.ok(reply.label.trim().length > 0)
    }
  }
})

test('the same line is never picked twice in a row, and [主人] is filled in', () => {
  const pig = hatchEgg(T0)
  pig.personality = 'peppy'
  pig.dialogue.ownerName = '小明'
  pig.catchphrase = '' // the catchphrase has its own test below
  const always = () => 0
  const first = pickLine(pig, 'pet', always)
  const second = pickLine(pig, 'pet', always)
  assert.notEqual(first?.text, second?.text)
  const hello = pickLine(pig, 'enter', always)
  assert.equal(hello?.text, '小明你回来啦！')
  // 未知场景：正式运行时不说话（返回 null）；测试里 strict-lines.js 让它直接抛错，免得写错场景名没人发现
  assert.throws(() => pickLine(pig, 'no-such-scene', always), /unknown line scene/)
})

test('messages from the same instant each get their own increasing id', () => {
  const pig = hatchEgg(T0)
  const worse = announce(pig, 'worse', '病情加重', T0)
  const death = announce(pig, 'death', '走了', T0)
  assert.ok(death.id > worse.id)
  assert.equal(pig.pending.at(-1).id, death.id)
})

test('a line with replies can be answered once, for a little happiness', () => {
  const pig = hatchEgg(T0)
  pig.happiness = 50
  pig.personality = 'peppy'
  const eligible = LINES.pet.filter(line => !line.personalities || line.personalities.includes(pig.personality))
  // Index 1 stays 「再摸摸～」 as the pool grows; use its index rather than a fixed random fraction.
  assert.equal(say(pig, 'pet', T0, sequence([1.5 / eligible.length])), true)
  const line = pig.pending.at(-1)
  assert.equal(line.kind, 'line')
  assert.deepEqual(line.replies, ['好'])

  assert.deepEqual(replyToLine(pig, line.id, 0), { ok: true, reply: '好' })
  assert.equal(pig.happiness, 50 + REPLY_HAPPINESS)
  assert.equal(replyToLine(pig, line.id, 0).ok, false, 'no second helping')
  assert.equal(pig.happiness, 50 + REPLY_HAPPINESS)
})

test('only the newest line can be answered', () => {
  const pig = hatchEgg(T0)
  say(pig, 'eat', T0, () => 0)
  const old = pig.pending.at(-1)
  say(pig, 'sick', T0, () => 0)
  assert.deepEqual(replyToLine(pig, old.id, 0), { ok: false, reason: 'stale-line' })
})

test('care actions make the pig speak', () => {
  const pig = hatchEgg(T0)
  const result = act(pig, 'pet', T0 + 1000)
  assert.equal(result.ok, true)
  const line = pig.pending.find(entry => entry.kind === 'line')
  assert.ok(line !== undefined, 'petting queued a line')
  assert.ok(LINES.pet.some(candidate => candidate.text.split('[主人]').join('主人') === line.text), line.text)
})

test('a valid reply records interaction without adding a pet or a wake line', async () => {
  const { mood } = await import('../core.js')
  const now = T0 + 31 * 60_000
  const pig = hatchEgg(T0)
  pig.personality = 'peppy'
  pig.happiness = 50
  const pool = LINES.pet.filter(line => !line.personalities || line.personalities.includes('peppy'))
  const index = pool.findIndex(line => line.replies?.length)
  say(pig, 'pet', now, () => (index + .5) / pool.length)
  const line = pig.pending.at(-1), pending = pig.pending.length, pets = pig.stats.pets
  assert.notEqual(mood(pig, now).key, 'sleepy')
  const happiness = pig.happiness
  assert.equal(replyToLine(pig, line.id, 0, now).ok, true)
  assert.equal(pig.lastActiveAt, now)
  assert.notEqual(mood(pig, now).key, 'sleepy')
  assert.equal(pig.stats.pets, pets)
  assert.equal(pig.pending.length, pending + 1, 'accepted replies add one follow-up without a wake line')
  assert.equal(pig.pending.at(-1).kind, 'line')
  assert.deepEqual(pig.pending.at(-1).replies, [])
  assert.equal(pig.happiness, happiness + REPLY_HAPPINESS)
  assert.equal(replyToLine(pig, line.id, 0, now + 1000).reason, 'stale-line')
  assert.equal(pig.lastActiveAt, now, 'duplicate replies do not count as new interactions')
})

test('invalid and expired replies do not refresh activity', () => {
  const now = T0 + 31 * 60_000
  const pig = hatchEgg(T0)
  pig.personality = 'peppy'
  const pool = LINES.pet.filter(line => !line.personalities || line.personalities.includes('peppy'))
  const index = pool.findIndex(line => line.replies?.length)
  say(pig, 'pet', now, () => (index + .5) / pool.length)
  const id = pig.dialogue.open.id
  assert.equal(replyToLine(pig, id + 1, 0, now).reason, 'stale-line')
  assert.equal(replyToLine(pig, id, 1000, now).reason, 'unknown')
  assert.equal(pig.lastActiveAt, T0)
  pig.dead = true
  assert.equal(replyToLine(pig, id, 0, now).reason, 'dead')
  assert.equal(pig.lastActiveAt, T0)
})
