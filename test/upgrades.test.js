// @ts-check
/**
 * 存档逐级升级：v7 → v8，以及升级前的备份。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { STATE_VERSION, layEgg, levelFor, levelProgress, migrate } from '../core.js'
import { readStateFile } from '../store/state-file.js'
import { UPGRADES } from '../packages/pet-core/src/core/upgrades.js'

const T0 = 1_700_000_000_000
const realSave = () => JSON.parse(readFileSync(new URL('./fixtures/state-v7-real.json', import.meta.url), 'utf8'))

test('the upgrade table ends at the current version, one step at a time', () => {
  assert.equal(UPGRADES.at(-1)?.to, STATE_VERSION)
  UPGRADES.forEach((upgrade, index) => {
    if (index > 0) assert.equal(upgrade.to, UPGRADES[index - 1].to + 1, `step to v${upgrade.to} skips a version`)
    assert.ok(upgrade.why.length > 0, `step to v${upgrade.to} must say why`)
  })
})

test('an unopened box that ate some xp stays a box across a restart', () => {
  // Reset → a tool call feeds the box xp → dsh restarts. The old migrate()
  // read `xp > 0` as "hatched" and the box turned into a pig by itself.
  const box = { ...layEgg(T0), version: 7, hatched: false, xp: 12 }
  const loaded = migrate(JSON.parse(JSON.stringify(box)), T0 + 60_000)
  assert.equal(loaded.hatched, false)
  assert.equal(loaded.stage, 'box')
})

test('a save from before the hatched flag still infers it from xp', () => {
  const old = { version: 3, name: '老猪', bornAt: T0, xp: 300 }
  assert.equal(migrate(old, T0).hatched, true)
  const oldBox = { version: 3, name: '老盒', bornAt: T0, xp: 0 }
  assert.equal(migrate(oldBox, T0).hatched, false)
})

test('the real v7 save upgrades with its level, money, bag and schooling intact', () => {
  const before = realSave()
  assert.equal(before.version, 7, 'the fixture is the pre-upgrade shape')
  const after = migrate(realSave(), before.lastSeenAt)
  assert.equal(after.version, STATE_VERSION)
  assert.equal(after.hatched, true)
  assert.equal(after.dead, before.dead)
  // v9 moved xp onto the growth curve: Lv8 at 13% on the old curve stays Lv8
  // at 13% on the new one.
  assert.equal(levelFor(after.xp), 8)
  assert.equal(levelProgress(after.xp).percent, 13)
  assert.equal(after.sex, undefined, 'pigs have no sex any more')
  assert.equal(after.coins, before.coins)
  assert.deepEqual(after.inventory, before.inventory)
  assert.deepEqual(after.traits, before.traits)
  // v11 folded the old course totals into the nine subjects; this pig never studied.
  assert.deepEqual(after.lessons, {})
  assert.equal(after.coursesByStage, undefined)
  assert.deepEqual(after.dress, before.dress)
  assert.equal(after.souvenirs.length, before.souvenirs.length)
  assert.ok(Number.isInteger(after.seed), 'and it gets a random seed of its own')
})

test('loading an older save keeps a copy of it before anything is rewritten', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-upgrade-'))
  try {
    const path = join(dir, 'state.json')
    const original = readFileSync(new URL('./fixtures/state-v7-real.json', import.meta.url), 'utf8')
    writeFileSync(path, original)
    const { state, needsSave } = readStateFile(path, T0)
    assert.equal(state?.version, STATE_VERSION)
    assert.equal(needsSave, true)
    const copies = readdirSync(dir).filter(name => name.startsWith('state.json.v7-backup-'))
    assert.equal(copies.length, 1)
    assert.equal(readFileSync(join(dir, copies[0]), 'utf8'), original, 'the copy is byte-for-byte the old save')
    assert.equal(readFileSync(path, 'utf8'), original, 'and the original is untouched until the store saves')

    // A save that is already current is not copied again.
    writeFileSync(path, JSON.stringify(state))
    readStateFile(path, T0)
    assert.equal(readdirSync(dir).filter(name => name.includes('-backup-')).length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
