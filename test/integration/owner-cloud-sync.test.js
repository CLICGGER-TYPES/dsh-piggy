// @ts-check
/** Owner cloud first-sync contracts: full archive only, explicit direction, no remote history overwrite. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg } from '../../src/host/core.js'
import { createOwnerCloudSync } from '../../runtime/owner-cloud-sync.js'
import { inspectOwnerDocumentFile, writeOwnerDocumentFile } from '../../runtime/owner-document-file.js'
import { defaultGit } from '../../runtime/git-sync.js'
import { ownerDocumentFromLegacyV15 } from '../../store/owner-document.js'
import { readZip } from '../../runtime/save-zip.js'

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
    assert.equal(pushed.ok, true)
    assert.equal(pushed.created, true)
    assert.match(pushed.remoteHead, /^[a-f0-9]{40,64}$/u)
    assert.deepEqual(await local.firstSync('local-to-cloud'), { ok: true, alreadyCurrent: true, remoteHead: pushed.remoteHead })
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

test('two devices sharing one owner base refuse a stale automatic push after the other device advances', async () => {
  const f = fixture()
  const pathA = ownerFile(f.root, 'owner-shared', 'pig-a', 900, '-device-a')
  const pathB = ownerFile(f.root, 'owner-shared', 'pig-a', 900, '-device-b')
  assert.deepEqual(readFileSync(pathA), readFileSync(pathB), 'both devices start from the same owner document')
  const deviceA = syncFor(pathA, 'owner-shared', f.remote)
  let deviceB
  try {
    const first = await deviceA.firstSync('local-to-cloud')
    assert.equal(first.ok, true)
    const cloudRead = syncFor(pathB, 'owner-shared', f.remote)
    try {
      const remoteBase = await cloudRead.firstSync('cloud-to-local')
      assert.equal(remoteBase.ok, true)
      deviceB = createOwnerCloudSync({ ownerDocumentPath: pathB, ownerId: 'owner-shared', remote: f.remote,
        branch: 'main', baseHead: remoteBase.remoteHead, now: () => 1_800_000_001_000 })
      assert.deepEqual(await deviceB.pushSnapshot(), { ok: true, remoteHead: remoteBase.remoteHead, alreadyCurrent: true })
    } finally { await cloudRead.close() }

    const current = inspectOwnerDocumentFile(pathA)
    assert.equal(current.kind, 'owner-document')
    if (current.kind !== 'owner-document') throw new Error('owner A was not readable')
    const updated = structuredClone(current.document)
    updated.resources.coins = 901
    writeOwnerDocumentFile({ filePath: pathA, document: updated, expectedRevision: current.revision })
    const advanced = await deviceA.pushSnapshot()
    assert.equal(advanced.ok, true)
    const denied = await deviceB.pushSnapshot()
    assert.equal(denied.ok, false)
    assert.equal(denied.reason, 'remote-advanced')
    assert.equal(denied.remoteHead, advanced.remoteHead)

    const remote = await deviceB.history('main')
    assert.ok(remote.auto.length > 0 || remote.manual !== null, 'the accepted remote history remains readable')
    const saved = await deviceB.firstSync('cloud-to-local')
    const payload = readZip(Buffer.from(saved.archive))
    assert.equal(JSON.parse(payload.get('owner-document.json').toString('utf8')).resources.coins, 901,
      'the remote still contains device A latest coins after device B refused its stale push')
    assert.equal(inspectOwnerDocumentFile(pathB).document.resources.coins, 900, 'refusal does not mutate device B local document')
  } finally {
    await deviceA.close()
    await deviceB?.close()
    rmSync(f.root, { recursive: true, force: true })
  }
})

test('owner push does not acknowledge a remote commit that races immediately after its own push', async () => {
  const f = fixture(), ownerDocumentPath = ownerFile(f.root, 'owner-race', 'pig-race', 700)
  let advanceRemoteAfterPush = false
  const git = async (args, gitOptions) => {
    const result = await defaultGit(args, gitOptions)
    if (advanceRemoteAfterPush && args[0] === 'push') {
      advanceRemoteAfterPush = false
      const pushedHead = execFileSync('git', ['--git-dir', f.remote, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()
      const tree = execFileSync('git', ['--git-dir', f.remote, 'show', '-s', '--format=%T', pushedHead], { encoding: 'utf8' }).trim()
      const concurrentHead = execFileSync('git', ['-c', 'user.name=other-device', '-c', 'user.email=other@localhost',
        '--git-dir', f.remote, 'commit-tree', tree, '-p', pushedHead, '-m', 'concurrent-device'], { encoding: 'utf8' }).trim()
      execFileSync('git', ['--git-dir', f.remote, 'update-ref', 'refs/heads/main', concurrentHead])
    }
    return result
  }
  const sync = createOwnerCloudSync({ ownerDocumentPath, ownerId: 'owner-race', remote: f.remote, branch: 'main', git })
  try {
    const initial = await sync.firstSync('local-to-cloud')
    assert.equal(initial.ok, true)
    const current = inspectOwnerDocumentFile(ownerDocumentPath)
    assert.equal(current.kind, 'owner-document')
    if (current.kind !== 'owner-document') throw new Error('race fixture owner document was not readable')
    const updated = structuredClone(current.document)
    updated.resources.coins = 701
    writeOwnerDocumentFile({ filePath: ownerDocumentPath, document: updated, expectedRevision: current.revision })

    advanceRemoteAfterPush = true
    const result = await sync.pushSnapshot()
    const remoteHead = execFileSync('git', ['--git-dir', f.remote, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'remote-advanced')
    assert.equal(result.remoteHead, remoteHead)
    assert.notEqual(remoteHead, initial.remoteHead)
    assert.equal(sync.baseHead(), initial.remoteHead, 'an unobserved post-push head is not accepted as this device\'s base')
  } finally { await sync.close(); rmSync(f.root, { recursive: true, force: true }) }
})

test('owner push retries a locally committed snapshot after a transient push failure', async () => {
  const f = fixture(), ownerDocumentPath = ownerFile(f.root, 'owner-retry', 'pig-retry', 800)
  let failNextPush = false
  const git = async (args, gitOptions) => {
    if (failNextPush && args[0] === 'push') {
      failNextPush = false
      throw Object.assign(new Error('simulated transport failure'), { code: 'GIT_FAILED' })
    }
    return defaultGit(args, gitOptions)
  }
  const sync = createOwnerCloudSync({ ownerDocumentPath, ownerId: 'owner-retry', remote: f.remote, branch: 'main', git })
  try {
    const initial = await sync.firstSync('local-to-cloud')
    assert.equal(initial.ok, true)
    const current = inspectOwnerDocumentFile(ownerDocumentPath)
    assert.equal(current.kind, 'owner-document')
    if (current.kind !== 'owner-document') throw new Error('retry fixture owner document was not readable')
    const updated = structuredClone(current.document)
    updated.resources.coins = 801
    writeOwnerDocumentFile({ filePath: ownerDocumentPath, document: updated, expectedRevision: current.revision })

    failNextPush = true
    const firstAttempt = await sync.pushSnapshot()
    assert.equal(firstAttempt.ok, false)
    assert.equal(firstAttempt.reason, 'push-failed')
    assert.equal(sync.baseHead(), initial.remoteHead)
    const retry = await sync.pushSnapshot()
    assert.equal(retry.ok, true)
    assert.equal(retry.alreadyCurrent, undefined, 'a local commit ahead of remote must still be pushed')
    assert.equal(retry.pushed, true)
    assert.equal(retry.committed, false, 'retry pushes the already-created local commit')
    const remoteHead = execFileSync('git', ['--git-dir', f.remote, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()
    const remoteArchive = execFileSync('git', ['--git-dir', f.remote, 'show', `${remoteHead}:save.zip`])
    const remoteFiles = readZip(remoteArchive)
    assert.equal(JSON.parse(remoteFiles.get('owner-document.json').toString('utf8')).resources.coins, 801)
  } finally { await sync.close(); rmSync(f.root, { recursive: true, force: true }) }
})
