// @ts-check
/**
 * B4 学习 → 职业：九门课各算课时、毕业、33 种职业的门槛、证书、掉落、旧存档折算。
 * 数字对照 docs/numbers/B4-study-jobs.md。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { decay, hatchEgg, jobFacts, migrate, startStudy, startWork, studyView } from '../core.js'
import { JOBS, SUBJECTS, jobByKey, jobRequirement, stageForNextLesson, subjectByKey, xpForLevel } from '../data.js'
import { finishInterest, finishStudy, finishWork } from '../packages/pet-core/src/core/settlement.js'

const T0 = Date.parse('2026-10-01T09:00:00')
const never = () => 0.99

/** A pig with a level and some lessons, ready to test a gate. */
function schooled(level, lessons = {}, interests = {}) {
  const pig = hatchEgg(T0)
  pig.xp = xpForLevel(level)
  pig.lessons = { ...lessons }
  pig.interests = { ...interests }
  pig.coins = 100_000
  return pig
}

test('nine subjects, each feeding a trait (and some a second one)', () => {
  assert.deepEqual(SUBJECTS.map(subject => subject.label), ['语文', '数学', '政治', '音乐', '艺术', '礼仪', '体育', '劳技', '武术'])
  assert.equal(subjectByKey('chinese').secondary, 'charm')
  assert.equal(subjectByKey('wushu').secondary, null)
})

test('a subject is in the stage its own lesson count says, independently of the others', () => {
  const at = taken => stageForNextLesson(taken)
  assert.deepEqual([at(0).label, at(8).label, at(9).label, at(20).label, at(40).label, at(95).label],
    ['小学', '小学', '中学', '大学', '研究生', '学无止境'])
  assert.deepEqual([at(0).minutes, at(9).minutes, at(20).minutes, at(40).minutes], [20, 30, 45, 60])
  assert.deepEqual([at(0).tuition, at(9).tuition, at(20).tuition, at(40).tuition, at(95).tuition], [10, 25, 60, 120, 150])
  const view = studyView(schooled(1, { chinese: 12 }))
  assert.equal(view.find(entry => entry.key === 'chinese').stage.label, '中学')
  assert.equal(view.find(entry => entry.key === 'mathematics').stage.label, '小学')
  assert.equal(view.find(entry => entry.key === 'chinese').nextGraduation, 20)
})

test('a lesson counts, costs its tuition, and pays both traits', () => {
  const pig = schooled(1, { chinese: 10 })
  const coins = pig.coins
  assert.equal(startStudy(pig, 'chinese', null, T0).ok, true)
  assert.equal(pig.coins, coins - 25, '中学 tuition')
  finishStudy(pig, pig.activity, T0, never)
  assert.equal(pig.lessons.chinese, 11)
  assert.equal(pig.traits.intel, 2, '中学: main +2')
  assert.equal(pig.traits.charm, 1, 'and 语文 also gives 魅力 +1')
})

test('the ninth lesson is a graduation: three gifts, extra growth, 我没有留级', () => {
  const pig = schooled(1, { mathematics: 8 })
  const growthBefore = pig.xp
  const bagBefore = Object.values(pig.inventory).reduce((sum, count) => sum + count, 0)
  finishStudy(pig, { kind: 'study', key: 'mathematics', stage: 'primary' }, T0, never)
  assert.equal(pig.lessons.mathematics, 9)
  const bagAfter = Object.values(pig.inventory).reduce((sum, count) => sum + count, 0)
  assert.equal(bagAfter - bagBefore, 3)
  assert.equal(pig.xp - growthBefore, 40 + 500)
  assert.ok(pig.pending.some(entry => entry.kind === 'graduate'))
  assert.ok(pig.pending.some(entry => entry.kind === 'line' && entry.scene === 'graduate'), 'the pig says a graduation line')
})

test('thirty-three jobs: the original eighteen plus fifteen, all gates well formed', () => {
  assert.equal(JOBS.length, 33)
  assert.equal(new Set(JOBS.map(job => job.key)).size, 33)
  for (const job of JOBS) {
    for (const key of Object.keys(job.requires.lessons ?? {})) assert.ok(subjectByKey(key) !== null, `${job.key}: ${key}`)
    assert.ok(job.requires.level >= 1 && job.requires.level <= 60, job.key)
  }
  // Pay per hour climbs by tier: start ~80, top ~700.
  const perHour = key => jobByKey(key).coins / (jobByKey(key).minutes / 60)
  assert.equal(perHour('bricks'), 80)
  assert.ok(perHour('ceo') >= 600)
})

