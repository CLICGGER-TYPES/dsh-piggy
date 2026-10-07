// @ts-check
/**
 * B6 台词接线：哪件事说哪个场景、闲聊的优先级、免打扰、称呼。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { act, applyDevPatch, chat, hatchEgg, setOwnerName, setQuiet, startWork } from '../core.js'
import { LINES, xpForLevel } from '../data.js'
import { finishTrip, finishWork } from '../packages/pet-core/src/core/settlement.js'
import { grow } from '../packages/pet-core/src/core/growth.js'

const T0 = Date.parse('2026-10-01T09:00:00')
const MIN = 60_000
const lastScene = pig => [...pig.pending].reverse().find(entry => entry.kind === 'line')?.scene ?? null
const wellPig = () => Object.assign(hatchEgg(T0), { satiety: 80, cleanliness: 80, happiness: 80 })

// 「代码里点名的场景台词表里都有」由 test/lines-guard.test.js 扫源码检查，不在这里手写场景清单。

test('feeding a stuffed pig gets the overfull line, a hungry one the eating line', () => {
  const stuffed = wellPig()
  stuffed.satiety = 100
  stuffed.inventory = { apple: 1 }
  act(stuffed, 'feed', T0 + 1)
  assert.equal(lastScene(stuffed) === 'overfull' || stuffed.illness !== null, true)
  // G2：95～99 时喂是正常吃，加满到 100 说「吃饱啦」，不算硬塞。
  const nearlyFull = wellPig()
  nearlyFull.satiety = 97
  nearlyFull.inventory = { apple: 1 }
  act(nearlyFull, 'feed', T0 + 1)
  assert.equal(lastScene(nearlyFull), 'full')
  assert.equal(nearlyFull.illness, null)
  const hungry = wellPig()
  hungry.satiety = 40
  hungry.inventory = { apple: 1 }
  act(hungry, 'feed', T0 + 1)
  assert.equal(lastScene(hungry), 'eat')
})

test('coming home from work says so, and complains after too many shifts in a row', () => {
  const pig = wellPig()
  finishWork(pig, { kind: 'work', key: 'bricks' }, T0, () => 0.99)
  assert.equal(lastScene(pig), 'workDone')
  finishWork(pig, { kind: 'work', key: 'bricks' }, T0, () => 0.99)
  finishWork(pig, { kind: 'work', key: 'bricks' }, T0, () => 0.99)
  assert.equal(lastScene(pig), 'tired')
})

test('a trip ends with the pig showing what it brought', () => {
  const pig = wellPig()
  finishTrip(pig, { kind: 'trip', key: 'suburb' }, T0)
  assert.equal(lastScene(pig), 'tripBack')
})

test('growing into a new body gets its own line', () => {
  const pig = wellPig()
  pig.xp = xpForLevel(10) - 1
  grow(pig, 5, T0)
  assert.equal(pig.stage, 'young')
  assert.equal(lastScene(pig), 'growUp')
})

test('coming back from the dead says so', () => {
  const pig = wellPig()
  applyDevPatch(pig, { dead: true }, T0)
  applyDevPatch(pig, { dead: false }, T0 + MIN)
  assert.equal(lastScene(pig), 'revive')
})

test('idle chatter says what the pig needs first, and only then chats', () => {
  const at = patch => {
    const pig = Object.assign(wellPig(), patch)
    chat(pig, 'idle', T0)
    return lastScene(pig)
  }
  assert.equal(at({ satiety: 10 }), 'hungry')
  assert.equal(at({ cleanliness: 10 }), 'dirty')
  assert.equal(at({ happiness: 10 }), 'lonely')
  assert.equal(at({}), 'idle')
})

test('the pig keeps quiet when away, ill, dead, a box, or on 免打扰', () => {
  const away = wellPig()
  assert.equal(startWork(away, 'bricks', T0).ok, true)
  assert.equal(chat(away, 'idle', T0).reason, 'silent')
  const ill = Object.assign(wellPig(), { illness: { chain: 0, stage: 1, since: T0, progressMs: 0 }, health: 4 })
  assert.equal(chat(ill, 'idle', T0).reason, 'silent')
  const quiet = wellPig()
  setQuiet(quiet, true)
  assert.equal(chat(quiet, 'idle', T0).reason, 'silent')
  assert.equal(chat(quiet, 'enter', T0).reason, 'silent')
  setQuiet(quiet, false)
  assert.equal(chat(quiet, 'idle', T0).ok, true)
})

test('the welcome back only comes after half an hour away', () => {
  const pig = wellPig()
  assert.equal(chat(pig, 'enter', T0).ok, true)
  assert.equal(chat(pig, 'enter', T0 + 10 * MIN).reason, 'silent', 'a reload is not a return')
  assert.equal(chat(pig, 'enter', T0 + 31 * MIN).ok, true)
})

test('the owner can be called something else, and the lines use it', () => {
  const pig = wellPig()
  pig.catchphrase = '' // the catchphrase has its own test
  assert.equal(setOwnerName(pig, '   ').reason, 'empty')
  assert.deepEqual(setOwnerName(pig, '  小明同学今天也在加班吗真的吗  '), { ok: true, ownerName: '小明同学今天也在加班吗真' })
  setOwnerName(pig, '小明')
  pig.dialogue.lastByScene = {}
  chat(pig, 'enter', T0)
  const said = [...pig.pending].reverse().find(entry => entry.kind === 'line')
  assert.ok(!said.text.includes('[主人]'))
  assert.ok(LINES.enter.some(candidate => candidate.text.split('[主人]').join('小明') === said.text))
})
