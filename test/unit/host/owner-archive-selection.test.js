// @ts-check
/** Runtime-layer owner archive selection: pending/active switch and fail-closed recovery. */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createOwnerArchiveSelectionStore } from '../../../runtime/owner-archive-selection.js'

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'piggy-owner-selection-runtime-'))
  const archiveRoot = join(directory, 'owner-archives')
  const store = createOwnerArchiveSelectionStore({ directory, archiveRoot })
  mkdirSync(archiveRoot, { recursive: true, mode: 0o700 })
  function target(name, ownerId, pigId) {
    const root = join(archiveRoot, name)
    mkdirSync(root, { recursive: true, mode: 0o700 })
    const ownerDocumentPath = join(root, 'owner-document.json')
    writeFileSync(ownerDocumentPath, JSON.stringify({ ownerId, pigId }))
    return { ownerDocumentPath, ownerId, pigId }
  }
  return { directory, archiveRoot, store, target }
}

test('pending selection commits after restart or rolls back without touching either copy', () => {
  const f = fixture()
  try {
    assert.equal(f.store.read().active, null, 'a missing selection keeps the configured owner')
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
    assert.equal(f.store.read().missing, false)
  } finally { rmSync(f.directory, { recursive: true, force: true }) }
})

test('a missing pending copy rolls back; a missing active copy fails closed', () => {
  const f = fixture()
  try {
    const first = f.target('archive-a', 'owner-a', 'pig-a')
    f.store.stage(first); f.store.commitPending()
    const second = f.target('archive-b', 'owner-b', 'pig-b')
    f.store.stage(second)
    unlinkSync(second.ownerDocumentPath)
    assert.equal(f.store.read().pending?.next.ownerId, 'owner-b')
    f.store.rollbackPending()
    assert.deepEqual(f.store.read().active, first)

    unlinkSync(first.ownerDocumentPath)
    assert.throws(() => f.store.read(), /所选存档文件不存在/)
  } finally { rmSync(f.directory, { recursive: true, force: true }) }
})

test('commitPending activates a verified new copy even when the old active copy was lost', () => {
  const f = fixture()
  try {
    const first = f.target('archive-a', 'owner-a', 'pig-a')
    f.store.stage(first); f.store.commitPending()
    const second = f.target('archive-b', 'owner-b', 'pig-b')
    f.store.stage(second)
    unlinkSync(first.ownerDocumentPath)
    f.store.commitPending()
    assert.deepEqual(f.store.read().active, second)
  } finally { rmSync(f.directory, { recursive: true, force: true }) }
})

test('selection refuses paths outside its dedicated archive root and corrupt records', () => {
  const f = fixture()
  try {
    const outside = join(f.directory, 'state.json')
    writeFileSync(outside, '{}')
    assert.throws(() => f.store.stage({ ownerDocumentPath: outside, ownerId: 'owner-a', pigId: 'pig-a' }), /独立存档目录内/)
    assert.equal(f.store.read().active, null)

    writeFileSync(f.store.file, '{"version":1,"active":null,"pending":"no"}')
    assert.throws(() => f.store.read(), /损坏/)
  } finally { rmSync(f.directory, { recursive: true, force: true }) }
})
