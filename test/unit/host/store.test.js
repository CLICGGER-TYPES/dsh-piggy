// @ts-check
/**
 * 存档安全。
 *
 * 这里守的是一个真实踩过的坑：`load()` 原先用一个裸 `catch { return null }`，
 * 存档一旦损坏，猪就**静默消失**，而下一次写入还会把坏文件覆盖掉。
 * 现在的要求是：日志说清楚、现场留一份、原文件不动。
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg, startWork, STATE_VERSION } from '../../../src/host/core.js'
import { createStore, moveLegacySaveDir } from '../../../src/host/store.js'
import { writeDiaryIfNewDay } from '../../../packages/pet-core/src/core/diary.js'
import { DIARY_BOOK } from '../../../src/host/data.js'

/** 某一组日记，主人称呼按默认的「主人」。 */
const pages = group => DIARY_BOOK[group].map(text => text.split('[主人]').join('主人'))

const makeDir = () => mkdtempSync(join(tmpdir(), 'dsh-piggy-store-'))

test('offline work is recorded on the day it ended before the diary turns over', () => {
  const dir = makeDir()
  try {
    const start = new Date(2026, 9, 2, 20).getTime()
    const reopen = new Date(2026, 9, 3, 12).getTime()
    const pig = hatchEgg(start)
    writeDiaryIfNewDay(pig, start)
    assert.equal(startWork(pig, 'bricks', start).ok, true)
    const path = join(dir, 'state.json')
    writeFileSync(path, JSON.stringify(pig))
    const store = createStore(path, { now: () => reopen, setTimer: () => 0, clearTimer: () => {} })
    store.freshen()
    const oldDay = store.state.diary.entries.find(entry => entry.day === '2026-10-02')
    assert.ok(pages('work').includes(oldDay?.text ?? ''), oldDay?.text)
    assert.equal(store.state.diary.today.day, '2026-10-03')
    assert.equal(store.state.diary.today.counts.work, undefined)
    store.dispose()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('offline work ending after the 06:00 diary boundary goes to the new day', () => {
  const dir = makeDir()
  try {
    const start = new Date(2026, 9, 3, 5, 45).getTime()
    const reopen = new Date(2026, 9, 3, 12).getTime()
    const pig = hatchEgg(start)
    writeDiaryIfNewDay(pig, start)
    assert.equal(startWork(pig, 'bricks', start).ok, true)
    const path = join(dir, 'state.json')
    writeFileSync(path, JSON.stringify(pig))
    const store = createStore(path, { now: () => reopen, setTimer: () => 0, clearTimer: () => {} })
    store.freshen()
    const quiet = store.state.diary.entries.find(entry => entry.day === '2026-10-02')?.text ?? ''
    assert.ok(pages('lonely').includes(quiet), quiet)
    assert.equal(store.state.diary.today.day, '2026-10-03')
    assert.equal(store.state.diary.today.counts.work, 1)
    store.dispose()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

/** Run `body` with console.warn captured, returning what it logged. */
function collectWarnings(body) {
  const warnings = []
  const original = console.warn
  console.warn = (...args) => { warnings.push(args.map(String).join(' ')) }
  try {
    body()
  } finally {
    console.warn = original
  }
  return warnings
}

test('a corrupt save is preserved instead of silently becoming no pig', () => {
  const dir = makeDir()
  try {
    const statePath = join(dir, 'state.json')
    const broken = '{ this is not json'
    writeFileSync(statePath, broken)

    let store
    const warnings = collectWarnings(() => { store = createStore(statePath) })

    assert.equal(store.state, null, 'the pig stays absent rather than half-loaded')
    const backups = readdirSync(dir).filter(name => name.startsWith('state.json.corrupt-'))
    assert.equal(backups.length, 1, 'the unusable save is copied aside')
    assert.equal(readFileSync(join(dir, backups[0]), 'utf8'), broken)
    assert.equal(readFileSync(statePath, 'utf8'), broken, 'and the original is left untouched')
    assert.ok(
      warnings.some(line => line.includes('unusable') && line.includes('invalid JSON')),
      `expected a loud warning, got: ${warnings.join(' | ')}`,
    )
    store.dispose()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a save that migrate() cannot use is preserved too', () => {
  const dir = makeDir()
  try {
    const statePath = join(dir, 'state.json')
    // Valid JSON, unusable shape: an array is not a pig.
    const unusable = '[1, 2, 3]'
    writeFileSync(statePath, unusable)

    let store
    const warnings = collectWarnings(() => { store = createStore(statePath) })

    assert.equal(store.state, null)
    const backups = readdirSync(dir).filter(name => name.startsWith('state.json.corrupt-'))
    assert.equal(backups.length, 1)
    assert.equal(readFileSync(statePath, 'utf8'), unusable)
    assert.ok(warnings.some(line => line.includes('migrate() rejected')), warnings.join(' | '))
    store.dispose()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a missing save is a normal first run, not a warning', () => {
  const dir = makeDir()
  try {
    const statePath = join(dir, 'state.json')
    let store
    const warnings = collectWarnings(() => { store = createStore(statePath) })
    assert.equal(store.state, null)
    assert.deepEqual(warnings, [], 'no save yet is expected, not an error')
    store.dispose()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a healthy save loads as-is, with nothing copied aside', () => {
  const dir = makeDir()
  try {
    const statePath = join(dir, 'state.json')
    const pig = hatchEgg(1_700_000_000_000)
    writeFileSync(statePath, JSON.stringify(pig))

    let store
    const warnings = collectWarnings(() => { store = createStore(statePath) })
    assert.notEqual(store.state, null)
    assert.equal(store.state.version, STATE_VERSION)
    assert.deepEqual(warnings, [])
    assert.deepEqual(readdirSync(dir).filter(name => name.includes('corrupt')), [])
    store.dispose()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a mutation is written through a temp file and leaves no debris', () => {
  const dir = makeDir()
  try {
    const statePath = join(dir, 'state.json')
    // Run the throttled save immediately instead of waiting on a timer.
    const flushNow = fn => { fn(); return { unref() {} } }
    const store = createStore(statePath, { setTimer: flushNow })
    assert.equal(store.hatch(), true)

    const saved = JSON.parse(readFileSync(statePath, 'utf8'))
    assert.equal(saved.hatched, true, 'the save is on disk, complete')
    assert.deepEqual(readdirSync(dir).filter(name => name.endsWith('.tmp')), [], 'the temp file is renamed, not left behind')
    store.dispose()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a mutation that throws halfway is rolled back and never written', () => {
  const dir = makeDir()
  try {
    const statePath = join(dir, 'state.json')
    const pig = hatchEgg(1_700_000_000_000)
    pig.satiety = 70
    writeFileSync(statePath, JSON.stringify(pig))
    const store = createStore(statePath, { setTimer: fn => { fn(); return { unref() {} } } })
    assert.equal(store.state.satiety, 70)

    // applyDevPatch reads the patch field by field: this one mutates satiety and
    // then throws while reading the next field, leaving the state half-applied.
    const patch = { satiety: 11 }
    Object.defineProperty(patch, 'traits', { get() { throw new Error('boom') }, enumerable: true })

    assert.equal(store.dev(patch), false, 'the caller is told it failed')
    assert.equal(store.state.satiety, 70, 'the half-applied change is rolled back')
    store.dispose()
    assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).satiety, 70, 'and nothing was written')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the old $DSH_HOME/dsh-pig folder moves to dsh-piggy once, byte for byte, and is kept aside', () => {
  const home = makeDir()
  try {
    mkdirSync(join(home, 'dsh-pig'))
    const save = JSON.stringify(hatchEgg(Date.parse('2026-10-01T09:00:00')))
    writeFileSync(join(home, 'dsh-pig', 'state.json'), save)
    writeFileSync(join(home, 'dsh-pig', 'state.json.v11-backup-x'), 'old')
    const aside = moveLegacySaveDir(home, Date.parse('2026-10-01T10:00:00'))
    assert.notEqual(aside, null)
    assert.equal(readFileSync(join(home, 'dsh-piggy', 'state.json'), 'utf8'), save)
    assert.equal(readFileSync(join(home, 'dsh-piggy', 'state.json.v11-backup-x'), 'utf8'), 'old')
    assert.equal(existsSync(join(home, 'dsh-pig')), false)
    assert.equal(readFileSync(join(aside, 'state.json'), 'utf8'), save, 'the old folder is renamed, not deleted')
    // Once moved, a second start leaves everything alone.
    mkdirSync(join(home, 'dsh-pig'))
    assert.equal(moveLegacySaveDir(home), null)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
