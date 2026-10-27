// @ts-check
/** #14 合并事务：只碰 state/receipts/清单皮肤，applying 回滚、committed 清理。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { commitMergeSync, recoverMergeSync, restoreMergeFilesSync, rollbackCopiedSkinsSync } from '../runtime/merge-transaction.js'
import { hatchEgg, migrate } from '../core.js'

const NOW = 1_800_000_000_000
const temp = () => mkdtempSync(join(tmpdir(), 'piggy-tx-'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const state = name => migrate(hatchEgg(NOW), NOW)
const receipts = value => ({ version: 1, receipts: value })

test('提交合并只替换 state/receipts/清单皮肤，扩展目录不动；成功后清临时区', () => {
  const dir = temp()
  const statePath = join(dir, 'state.json')
  try {
    writeFileSync(statePath, JSON.stringify(state('old')))
    mkdirSync(join(dir, 'extensions', 'keep'), { recursive: true })
    writeFileSync(join(dir, 'extensions', 'keep', 'client.js'), 'keep')
    const next = state('new')
    const skin = Buffer.from('custom')
    commitMergeSync({ statePath, mergeId: '11111111-1111-4111-8111-111111111111', state: next, receipts: [], skinFiles: new Map([['skins/custom-mint.png', skin]]) })
    assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).name, next.name)
    assert.deepEqual(JSON.parse(readFileSync(`${statePath}.work-events/receipts.json`, 'utf8')), { version: 1, receipts: [] })
    assert.equal(readFileSync(join(dir, 'skins', 'custom-mint.png')).toString(), 'custom')
    assert.equal(readFileSync(join(dir, 'extensions', 'keep', 'client.js'), 'utf8'), 'keep')
    assert.equal(existsSync(join(dir, '.piggy-merge-11111111-1111-4111-8111-111111111111')), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('applying 崩溃：下次启动恢复旧 state/receipts/皮肤并清临时区', () => {
  const dir = temp()
  const statePath = join(dir, 'state.json')
  const mergeId = '22222222-2222-4222-8222-222222222222'
  try {
    const old = state('old')
    writeFileSync(statePath, JSON.stringify(state('half')))
    mkdirSync(`${statePath}.work-events`, { recursive: true })
    writeFileSync(`${statePath}.work-events/receipts.json`, JSON.stringify(receipts([{ id: 'new' }])))
    mkdirSync(join(dir, 'skins'), { recursive: true })
    writeFileSync(join(dir, 'skins', 'custom-mint.png'), 'half')
    const tx = join(dir, `.piggy-merge-${mergeId}`)
    mkdirSync(join(tx, 'old'), { recursive: true })
    writeFileSync(join(tx, 'old', 'state.json'), JSON.stringify(old))
    writeFileSync(join(tx, 'old', 'receipts.json'), JSON.stringify(receipts([{ id: 'old' }])))
    writeFileSync(join(tx, 'old', 'skin-0'), 'old-skin')
    writeFileSync(join(tx, 'journal.json'), JSON.stringify({ version: 1, phase: 'applying', mergeId, statePath,
      skins: ['skins/custom-mint.png'], hadState: true, hadReceipts: true, hadSkins: [true] }))
    const recovered = recoverMergeSync(statePath)
    assert.deepEqual(recovered, [{ mergeId, phase: 'applying' }])
    assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).name, old.name)
    assert.deepEqual(JSON.parse(readFileSync(`${statePath}.work-events/receipts.json`, 'utf8')), receipts([{ id: 'old' }]))
    assert.equal(readFileSync(join(dir, 'skins', 'custom-mint.png'), 'utf8'), 'old-skin')
    assert.equal(existsSync(tx), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('committed 崩溃：保留新状态，只清临时区', () => {
  const dir = temp()
  const statePath = join(dir, 'state.json')
  const mergeId = '33333333-3333-4333-8333-333333333333'
  try {
    const next = state('new')
    writeFileSync(statePath, JSON.stringify(next))
    const tx = join(dir, `.piggy-merge-${mergeId}`)
    mkdirSync(join(tx, 'old'), { recursive: true })
    writeFileSync(join(tx, 'journal.json'), JSON.stringify({ version: 1, phase: 'committed', mergeId, statePath,
      skins: [], hadState: true, hadReceipts: false, hadSkins: [] }))
    recoverMergeSync(statePath)
    assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).name, next.name)
    assert.equal(existsSync(tx), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('损坏事务日志保留现场并拒绝启动', () => {
  const dir = temp()
  const statePath = join(dir, 'state.json')
  const mergeId = '44444444-4444-4444-8444-444444444444'
  try {
    writeFileSync(statePath, '{}')
    const tx = join(dir, `.piggy-merge-${mergeId}`)
    mkdirSync(tx, { recursive: true })
    writeFileSync(join(tx, 'journal.json'), '{broken')
    assert.throws(() => recoverMergeSync(statePath), /日志/)
    assert.equal(existsSync(tx), true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('回滚只删本次清单里、内容没被改过的皮肤；改过的保留并警告', () => {
  const dir = temp()
  const statePath = join(dir, 'state.json')
  try {
    mkdirSync(join(dir, 'skins'), { recursive: true })
    writeFileSync(join(dir, 'skins', 'custom-a.png'), 'same')
    writeFileSync(join(dir, 'skins', 'custom-b.png'), 'changed')
    writeFileSync(join(dir, 'skins', 'custom-new.png'), 'later')
    const warnings = rollbackCopiedSkinsSync({ statePath, copied: [
      { name: 'skins/custom-a.png', sha256: sha(Buffer.from('same')) },
      { name: 'skins/custom-b.png', sha256: sha(Buffer.from('before')) },
    ], hashOf: sha })
    assert.equal(existsSync(join(dir, 'skins', 'custom-a.png')), false)
    assert.equal(existsSync(join(dir, 'skins', 'custom-b.png')), true)
    assert.equal(existsSync(join(dir, 'skins', 'custom-new.png')), true)
    assert.match(warnings.join(' '), /custom-b/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('从备份恢复 state/receipts 不整目录替换', () => {
  const dir = temp()
  const statePath = join(dir, 'state.json')
  try {
    mkdirSync(join(dir, 'skins'), { recursive: true })
    writeFileSync(join(dir, 'skins', 'custom-keep.png'), 'keep')
    restoreMergeFilesSync({ statePath, stateBytes: Buffer.from(JSON.stringify(state('restored'))), receiptsBytes: Buffer.from(JSON.stringify(receipts([]))) })
    assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).name, state('restored').name)
    assert.equal(existsSync(join(dir, 'skins', 'custom-keep.png')), true)
    assert.equal(existsSync(dirname(statePath)), true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
