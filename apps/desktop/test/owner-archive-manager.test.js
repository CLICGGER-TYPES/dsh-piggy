// @ts-check
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { createOwnerArchiveManager } from '../lib/owner-archive-manager.js'
import { createOwnerArchiveSelectionStore } from '../lib/owner-archive-selection.js'
import { startBackgroundHost } from '../lib/background-host.js'
import { readZip } from '../../../runtime/save-zip.js'
import { OWNER_ARCHIVE_MANIFEST, OWNER_DOCUMENT_ENTRY } from '../../../runtime/owner-document-archive.js'
import { parseOwnerDocument } from '../../../store/owner-document.js'
import { hatchEgg } from '../../../core.js'
import { exportOwnerDocumentArchive } from '../../../runtime/owner-document-archive.js'
import { writeOwnerDocumentFile } from '../../../runtime/owner-document-file.js'
import { ownerDocumentFromLegacyV15 } from '../../../store/owner-document.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const NOW = 1_800_100_000_000

function sourceArchive(root, ownerId, pigId, name) {
  mkdirSync(root, { recursive: true })
  const documentPath = join(root, 'owner-document.json')
  const state = hatchEgg(NOW); state.name = name
  const document = ownerDocumentFromLegacyV15(state, { ownerId, pigId })
  writeOwnerDocumentFile({ filePath: documentPath, document, expectedRevision: 'missing' })
  return exportOwnerDocumentArchive({ ownerDocumentPath: documentPath, ownerId, nowMs: NOW }).buffer
}

function fakeLifecycle(restart = async () => {}) {
  let saved = false, released = false, recovered = false
  const lifecycle = {
    hostClosed: false,
    reserveAction() { return {} },
    async requireSavedGame() { saved = true; return { saved: true } },
    restartGame: restart,
    releaseAction() { released = true },
    async recoverAction() { recovered = true },
    state() { return { saved, released, recovered } },
  }
  return lifecycle
}

test('a cached runtime without the explicit archive marker is refused before target creation', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'piggy-owner-manager-'))
  const gameDir = join(userData, 'cached-game')
  mkdirSync(join(gameDir, 'runtime'), { recursive: true })
  writeFileSync(join(gameDir, 'runtime/index.js'), 'export const OWNER_ARCHIVE_RUNTIME_API_VERSION = 0\n')
  const selectionStore = createOwnerArchiveSelectionStore(userData)
  const manager = createOwnerArchiveManager({
    archiveRoot: selectionStore.archiveRoot,
    downloadsDir: userData,
    dialog: {}, getWin: () => null,
    getHost: () => ({ handle: async () => ({ status: 200, body: Buffer.from('zip') }) }),
    getGameDir: () => gameDir,
    getOwnerConfig: () => null,
    isSupported: () => false,
    selectionStore,
    lifecycle: {},
    async writeFile() {},
    isQuitting: () => false,
    log() {},
  })
  try {
    assert.equal(manager.status().available, false)
    const result = await manager.previewArchive(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]))
    assert.equal(result.ok, false)
    assert.match(result.reason, /不支持完整存档/)
    assert.equal(readdirSync(userData).includes('owner-archives'), false, 'an old runtime never receives an owner path or creates a target')
    const taskOwner = createOwnerArchiveManager({
      archiveRoot: selectionStore.archiveRoot, downloadsDir: userData, dialog: {}, getWin: () => null,
      getHost: () => ({}), getGameDir: () => ROOT, getOwnerConfig: () => ({ source: 'task' }), isSupported: () => true,
      selectionStore, lifecycle: {}, async writeFile() {}, isQuitting: () => false, log() {},
    })
    assert.equal(taskOwner.status().available, false, 'task-only environment opt-in does not expose the user archive entry')
  } finally { rmSync(userData, { recursive: true, force: true }) }
})

test('desktop export projects the live legacy save to a one-pig complete archive without altering the source file', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'piggy-owner-export-'))
  const statePath = join(userData, 'state.json')
  let host
  let savedPath = ''
  let savedBytes = null
  const manager = createOwnerArchiveManager({
    archiveRoot: join(userData, 'owner-archives'), downloadsDir: userData,
    dialog: { async showSaveDialog(_parent, options) { savedPath = options.defaultPath; return { canceled: false, filePath: join(userData, 'owner.zip') } } },
    getWin: () => null, getHost: () => host, getGameDir: () => ROOT, getOwnerConfig: () => null, isSupported: () => true,
    selectionStore: createOwnerArchiveSelectionStore(userData), lifecycle: fakeLifecycle(),
    async writeFile(_path, bytes) { savedBytes = Buffer.from(bytes) }, isQuitting: () => false, log() {},
  })
  try {
    const state = hatchEgg(NOW)
    state.name = '当前小猪'
    writeFileSync(statePath, JSON.stringify(state))
    host = await startBackgroundHost(ROOT, statePath)
    const settled = await host.handle('GET', '/dsh-piggy/save/export')
    assert.equal(settled.status, 200)
    const sourceBefore = readFileSync(statePath)
    assert.deepEqual(await manager.exportArchive(), { ok: true, downloaded: false })
    assert.match(savedPath, /piggy-owner-save-\d{8}-\d{4}\.zip$/)
    const files = readZip(savedBytes)
    const manifest = JSON.parse(files.get(OWNER_ARCHIVE_MANIFEST).toString('utf8'))
    const document = parseOwnerDocument(files.get(OWNER_DOCUMENT_ENTRY).toString('utf8'))
    assert.equal(manifest.pigIds.length, 1)
    assert.equal(document.pigs.length, 1)
    assert.equal(document.pigs[0].pigId, manifest.pigIds[0])
    assert.deepEqual(readFileSync(statePath), sourceBefore, 'complete export does not migrate or rewrite the current v15 save')
  } finally {
    await host?.dispose()
    rmSync(userData, { recursive: true, force: true })
  }
})