test('the gate is level + lessons (+ certificate), and names everything missing', () => {
  const fresh = schooled(1)
  const refused = startWork(fresh, 'cashier', T0)
  assert.equal(refused.reason, 'underqualified')
  assert.deepEqual(refused.missing.map(entry => entry.text), ['Lv.5', '🔢数学 9 节'])
  assert.equal(fresh.activity, null, 'nothing started')

  assert.equal(startWork(schooled(5, { mathematics: 9 }), 'cashier', T0).ok, true)

  const noCert = jobRequirement(jobByKey('photographer'), jobFacts(schooled(18, { art: 40 })))
  assert.deepEqual(noCert.missing.map(entry => entry.kind), ['certificate'])
  const certified = jobRequirement(jobByKey('photographer'), jobFacts(schooled(18, { art: 40 }, { photography: 5 })))
  assert.equal(certified.ok, true)
})

test('公务员 wants every subject at 40; 大学教授 any three at 95', () => {
  const all39 = Object.fromEntries(SUBJECTS.map(subject => [subject.key, 39]))
  assert.equal(jobRequirement(jobByKey('official'), jobFacts(schooled(35, all39))).ok, false)
  const all40 = Object.fromEntries(SUBJECTS.map(subject => [subject.key, 40]))
  assert.equal(jobRequirement(jobByKey('official'), jobFacts(schooled(35, all40))).ok, true)
  assert.equal(jobRequirement(jobByKey('professor'), jobFacts(schooled(40, { music: 95, art: 95 }))).ok, false)
  assert.equal(jobRequirement(jobByKey('professor'), jobFacts(schooled(40, { music: 95, art: 95, pe: 95 }))).ok, true)
})

test('traits no longer gate a job, they only scale its pay', () => {
  const plain = schooled(1)
  const strong = schooled(1)
  strong.traits = { intel: 0, charm: 0, strong: 150 }
  finishWork(plain, { kind: 'work', key: 'bricks' }, T0, never)
  finishWork(strong, { kind: 'work', key: 'bricks' }, T0, never)
  assert.equal(plain.coins - 100_000, 40)
  assert.equal(strong.coins - 100_000, 80, '150 points doubles the wage (cut to a tenth on 2026-10-01)')
})

test('a shift brings things home now and then, each worth at most 30% of the pay', () => {
  let seed = 11
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const counts = [0, 0, 0]
  for (let trial = 0; trial < 2000; trial += 1) {
    const pig = schooled(1)
    pig.inventory = {}
    finishWork(pig, { kind: 'work', key: 'bricks' }, T0, next)
    const got = Object.values(pig.inventory).reduce((sum, count) => sum + count, 0)
    counts[got] += 1
  }
  const share = counts.map(count => count / 2000)
  assert.ok(Math.abs(share[0] - 0.35) < 0.04, `nothing: ${share[0]}`)
  assert.ok(Math.abs(share[1] - 0.5) < 0.04, `one: ${share[1]}`)
  assert.ok(Math.abs(share[2] - 0.15) < 0.03, `two: ${share[2]}`)
})

test('the fifth 兴趣课 of a kind earns its certificate', () => {
  const pig = schooled(1, {}, { coding: 4 })
  finishInterest(pig, { kind: 'interest', key: 'coding' }, T0)
  assert.equal(pig.interests.coding, 5)
  assert.ok(pig.pending.some(entry => entry.kind === 'certificate' && entry.text.includes('编程证')))
})

test('the v11 upgrade folds the old 23 subjects into the nine, and pays a shift in progress', () => {
  const old = {
    ...hatchEgg(T0), version: 10,
    courses: { literacy: 2, go: 3, piano: 1, engineering: 4, philosophy: 1 },
    coursesByStage: { preschool: { literacy: 2 } },
    lessonsByStage: { preschool: 2 },
    activity: { kind: 'work', key: 'office', label: '上班', emoji: '💼', startedAt: T0, endsAt: T0 + 240 * 60_000, cost: 0 },
    lastSeenAt: T0,
    coins: 0,
  }
  const pig = migrate(JSON.parse(JSON.stringify(old)), T0)
  assert.deepEqual(pig.lessons, { chinese: 3, mathematics: 3, music: 1, labour: 4 })
  assert.equal(pig.coursesByStage, undefined)
  assert.equal(pig.activity.legacyCoins, 900, 'the old 上班 pay')
  decay(pig, T0 + 240 * 60_000, { roll: never })
  assert.equal(pig.activity, null)
  assert.equal(pig.coins, 900, 'paid what it promised when it started')
})

test('traits no longer shorten a shift', () => {
  const pig = schooled(1)
  pig.traits = { intel: 0, charm: 0, strong: 500 }
  assert.equal(startWork(pig, 'bricks', T0).ok, true)
  assert.equal(pig.activity.endsAt - pig.activity.startedAt, 30 * 60_000)
})
