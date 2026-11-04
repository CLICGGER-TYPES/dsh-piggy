// @ts-check
/** owner document 文件层契约：显式路径、revision 冲突、源文件只读与事务恢复。 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'

import {
  inspectOwnerDocumentFile,
  migrateLegacyV15File,
  recoverOwnerDocumentTransaction,
  writeOwnerDocumentFile,
} from '../../../runtime/owner-document-file.js'
import { ownerDocumentFromLegacyV15, projectOwnerDocumentToLegacyV15, serializeOwnerDocument } from '../../../store/owner-document.js'
import { acquireGameLock } from '../../../runtime/owner-lock.js'

function fixtureDir() {
  return mkdtempSync(join(tmpdir(), 'dsh-piggy-owner-file-'))
}

function legacyV15(name = '甲') {
  return {
    version: 15,
    name,
    bornAt: 1_800_000_000_000,
    hatched: true,
    stage: 'piglet',
    skin: name === '甲' ? 'default' : 'pink',
    coins: 500,
    inventory: { apple: 2 },
    economy: { totals: { work: 3 }, fatigue: 0.2, future: 'keep' },
    extData: { farm: { version: 5, plots: [] }, mine: { ore: 3 } },
    futureTop: { keep: true },
  }
}

function documentFixture(ownerId = 'owner-a', pigId = 'pig-a', name = '甲') {
  return ownerDocumentFromLegacyV15(legacyV15(name), { ownerId, pigId })
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function transactionDirectory(target) {
  const identity = createHash('sha256').update(resolve(target)).digest('hex')
  return join(dirname(target), `.owner-document-tx-${identity}`)
}

function writeTransactionFixture(target, { phase, oldBytes, newBytes, expectedRevision }) {
  const tx = transactionDirectory(target)
  mkdirSync(tx, { mode: 0o700 })
  const token = 'ab'.repeat(16)
  writeFileSync(join(tx, 'owner.json'), JSON.stringify({
    version: 1,
    targetPath: resolve(target),
    token,
    expectedRevision,
  }))
  if (oldBytes !== null) writeFileSync(join(tx, 'old.bin'), oldBytes)
  writeFileSync(join(tx, 'new.bin'), newBytes)
  writeFileSync(join(tx, 'journal.json'), JSON.stringify({
    version: 1,
    phase,
    targetPath: resolve(target),
    token,
    hadExisting: oldBytes !== null,
    oldRevision: oldBytes === null ? null : sha256(oldBytes),
    newRevision: sha256(newBytes),
  }))
  return tx
}

test('inspection distinguishes missing, corrupt, unknown, legacy v15 and owner documents', () => {
  const directory = fixtureDir()
  try {
    const path = join(directory, 'owner.json')
    assert.deepEqual(inspectOwnerDocumentFile(path), { kind: 'missing' })

    writeFileSync(path, '{')
    const corrupt = inspectOwnerDocumentFile(path)
    assert.equal(corrupt.kind, 'invalid-json')
    assert.equal(corrupt.revision, sha256(Buffer.from('{')))

    writeFileSync(path, JSON.stringify({ other: true }))
    assert.equal(inspectOwnerDocumentFile(path).kind, 'unknown-format')

    writeFileSync(path, JSON.stringify({ version: 14 }))
    const unsupported = inspectOwnerDocumentFile(path)
    assert.equal(unsupported.kind, 'unsupported-version')
    if (unsupported.kind === 'unsupported-version') assert.equal(unsupported.version, 14)

    const legacyBytes = Buffer.from(JSON.stringify(legacyV15()))
    writeFileSync(path, legacyBytes)
    const legacy = inspectOwnerDocumentFile(path)
    assert.equal(legacy.kind, 'legacy-v15')
    if (legacy.kind === 'legacy-v15') assert.deepEqual(legacy.legacyState, legacyV15())

    const legacyWithUnknownVersionKey = { ...legacyV15(), documentVersion: 77 }
    const unknownVersionBytes = Buffer.from(JSON.stringify(legacyWithUnknownVersionKey))
    writeFileSync(path, unknownVersionBytes)
    const unknownVersionLegacy = inspectOwnerDocumentFile(path)
    assert.equal(unknownVersionLegacy.kind, 'legacy-v15', 'unknown v15 top-level data remains legacy opaque')
    const projected = projectOwnerDocumentToLegacyV15(
      ownerDocumentFromLegacyV15(legacyWithUnknownVersionKey, { ownerId: 'owner-a', pigId: 'pig-a' }),
      'pig-a',
    )
    assert.deepEqual(projected, legacyWithUnknownVersionKey)

    const document = documentFixture()
    writeFileSync(path, serializeOwnerDocument(document))
    const owner = inspectOwnerDocumentFile(path)
    assert.equal(owner.kind, 'owner-document')
    if (owner.kind === 'owner-document') assert.deepEqual(owner.document, document)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('create and update use revision CAS while preserving committed identities', () => {
  const directory = fixtureDir()
  try {
    const path = join(directory, 'owner.json')
    const initial = documentFixture()
    const created = writeOwnerDocumentFile({ filePath: path, document: initial, expectedRevision: 'missing' })
    assert.equal(created.document.ownerId, 'owner-a')
    const opened = inspectOwnerDocumentFile(path)
    assert.equal(opened.kind, 'owner-document')
    if (opened.kind !== 'owner-document') throw new Error('expected owner document after reopen')
    assert.equal(opened.revision, created.revision)

    const updated = structuredClone(opened.document)
    updated.resources.coins = 700
    const committed = writeOwnerDocumentFile({ filePath: path, document: updated, expectedRevision: opened.revision })
    assert.equal(committed.document.resources.coins, 700)
    assert.deepEqual(committed.document.pigs.map(pig => pig.pigId), ['pig-a'])

    const beforeStale = readFileSync(path)
    assert.throws(() => writeOwnerDocumentFile({ filePath: path, document: initial, expectedRevision: opened.revision }), /revision conflict/)
    assert.deepEqual(readFileSync(path), beforeStale)

    const latest = inspectOwnerDocumentFile(path)
    if (latest.kind !== 'owner-document') throw new Error('expected owner document after update')
    const changedOwner = structuredClone(latest.document)
    changedOwner.ownerId = 'owner-b'
    assert.throws(() => writeOwnerDocumentFile({ filePath: path, document: changedOwner, expectedRevision: latest.revision }), /ownerId is immutable/)
    assert.deepEqual(readFileSync(path), beforeStale)

    const changedPig = structuredClone(latest.document)
    changedPig.pigs[0].pigId = 'pig-b'
    assert.throws(() => writeOwnerDocumentFile({ filePath: path, document: changedPig, expectedRevision: latest.revision }), /existing pigId cannot be removed or reassigned/)
    assert.deepEqual(readFileSync(path), beforeStale)

    const appendedPig = structuredClone(latest.document)
    const explicitNewPig = documentFixture('owner-a', 'pig-b', '乙').pigs[0]
    appendedPig.pigs.push(explicitNewPig)
    const appended = writeOwnerDocumentFile({ filePath: path, document: appendedPig, expectedRevision: latest.revision })
    assert.deepEqual(appended.document.pigs.map(pig => pig.pigId), ['pig-a', 'pig-b'])
    assert.equal(appended.document.pigs[0].body.name, latest.document.pigs[0].body.name)

    const afterAppend = inspectOwnerDocumentFile(path)
    if (afterAppend.kind !== 'owner-document') throw new Error('expected owner document after pig append')
    const removedPig = structuredClone(afterAppend.document)
    removedPig.pigs.pop()
    const beforeRemoval = readFileSync(path)
    assert.throws(() => writeOwnerDocumentFile({ filePath: path, document: removedPig, expectedRevision: afterAppend.revision }), /existing pigId cannot be removed or reassigned/)
    assert.deepEqual(readFileSync(path), beforeRemoval, 'refused pig removal leaves the persisted document unchanged')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('migration locks source and target, persists caller IDs, and leaves source bytes unchanged', () => {
  const directory = fixtureDir()
  try {
    const legacyPath = join(directory, 'legacy-state.json')
    const ownerPath = join(directory, 'owner-document.json')
    const legacyWithUnknownVersionKey = { ...legacyV15(), documentVersion: 77 }
    const sourceBytes = Buffer.from(JSON.stringify(legacyWithUnknownVersionKey))
    writeFileSync(legacyPath, sourceBytes)
    assert.throws(() => migrateLegacyV15File({
      legacyPath,
      ownerDocumentPath: legacyPath,
      ownerId: 'stable-owner',
      pigId: 'stable-pig',
      expectedLegacySha256: sha256(sourceBytes),
      nowMs: 1_800_000_099_999,
    }), /separate paths/)
    assert.deepEqual(readFileSync(legacyPath), sourceBytes)

    const result = migrateLegacyV15File({
      legacyPath,
      ownerDocumentPath: ownerPath,
      ownerId: 'stable-owner',
      pigId: 'stable-pig',
      expectedLegacySha256: sha256(sourceBytes),
      nowMs: 1_800_000_100_000,
    })
    assert.equal(result.document.ownerId, 'stable-owner')
    assert.deepEqual(result.document.pigs.map(pig => pig.pigId), ['stable-pig'])
    assert.equal(result.document.opaque.documentVersion, 77, 'legacy opaque key survives explicit file migration')
    assert.deepEqual(readFileSync(legacyPath), sourceBytes)
    const reopened = inspectOwnerDocumentFile(ownerPath)
    assert.equal(reopened.kind, 'owner-document')
    if (reopened.kind === 'owner-document') {
      assert.equal(reopened.document.ownerId, 'stable-owner')
      assert.equal(reopened.document.pigs[0].pigId, 'stable-pig')
    }

    const beforeConflict = readFileSync(ownerPath)
    assert.throws(() => migrateLegacyV15File({
      legacyPath,
      ownerDocumentPath: ownerPath,
      ownerId: 'different-owner',
      pigId: 'different-pig',
      expectedLegacySha256: sha256(sourceBytes),
      nowMs: 1_800_000_100_001,
    }), /target already exists/)
    assert.deepEqual(readFileSync(ownerPath), beforeConflict)
    assert.throws(() => migrateLegacyV15File({
      legacyPath,
      ownerDocumentPath: join(directory, 'other-owner.json'),
      ownerId: 'stable-owner',
      pigId: 'stable-pig',
      expectedLegacySha256: '0'.repeat(64),
      nowMs: 1_800_000_100_002,
    }), /source revision conflict/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('malformed target and concurrent lock refuse writes without replacement', () => {
  const directory = fixtureDir()
  try {
    const path = join(directory, 'owner.json')
    const broken = Buffer.from('{ bad')
    writeFileSync(path, broken)
    assert.throws(() => writeOwnerDocumentFile({ filePath: path, document: documentFixture(), expectedRevision: sha256(broken) }), /not a writable owner document/)
    assert.deepEqual(readFileSync(path), broken)

    rmSync(path)
    const release = acquireGameLock(path)
    try {
      assert.throws(() => writeOwnerDocumentFile({ filePath: path, document: documentFixture(), expectedRevision: 'missing' }), /already has a live runtime/)
      assert.equal(inspectOwnerDocumentFile(path).kind, 'missing')
    } finally { release() }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('recover rolls back applying transactions and preserves committed transactions', () => {
  const directory = fixtureDir()
  try {
    const path = join(directory, 'owner.json')
    const initial = writeOwnerDocumentFile({ filePath: path, document: documentFixture(), expectedRevision: 'missing' })
    const oldBytes = readFileSync(path)
    const newDocument = structuredClone(initial.document)
    newDocument.resources.coins = 999
    const newBytes = Buffer.from(serializeOwnerDocument(newDocument))
    writeTransactionFixture(path, {
      phase: 'applying',
      oldBytes,
      newBytes,
      expectedRevision: sha256(oldBytes),
    })
    writeFileSync(path, newBytes)
    assert.deepEqual(recoverOwnerDocumentTransaction(path), { recovered: true, rolledBack: true })
    assert.deepEqual(readFileSync(path), oldBytes)

    const rollbackCompletedTx = writeTransactionFixture(path, {
      phase: 'applying',
      oldBytes,
      newBytes,
      expectedRevision: sha256(oldBytes),
    })
    rmSync(join(rollbackCompletedTx, 'owner.json'), { force: true })
    assert.deepEqual(recoverOwnerDocumentTransaction(path), { recovered: true, rolledBack: true })
    assert.equal(existsSync(rollbackCompletedTx), false)
    assert.deepEqual(readFileSync(path), oldBytes)

    const committedDocument = structuredClone(initial.document)
    committedDocument.resources.coins = 777
    const committedBytes = Buffer.from(serializeOwnerDocument(committedDocument))
    const tx = writeTransactionFixture(path, {
      phase: 'committed',
      oldBytes,
      newBytes: committedBytes,
      expectedRevision: sha256(oldBytes),
    })
    rmSync(join(tx, 'owner.json'), { force: true })
    rmSync(join(tx, 'old.bin'), { force: true })
    rmSync(join(tx, 'new.bin'), { force: true })
    writeFileSync(path, committedBytes)
    assert.deepEqual(recoverOwnerDocumentTransaction(path), { recovered: false, committedCleanup: true })
    assert.equal(existsSync(tx), false)
    assert.deepEqual(readFileSync(path), committedBytes)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('precommit owner marker permits cleanup only while target revision is unchanged', () => {
  const directory = fixtureDir()
  try {
    const path = join(directory, 'owner.json')
    const tx = transactionDirectory(path)
    mkdirSync(tx, { mode: 0o700 })
    assert.deepEqual(recoverOwnerDocumentTransaction(path), { recovered: false, emptyPrecommitCleaned: true })
    assert.equal(existsSync(tx), false)

    mkdirSync(tx, { mode: 0o700 })
    writeFileSync(join(tx, 'owner.json'), JSON.stringify({
      version: 1,
      targetPath: resolve(path),
      token: 'cd'.repeat(16),
      expectedRevision: 'missing',
    }))
    writeFileSync(join(tx, 'new.bin'), 'staged before journal')
    assert.deepEqual(recoverOwnerDocumentTransaction(path), { recovered: false, precommitCleaned: true })
    assert.equal(existsSync(tx), false)
    assert.equal(inspectOwnerDocumentFile(path).kind, 'missing')

    mkdirSync(tx, { mode: 0o700 })
    writeFileSync(join(tx, 'foreign.bin'), 'unrecognized precommit bytes')
    assert.throws(() => recoverOwnerDocumentTransaction(path), /owner marker missing/)
    assert.equal(existsSync(tx), true, 'unowned incomplete transaction is preserved for inspection')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('invalid rollback snapshot leaves the current target and journal untouched', () => {
  const directory = fixtureDir()
  try {
    const path = join(directory, 'owner.json')
    const newDocument = documentFixture()
    const newBytes = Buffer.from(serializeOwnerDocument(newDocument))
    const invalidOldBytes = Buffer.from('{not a valid owner document')
    const tx = writeTransactionFixture(path, {
      phase: 'applying',
      oldBytes: invalidOldBytes,
      newBytes,
      expectedRevision: sha256(invalidOldBytes),
    })
    writeFileSync(path, newBytes)

    assert.throws(() => recoverOwnerDocumentTransaction(path), /rollback snapshot failed codec validation/)
    assert.deepEqual(readFileSync(path), newBytes)
    assert.equal(existsSync(tx), true, 'untrusted transaction evidence is preserved')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