test('valid owner import waits for current host save, stages selection, and restarts through the lifecycle', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'piggy-owner-switch-'))
  const selectionStore = createOwnerArchiveSelectionStore(userData)
  const lifecycle = fakeLifecycle()
  const manager = createOwnerArchiveManager({
    archiveRoot: selectionStore.archiveRoot, downloadsDir: userData, dialog: {}, getWin: () => null,
    getHost: () => ({}), getGameDir: () => ROOT, getOwnerConfig: () => null, isSupported: () => true,
    selectionStore, lifecycle, async writeFile() {}, isQuitting: () => false, log() {},
  })
  try {
    const bytes = sourceArchive(join(userData, 'source'), 'imported-owner', 'first-pig', '小猪甲')
    const preview = await manager.previewArchive(bytes)
    assert.equal(preview.ok, true, JSON.stringify(preview))
    assert.equal(preview.summary.pigs[0].name, '小猪甲')
    const result = await manager.importAndSwitch(preview.token)
    assert.deepEqual(result, { ok: true, restarting: true })
    await new Promise(setImmediate)
    const lifecycleResult = lifecycle.state()
    assert.equal(lifecycleResult.saved, true, 'selection is staged only after the current host reports saved')
    assert.equal(lifecycleResult.released, true)
    const pending = selectionStore.read().pending
    assert.equal(pending.next.ownerId, 'imported-owner')
    assert.equal(pending.next.pigId, 'first-pig', 'first archive pig is selected without creating a target')
    assert.equal(selectionStore.read().active, null, 'new owner is pending until its runtime successfully reopens')
    selectionStore.commitPending()
    assert.equal(selectionStore.read().active.ownerId, 'imported-owner')
  } finally { rmSync(userData, { recursive: true, force: true }) }
})

test('failed restart rolls back the selection while retaining the imported owner directory', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'piggy-owner-switch-failure-'))
  const selectionStore = createOwnerArchiveSelectionStore(userData)
  const originalRoot = join(selectionStore.archiveRoot, 'original')
  const originalPath = join(originalRoot, 'owner-document.json')
  const originalState = hatchEgg(NOW); originalState.name = '当前存档'
  mkdirSync(originalRoot, { recursive: true })
  writeOwnerDocumentFile({ filePath: originalPath,
    document: ownerDocumentFromLegacyV15(originalState, { ownerId: 'current-owner', pigId: 'current-pig' }), expectedRevision: 'missing' })
  selectionStore.stage({ ownerDocumentPath: originalPath, ownerId: 'current-owner', pigId: 'current-pig' })
  selectionStore.commitPending()
  const lifecycle = fakeLifecycle(async () => { throw new Error('simulated relaunch failure') })
  const manager = createOwnerArchiveManager({
    archiveRoot: selectionStore.archiveRoot, downloadsDir: userData, dialog: {}, getWin: () => null,
    getHost: () => ({}), getGameDir: () => ROOT, getOwnerConfig: () => ({ source: 'selection', ...selectionStore.read().active }),
    isSupported: () => true, selectionStore, lifecycle, async writeFile() {}, isQuitting: () => false, log() {},
  })
  try {
    const bytes = sourceArchive(join(userData, 'source'), 'imported-owner', 'imported-pig', '副本小猪')
    const preview = await manager.previewArchive(bytes)
    assert.equal(preview.ok, true)
    const result = await manager.importAndSwitch(preview.token)
    assert.equal(result.ok, true)
    await new Promise(setImmediate)
    assert.deepEqual(selectionStore.read().active, { ownerDocumentPath: originalPath, ownerId: 'current-owner', pigId: 'current-pig' })
    assert.equal(selectionStore.read().pending, null)
    assert.equal(lifecycle.state().recovered, true)
    assert.equal(readdirSync(selectionStore.archiveRoot).filter(name => name.startsWith('archive-')).length, 1,
      'the committed imported copy remains recoverable even though activation failed')
  } finally { rmSync(userData, { recursive: true, force: true }) }
})
