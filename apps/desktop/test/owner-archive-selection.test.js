// @ts-check
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createOwnerArchiveSelectionStore } from '../lib/owner-archive-selection.js'

function fixture() {
  const userData = mkdtempSync(join(tmpdir(), 'piggy-owner-selection-'))
  const store = createOwnerArchiveSelectionStore(userData)
  mkdirSync(store.archiveRoot, { recursive: true, mode: 0o700 })
  function target(name, ownerId, pigId) {
    const ownerDocumentPath = join(store.archiveRoot, name, 'owner-document.json')
    mkdirSync(join(store.archiveRoot, name), { recursive: true, mode: 0o700 })
    writeFileSync(ownerDocumentPath, JSON.stringify({ ownerId, pigId }))
    return { ownerDocumentPath, ownerId, pigId }
  }
  return { userData, store, target }
}

test('pending selection commits after restart or rolls back to the prior owner without touching saves', () => {
  const f = fixture()
  try {
    assert.equal(f.store.read().active, null, 'missing selection keeps the legacy v15 path')
    const first = f.target('archive-a', 'owner-a', 'pig-a')
    f.store.stage(first)
    assert.deepEqual(f.store.read().pending, { previous: null, next: first })
    f.store.commitPending()
    assert.deepEqual(f.store.read().active, first)

    const second = f.target('archive-b', 'owner-b', 'pig-b')
    f.store.stage(second)
    f.store.rollbackPending()
    assert.deepEqual(f.store.read().active, first)
    assert.equal(f.store.read().pending, null)
  } finally { rmSync(f.userData, { recursive: true, force: true }) }
})

test('a missing pending target can restore the previous selection; a missing active target fails closed', () => {
  const f = fixture()
  try {
    const first = f.target('archive-a', 'owner-a', 'pig-a')
    f.store.stage(first); f.store.commitPending()
    const second = f.target('archive-b', 'owner-b', 'pig-b')
    f.store.stage(second)
    unlinkSync(second.ownerDocumentPath)
    assert.equal(f.store.read().pending.next.ownerId, 'owner-b')
    f.store.rollbackPending()
    assert.deepEqual(f.store.read().active, first)
    unlinkSync(first.ownerDocumentPath)
    assert.throws(() => f.store.read(), /所选存档文件不存在/)
  } finally { rmSync(f.userData, { recursive: true, force: true }) }
})

test('selection refuses paths outside its dedicated archive root', () => {
  const f = fixture()
  try {
    const outside = join(f.userData, 'state.json')
    writeFileSync(outside, '{}')
    assert.throws(() => f.store.stage({ ownerDocumentPath: outside, ownerId: 'owner-a', pigId: 'pig-a' }), /独立存档目录内/)
    assert.equal(f.store.read().active, null)
  } finally { rmSync(f.userData, { recursive: true, force: true }) }
})
