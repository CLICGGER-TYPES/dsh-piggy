// @ts-check
/** Owner archive service: explicit identity, complete supported resources, fail-closed restore and recovery. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg, STATE_VERSION } from '../../../core.js'
import { exportLegacySaveArchiveAsOwnerDocumentArchive, exportOwnerDocumentArchive, createOwnerDocumentArchiveImporter, OWNER_ARCHIVE_MANIFEST, OWNER_DOCUMENT_ENTRY, OWNER_RECEIPTS_ENTRY } from '../../../runtime/owner-document-archive.js'
import { createSaveArchive } from '../../../runtime/save-archive.js'
import { readZip, makeZip } from '../../../runtime/save-zip.js'
import { ownerDocumentFromLegacyV15, projectOwnerDocumentToLegacyV15, serializeOwnerDocument } from '../../../store/owner-document.js'
import { writeOwnerDocumentFile, inspectOwnerDocumentFile } from '../../../runtime/owner-document-file.js'
import { stageArchiveImportTransactionForRecovery, recoverOwnerArchiveImport } from '../../../runtime/owner-archive-transaction.js'
import { REQUIRED_SKIN_SCENES } from '../../../packages/pet-core/src/data/skins.js'
import { writeWorkJson, readWorkJson } from '../../../runtime/work-files.js'

const NOW = 1_800_100_000_000
const SKIN_SVG = Buffer.from('<svg viewBox="0 0 64 64"><path d="M1 1h2"/></svg>')
const temp = () => mkdtempSync(join(tmpdir(), 'dsh-piggy-owner-archive-'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

function legacyPig(name, options = {}) {
  const state = hatchEgg(NOW)
  state.name = name
  state.coins = 932
  state.inventory.apple = 4
  state.dress = ['strawhat']
  state.worn = options.pigId === 'pig-b' ? [] : ['strawhat']
  state.skin = options.pigId === 'pig-b' ? 'default' : 'berry'
  state.customSkins = [{ key: 'berry', art: 'custom-berry', label: '莓果猪', author: 'fixture', description: 'synthetic', emoji: '🍓', scenes: [...REQUIRED_SKIN_SCENES], custom: true }]
  state.timeScale = options.pigId === 'pig-b' ? 0.5 : 2
  state.isOfflineFeedEnabled = options.pigId !== 'pig-b'
  state.dialogue.quiet = options.pigId === 'pig-b'
  return state
}

function ownerDocument() {
  const first = ownerDocumentFromLegacyV15(legacyPig('甲', { pigId: 'pig-a' }), { ownerId: 'owner-a', pigId: 'pig-a' })
  const second = ownerDocumentFromLegacyV15(legacyPig('乙', { pigId: 'pig-b' }), { ownerId: 'owner-a', pigId: 'pig-b' })
  first.resources.coins = 932
  first.resources.inventory.apple = 4
  first.pigs.push(second.pigs[0])
  return first
}

function installSkinFiles(root) {
  mkdirSync(join(root, 'skins'), { recursive: true })
  for (const scene of REQUIRED_SKIN_SCENES) {
    writeFileSync(join(root, 'skins', `custom-berry${scene === 'idle' ? '' : '-' + scene}.svg`), SKIN_SVG)
  }
}

function sourceOwner(root, document = ownerDocument()) {
  const path = join(root, 'owner-document.json')
  writeOwnerDocumentFile({ filePath: path, document, expectedRevision: 'missing' })
  installSkinFiles(root)
  mkdirSync(`${path}.work-events`, { recursive: true, mode: 0o700 })
  writeWorkJson(join(`${path}.work-events`, 'receipts.json'), { version: 2, receipts: [
    { version: 1, source: 'dsh', id: 'turn:one', type: 'turn', at: NOW, ownerId: 'owner-a', pigId: 'pig-a', disposition: 'applied' },
  ] })
  return { path, document }
}

function repackWith(archive, name, body) {
  const files = readZip(archive)
  const manifest = JSON.parse(files.get(OWNER_ARCHIVE_MANIFEST).toString('utf8'))
  files.set(name, body)
  manifest.files[name] = { size: body.length, sha256: sha(body) }
  return makeZip([...files].filter(([key]) => key !== OWNER_ARCHIVE_MANIFEST).concat([[OWNER_ARCHIVE_MANIFEST, Buffer.from(JSON.stringify(manifest))]]))
}

test('owner archive roundtrips all pig bodies, owner resources, supported skin files and owner-scoped receipts', () => {
  const root = temp(), sourceRoot = join(root, 'source'), targetPath = join(root, 'restored-owner', 'owner-document.json')
  mkdirSync(sourceRoot)
  try {
    const source = sourceOwner(sourceRoot)
    const sourceBytes = readFileSync(source.path), receiptBytes = readFileSync(`${source.path}.work-events/receipts.json`)
    const devicePrefs = join(root, 'device-local-settings.json')
    writeFileSync(devicePrefs, JSON.stringify({ sound: 'off', feel: 'quiet', ratio: 1.25 }))
    const prefsBefore = readFileSync(devicePrefs)
    const exported = exportOwnerDocumentArchive({ ownerDocumentPath: source.path, ownerId: 'owner-a', nowMs: NOW })
    const entries = readZip(exported.buffer)
    assert(entries.has(OWNER_DOCUMENT_ENTRY))
    assert(entries.has('skins/custom-berry.svg'))
    assert(entries.has('skins/custom-berry-eat.svg'))
    assert(entries.has(OWNER_RECEIPTS_ENTRY))
    assert(![...entries.keys()].some(name => /localStorage|device-local-settings|settings/i.test(name)))

    const importer = createOwnerDocumentArchiveImporter({ ownerDocumentPath: targetPath, ownerId: 'owner-a', pigId: 'pig-a', now: () => NOW })
    const preview = importer.preview(exported.buffer)
    assert.equal(preview.ok, true, JSON.stringify(preview))
    if (!preview.ok) throw new Error(preview.reason)
    assert.deepEqual(preview.pigIds, ['pig-a', 'pig-b'])
    assert.deepEqual(preview.warnings, [])
    const imported = importer.import(preview.token)
    assert.equal(imported.ok, true, JSON.stringify(imported))

    const reopened = inspectOwnerDocumentFile(targetPath)
    assert.equal(reopened.kind, 'owner-document')
    if (reopened.kind !== 'owner-document') throw new Error('owner archive did not publish a readable document')
    assert.deepEqual(reopened.document, source.document)
    assert.equal(reopened.document.resources.coins, 932)
    assert.equal(reopened.document.resources.inventory.apple, 4)
    assert.equal(reopened.document.pigs[0].body.name, '甲')
    assert.equal(reopened.document.pigs[1].body.name, '乙')
    assert.equal(reopened.document.pigs[0].body.timeScale, 2)
    assert.equal(reopened.document.pigs[1].body.timeScale, 0.5)
    assert.equal(reopened.document.pigs[0].body.dialogue.quiet, false)
    assert.equal(reopened.document.pigs[1].body.dialogue.quiet, true)
    assert.equal(readWorkJson(`${targetPath}.work-events/receipts.json`).receipts[0].pigId, 'pig-a')
    assert.equal(readFileSync(join(dirname(targetPath), 'skins', 'custom-berry-pet.svg')).compare(SKIN_SVG), 0)
    assert.deepEqual(readFileSync(source.path), sourceBytes, 'export does not mutate source owner document')
    assert.deepEqual(readFileSync(`${source.path}.work-events/receipts.json`), receiptBytes)
    assert.deepEqual(readFileSync(devicePrefs), prefsBefore, 'device-local settings are outside owner archive import')
    assert.deepEqual(recoverOwnerArchiveImport(targetPath), { recovered: false })
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('explicit legacy v15 import keeps coins and saved per-pig preferences and never edits its source bytes', () => {
  const root = temp(), legacyRoot = join(root, 'legacy'), targetPath = join(root, 'new-owner', 'owner-document.json')
  mkdirSync(legacyRoot)
  try {
    const legacyPath = join(legacyRoot, 'state.json'), state = legacyPig('旧猪', { pigId: 'pig-legacy' })
    state.coins = 5_321
    state.inventory.apple = 9
    state.timeScale = 1.75
    state.isOfflineFeedEnabled = false
    state.dialogue.quiet = true
    const bytes = Buffer.from(JSON.stringify(state))
    writeFileSync(legacyPath, bytes)
    installSkinFiles(legacyRoot)
    const legacyArchive = createSaveArchive({ statePath: legacyPath, state, gameVersion: '0.37.2-rc.6', nowMs: NOW }).buffer
    const archiveBefore = Buffer.from(legacyArchive)
    const importer = createOwnerDocumentArchiveImporter({ ownerDocumentPath: targetPath, ownerId: 'owner-imported', pigId: 'pig-legacy', now: () => NOW })
    const preview = importer.preview(legacyArchive)
    assert.equal(preview.ok, true, JSON.stringify(preview))
    if (!preview.ok) throw new Error(preview.reason)
    assert.equal(preview.format, 'legacy-flat-v15')
    const result = importer.import(preview.token)
    assert.equal(result.ok, true, JSON.stringify(result))
    const imported = inspectOwnerDocumentFile(targetPath)
    assert.equal(imported.kind, 'owner-document')
    if (imported.kind !== 'owner-document') throw new Error('legacy import did not create an owner document')
    const flat = projectOwnerDocumentToLegacyV15(imported.document, 'pig-legacy')
    assert.equal(flat.version, STATE_VERSION)
    assert.equal(flat.coins, 5_321)
    assert.equal(flat.inventory.apple, 9)
    assert.equal(flat.timeScale, 1.75)
    assert.equal(flat.isOfflineFeedEnabled, false)
    assert.equal(flat.dialogue.quiet, true)
    assert.deepEqual(readFileSync(legacyPath), bytes)
    assert.deepEqual(legacyArchive, archiveBefore)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('legacy v15 export makes a one-pig complete archive in memory; complete importer rejects flat archives', () => {
  const root = temp(), legacyRoot = join(root, 'legacy'), targetPath = join(root, 'copy', 'owner-document.json')
  mkdirSync(legacyRoot)
  try {
    const legacyPath = join(legacyRoot, 'state.json'), state = legacyPig('当前猪')
    state.coins = 1_234
    state.inventory.apple = 3
    const sourceBytes = Buffer.from(JSON.stringify(state))
    writeFileSync(legacyPath, sourceBytes)
    installSkinFiles(legacyRoot)
    const flat = createSaveArchive({ statePath: legacyPath, state, gameVersion: '0.37.2-rc.6', nowMs: NOW }).buffer
    const exported = exportLegacySaveArchiveAsOwnerDocumentArchive({ archiveBuffer: flat, ownerId: 'owner-copy', pigId: 'pig-copy', nowMs: NOW })
    const entries = readZip(exported.buffer)
    assert.equal(entries.has(OWNER_DOCUMENT_ENTRY), true)
    assert.equal(JSON.parse(entries.get(OWNER_ARCHIVE_MANIFEST).toString('utf8')).pigIds[0], 'pig-copy')
    assert.deepEqual(readFileSync(legacyPath), sourceBytes, 'complete export leaves the current v15 file unchanged')

    const importer = createOwnerDocumentArchiveImporter({ ownerDocumentPath: targetPath, allowLegacy: false, now: () => NOW })
    const preview = importer.preview(exported.buffer)
    assert.equal(preview.ok, true, JSON.stringify(preview))
    if (!preview.ok) throw new Error(preview.reason)
    assert.equal(preview.initialPigId, 'pig-copy')
    assert.equal(preview.summary.pigs[0].name, '当前猪')
    assert.equal(preview.summary.shared.coins, 1_234)
    assert.equal(preview.summary.shared.inventoryCount, 3)
    const imported = importer.import(preview.token)
    assert.equal(imported.ok, true, JSON.stringify(imported))
    assert.equal(imported.initialPigId, 'pig-copy')

    const refuseFlat = createOwnerDocumentArchiveImporter({
      ownerDocumentPath: join(root, 'flat-target', 'owner-document.json'), allowLegacy: false, now: () => NOW,
    }).preview(flat)
    assert.equal(refuseFlat.ok, false)
    assert.match(refuseFlat.reason, /单猪存档请使用当前小猪存档入口/)
    assert.equal(inspectOwnerDocumentFile(targetPath).kind, 'owner-document')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('wrong owner/pig, broken references and an existing owner are refused without changing any target bytes', () => {
  const root = temp(), sourceRoot = join(root, 'source'), existingRoot = join(root, 'already-owned')
  mkdirSync(sourceRoot)
  mkdirSync(existingRoot)
  try {
    const source = sourceOwner(sourceRoot)
    const archive = exportOwnerDocumentArchive({ ownerDocumentPath: source.path, ownerId: 'owner-a', nowMs: NOW }).buffer
    const wrongOwner = createOwnerDocumentArchiveImporter({ ownerDocumentPath: join(root, 'wrong-owner', 'owner-document.json'), ownerId: 'owner-b', pigId: 'pig-a', now: () => NOW })
    assert.equal(wrongOwner.preview(archive).ok, false)
    const wrongPig = createOwnerDocumentArchiveImporter({ ownerDocumentPath: join(root, 'wrong-pig', 'owner-document.json'), ownerId: 'owner-a', pigId: 'pig-missing', now: () => NOW })
    assert.equal(wrongPig.preview(archive).ok, false)

    const existingPath = join(existingRoot, 'owner-document.json')
    writeOwnerDocumentFile({ filePath: existingPath, document: ownerDocument(), expectedRevision: 'missing' })
    const before = readFileSync(existingPath)
    const existingImporter = createOwnerDocumentArchiveImporter({ ownerDocumentPath: existingPath, ownerId: 'owner-a', pigId: 'pig-a', now: () => NOW })
    const existing = existingImporter.preview(archive)
    assert.equal(existing.ok, false)
    assert.match(existing.reason, /already exists/)
    assert.deepEqual(readFileSync(existingPath), before, 'archive import refuses rather than overwriting an existing owner')

    const changedDocument = structuredClone(source.document)
    changedDocument.pigs[0].body.skin = 'missing-skin'
    const broken = repackWith(archive, OWNER_DOCUMENT_ENTRY, Buffer.from(serializeOwnerDocument(changedDocument)))
    const brokenImporter = createOwnerDocumentArchiveImporter({ ownerDocumentPath: join(root, 'broken', 'owner-document.json'), ownerId: 'owner-a', pigId: 'pig-a', now: () => NOW })
    const brokenPreview = brokenImporter.preview(broken)
    assert.equal(brokenPreview.ok, false)
    assert.match(brokenPreview.reason, /missing skin/)
    assert.equal(existsSync(join(root, 'broken')), false, 'preflight did not create target files')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('owner export refuses pending work WAL and unsupported ledger files instead of omitting them', () => {
  const root = temp()
  try {
    const source = sourceOwner(root), workDirectory = `${source.path}.work-events`
    const before = readFileSync(source.path)
    writeFileSync(join(workDirectory, 'transaction.json'), JSON.stringify({ version: 1 }))
    assert.throws(() => exportOwnerDocumentArchive({ ownerDocumentPath: source.path, ownerId: 'owner-a', nowMs: NOW }), /pending owner work transaction/)
    unlinkSync(join(workDirectory, 'transaction.json'))
    writeFileSync(join(workDirectory, 'unknown-checkpoint.bin'), Buffer.from([1, 2, 3]))
    assert.throws(() => exportOwnerDocumentArchive({ ownerDocumentPath: source.path, ownerId: 'owner-a', nowMs: NOW }), /unsupported files/)
    assert.deepEqual(readFileSync(source.path), before)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('archive import recovery rolls back hidden staging and cleans a directory already atomically published', () => {
  const root = temp(), sourceRoot = join(root, 'source')
  mkdirSync(sourceRoot)
  try {
    const source = sourceOwner(sourceRoot)
    const archive = exportOwnerDocumentArchive({ ownerDocumentPath: source.path, ownerId: 'owner-a', nowMs: NOW }).buffer
    const entries = readZip(archive), document = JSON.parse(entries.get(OWNER_DOCUMENT_ENTRY).toString('utf8'))
    const targetPath = join(root, 'rollback-owner', 'owner-document.json')
    const sidecars = new Map([...entries].filter(([name]) => name !== OWNER_ARCHIVE_MANIFEST && name !== OWNER_DOCUMENT_ENTRY)
      .map(([name, bytes]) => [name === OWNER_RECEIPTS_ENTRY ? 'owner-document.json.work-events/receipts.json' : name, bytes]))
    const input = { ownerDocumentPath: targetPath, document, sidecars, archiveSha256: sha(archive), ownerId: 'owner-a', pigIds: ['pig-a', 'pig-b'] }
    stageArchiveImportTransactionForRecovery(input)
    const rolledBack = recoverOwnerArchiveImport(targetPath)
    assert.deepEqual(rolledBack, { recovered: true, rolledBack: true })
    assert.equal(existsSync(dirname(targetPath)), false)

    const secondTarget = join(root, 'finish-owner', 'owner-document.json')
    stageArchiveImportTransactionForRecovery({ ...input, ownerDocumentPath: secondTarget })
    const parent = dirname(dirname(secondTarget))
    const tx = readdirSync(parent).map(name => join(parent, name)).find(path => path.includes('.owner-archive-import-'))
    assert.ok(tx, 'ready staging transaction exists before publication')
    renameSync(join(tx, 'stage-root'), dirname(secondTarget))
    const committed = recoverOwnerArchiveImport(secondTarget)
    assert.deepEqual(committed, { recovered: true, committedCleanup: true })
    assert.equal(inspectOwnerDocumentFile(secondTarget).kind, 'owner-document')
    assert.equal(readdirSync(parent).some(name => name.startsWith('.owner-archive-import-')), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
