// @ts-check
/** Owner cloud first-sync contracts: full archive only, explicit direction, no remote history overwrite. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg } from '../core.js'
import { createOwnerCloudSync } from '../runtime/owner-cloud-sync.js'
import { writeOwnerDocumentFile } from '../runtime/owner-document-file.js'
import { ownerDocumentFromLegacyV15 } from '../store/owner-document.js'
import { readZip } from '../runtime/save-zip.js'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'piggy-owner-cloud-'))
  const remote = join(root, 'remote.git')
  execFileSync('git', ['init', '--bare', '--initial-branch=main', remote], { stdio: 'ignore' })
  return { root, remote }
}

function ownerFile(root, ownerId, pigId, coins = 900, suffix = '') {
  const directory = join(root, `${ownerId}-${pigId}${suffix}`)
  mkdirSync(directory, { recursive: true })
  const ownerDocumentPath = join(directory, 'owner-document.json')
  const legacy = hatchEgg(1_800_000_000_000)
  legacy.coins = coins
  legacy.inventory.apple = 3
  const document = ownerDocumentFromLegacyV15(legacy, { ownerId, pigId })
  writeOwnerDocumentFile({ filePath: ownerDocumentPath, document, expectedRevision: 'missing' })
  return ownerDocumentPath
}

function syncFor(ownerDocumentPath, ownerId, remote) {
  return createOwnerCloudSync({ ownerDocumentPath, ownerId, remote, branch: 'main', now: () => 1_800_000_001_000 })
}

test('owner first sync pushes a complete archive only to an empty branch and cloud-to-local returns validated copy bytes', async () => {
  const f = fixture(), ownerDocumentPath = ownerFile(f.root, 'owner-a', 'pig-a')
  const receivingPath = ownerFile(f.root, 'owner-b', 'pig-b', 123)
  const receivingBytes = readFileSync(receivingPath)
  const local = syncFor(ownerDocumentPath, 'owner-a', f.remote)
  try {
    const pushed = await local.firstSync('local-to-cloud')
    assert.deepEqual(pushed, { ok: true, created: true })
    assert.deepEqual(await local.firstSync('local-to-cloud'), { ok: true, alreadyCurrent: true })
    const remoteView = syncFor(receivingPath, 'owner-b', f.remote)
    try {
      const pulled = await remoteView.firstSync('cloud-to-local')
      assert.equal(pulled.ok, true)
      assert.equal(pulled.ownerId, 'owner-a', 'the cloud copy is not mistaken for the currently active local owner')
      assert.deepEqual(pulled.pigIds, ['pig-a'])
      assert(pulled.archive instanceof Uint8Array)
      const files = readZip(Buffer.from(pulled.archive))
      assert.equal(files.has('owner-document.json'), true)
      assert.equal(files.has('state.json'), false, 'owner cloud must not fall back to the flat v15 ZIP')
      assert.deepEqual(readFileSync(receivingPath), receivingBytes, 'previewing cloud bytes never overwrites the live owner file')
    } finally { await remoteView.close({ finalPush: false }) }
  } finally { await local.close({ finalPush: false }); rmSync(f.root, { recursive: true, force: true }) }
})

test('owner first sync refuses a branch with different history and preserves its remote commit', async () => {
  const f = fixture(), ownerDocumentPath = ownerFile(f.root, 'owner-a', 'pig-a')
  const initial = syncFor(ownerDocumentPath, 'owner-a', f.remote)
  try { assert.equal((await initial.firstSync('local-to-cloud')).ok, true) }
  finally { await initial.close({ finalPush: false }) }
  const before = execFileSync('git', ['--git-dir', f.remote, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()
  const changedPath = ownerFile(f.root, 'owner-a', 'pig-a', 901, '-changed')
  const changed = syncFor(changedPath, 'owner-a', f.remote)
  try {
    assert.deepEqual(await changed.firstSync('local-to-cloud'), { ok: false, reason: 'remote-has-history' })
    const after = execFileSync('git', ['--git-dir', f.remote, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()
    assert.equal(after, before)
  } finally { await changed.close({ finalPush: false }); rmSync(f.root, { recursive: true, force: true }) }
})
