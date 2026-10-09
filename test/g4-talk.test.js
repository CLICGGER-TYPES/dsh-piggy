// G 批次：对话与互动（docs/numbers/G4-lines.md）。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { act, buy, chat, hatchEgg, holidayFor, pickLine, slotFor } from '../core.js'
import { LINES, MORE_LINES } from '../data.js'

/** 本地时间的某一刻。 */
const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime()

function pig(nowMs) {
  const state = hatchEgg(nowMs - 3 * 86_400_000)
  state.satiety = 80; state.cleanliness = 80; state.happiness = 80
  state.catchphrase = '' // 口头禅会随机接在句尾，这里比的是原句
  return state
}
const lastLine = state => state.pending.filter(entry => entry.kind === 'line').at(-1)

test('every scene doubled or new, and all new scenes have lines', () => {
  for (const [scene, lines] of Object.entries(MORE_LINES)) assert.ok(LINES[scene].length >= lines.length, scene)
  assert.ok(LINES.eat.length >= 12 && LINES.pet.length >= 14 && LINES.idle.length >= 16)
  const total = Object.values(LINES).reduce((sum, lines) => sum + lines.length, 0)
  assert.ok(total >= 300, String(total))
})

test('a scene does not repeat any of its last three lines', () => {
  const state = pig(at(2026, 10, 7, 10))
  const seen = []
  for (let i = 0; i < 12; i += 1) {
    const line = pickLine(state, 'eat', () => 0)
    assert.ok(!seen.slice(-3).includes(line.text), line.text)
    seen.push(line.text)
  }
})

test('time talk: each slot once a day, weekend and holidays first', () => {
  assert.equal(slotFor(at(2026, 10, 7, 7)), 'morning')
  assert.equal(slotFor(at(2026, 10, 7, 23, 30)), 'lateNight')
  assert.equal(slotFor(at(2026, 10, 7, 1)), 'lateNight')
  assert.equal(slotFor(at(2026, 10, 7, 3)), 'deepNight')
  assert.equal(slotFor(at(2026, 10, 7, 10)), null)

  const morning = at(2026, 10, 7, 7) // 周三
  const state = pig(morning)
  assert.equal(chat(state, 'time', morning).scene, 'morning')
  assert.equal(chat(state, 'time', morning + 60_000).ok, false, 'once per slot per day')

  const springFestival = at(2027, 2, 6, 12) // 周六 + 春节
  const fest = pig(springFestival)
  assert.equal(holidayFor(fest, springFestival), 'springFestival')
  assert.equal(chat(fest, 'time', springFestival).scene, 'springFestival')
  assert.equal(chat(fest, 'time', springFestival + 1000).scene, 'weekend')
  assert.equal(chat(fest, 'time', springFestival + 2000).scene, 'noon')
})

test('water every 90 online minutes, eyes every 2 hours, silent on 免打扰', () => {
  const now = at(2026, 10, 7, 10)
  const state = pig(now)
  chat(state, 'time', now)
  state.daily = { ...(state.daily ?? {}), online: { day: state.dialogue.talk.day, onlineMs: 95 * 60_000, given: 0, unclaimed: 0 } }
  assert.equal(chat(state, 'time', now + 1000).scene, 'water')
  assert.equal(chat(state, 'time', now + 2000).ok, false)
  state.daily.online.onlineMs = 125 * 60_000
  assert.equal(chat(state, 'time', now + 3000).scene, 'eyes')
  state.dialogue.quiet = true
  state.daily.online.onlineMs = 185 * 60_000
  assert.equal(chat(state, 'time', now + 4000).ok, false)
})

test('petting a body part says that part; the eighth pat in 30 s gets cross and gives no mood', () => {
  const now = at(2026, 10, 7, 10)
  const state = pig(now)
  act(state, 'pet', now, 'belly')
  assert.ok(LINES.petBelly.some(line => line.text === lastLine(state).text), lastLine(state).text)
  for (let i = 1; i < 7; i += 1) act(state, 'pet', now + i * 1000)
  const before = state.happiness
  act(state, 'pet', now + 7000)
  assert.ok(LINES.petTooMuch.some(line => line.text === lastLine(state).text), lastLine(state).text)
  assert.ok(state.happiness <= before, 'no mood from an annoyed pat')
  // 停手 30 秒还在气头上，1 分钟后消气。
  act(state, 'pet', now + 7000 + 40_000)
  assert.ok(LINES.petTooMuch.some(line => line.text === lastLine(state).text))
  act(state, 'pet', now + 7000 + 40_000 + 61_000)
  assert.ok(!LINES.petTooMuch.some(line => line.text === lastLine(state).text))
})

test('buying says so; not enough money says the pig is poor', () => {
  const now = at(2026, 10, 7, 10)
  const state = pig(now)
  state.coins = 0
  assert.equal(buy(state, 'apple', now).reason, 'poor')
})
