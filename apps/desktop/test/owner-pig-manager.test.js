// @ts-check
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { hatchEgg } from '../../../core.js'
import { ownerDocumentFromLegacyV15 } from '../../../store/owner-document.js'
import { writeOwnerDocumentFile } from '../../../runtime/owner-document-file.js'
import { createOwnerArchiveSelectionStore } from '../lib/owner-archive-selection.js'
import { createDesktopLifecycle } from '../lib/desktop-lifecycle.js'
import { createOwnerPigManager } from '../lib/owner-pig-manager.js'
import { registerOwnerPigsIpc } from '../lib/ipc/owner-pigs.js'
import { startBackgroundHost } from '../lib/background-host.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const NOW = 1_800_100_000_000

test('panel owner-pig service creates a durable body-only pig and switches the stored target', async t => {
  const userData = mkdtempSync(join(tmpdir(), 'piggy-owner-pigs-'))
  t.after(() => rmSync(userData, { recursive: true, force: true }))
  const selectionStore = createOwnerArchiveSelectionStore(userData)
  const ownerDocumentPath = join(selectionStore.archiveRoot, 'archive-a', 'owner-document.json')
  mkdirSync(join(selectionStore.archiveRoot, 'archive-a'), { recursive: true, mode: 0o700 })

  const initial = hatchEgg(NOW)
  initial.name = '团团'
  initial.coins = 765
  initial.inventory = { apple: 2 }
  initial.extData = { farm: { version: 6, plots: [], seeds: { apple: 3 }, harvest: {} } }
  const ownerId = 'owner-local'
  const originalPigId = 'pig-a'
  const document = ownerDocumentFromLegacyV15(initial, { ownerId, pigId: originalPigId })
  writeOwnerDocumentFile({ filePath: ownerDocumentPath, document, expectedRevision: 'missing' })
  selectionStore.stage({ ownerDocumentPath, ownerId, pigId: originalPigId })
  selectionStore.commitPending()

  async function launch(pigId) {
    return startBackgroundHost(ROOT, ownerDocumentPath, {
      ownerDocument: { ownerDocumentPath, ownerId, pigId }, workEventsAutoStart: false,
    })
  }
  function makeProcess(initialHost, initialPigId) {
    let host = initialHost
    let selectedPigId = initialPigId
    let resolveRestart, rejectRestart
    const restarted = new Promise((resolve, reject) => { resolveRestart = resolve; rejectRestart = reject })
    const resources = () => ({
      host, hostStarting: null, versions: null, versionsStarting: null, shellUpdates: null, proxySettings: null,
      fullscreenWatch: null, externalManager: null, autostart: { flush: async () => {} }, exportWrites: new Set(),
      topGuardTimer: null, displayWatchTimer: null, hitTimer: null, stateTimer: null,
      flushWindowState: async () => {}, flushLogs: async () => {},
    })
    const lifecycle = createDesktopLifecycle({
      app: { on() {}, quit() {}, exit() {} },
      dialog: { async showMessageBox() { return { response: 0 } } },
      log() {}, stopDrag() {}, isCapture: () => false,
      clearInterval, clearTimeout,
      getResources: resources,
      setExternalManager() {}, setHitTimer() {},
      relaunch() {
        const pending = selectionStore.read().pending
        if (pending === null) { rejectRestart(new Error('test restart had no pending selection')); return }
        void launch(pending.next.pigId).then(nextHost => {
          selectionStore.commitPending()
          host = nextHost
          selectedPigId = pending.next.pigId
          resolveRestart()
        }, rejectRestart)
      },
    })
    const manager = createOwnerPigManager({
      getHost: () => host,
      getOwnerConfig: () => ({ ownerDocumentPath, ownerId, pigId: selectedPigId, source: 'selection' }),
      isSupported: () => true,
      selectionStore,
      lifecycle,
      isQuitting: () => lifecycle.quitting,
      log() {},
    })
    return { manager, lifecycle, restarted, getHost: () => host, getPigId: () => selectedPigId }
  }

  const initialHost = await launch(originalPigId)
  const firstProcess = makeProcess(initialHost, originalPigId)
  let finalHost = firstProcess.getHost()

  try {
    assert.deepEqual(firstProcess.manager.status(), { ok: true, available: true, mode: 'owner', activePigId: originalPigId, hostReady: true })
    const initialRoster = await firstProcess.manager.list()
    assert.equal(initialRoster.ok, true)
    assert.equal(initialRoster.pigs.length, 1)
    assert.equal(initialRoster.pigs[0].selected, true)
    assert.equal((await firstProcess.manager.select('foreign-pig')).ok, false, 'renderer cannot select an ID absent from this owner runtime')

    const added = await firstProcess.manager.addAndSelect()
    assert.equal(added.ok, true)
    assert.equal(added.restarting, true)
    assert.match(added.pigId, /^[0-9a-f-]{36}$/)
    await firstProcess.restarted

    const selected = selectionStore.read().active
    assert.equal(selected.ownerId, ownerId)
    assert.equal(selected.ownerDocumentPath, ownerDocumentPath)
    assert.equal(selected.pigId, added.pigId)
    const secondProcess = makeProcess(firstProcess.getHost(), added.pigId)
    const response = await secondProcess.getHost().handle('GET', '/dsh-piggy/state')
    const current = JSON.parse(String(response.body))
    assert.equal(current.pig.name, '猪猪')
    assert.equal(current.hatched, false)
    assert.equal(current.pig.coins, 765)
    assert.equal(current.pigId, undefined, 'identity remains a response header, not a new flat-state field')
    const roster = await secondProcess.manager.list()
    assert.equal(roster.ok, true)
    assert.deepEqual(roster.pigs.map(pig => pig.pigId), [originalPigId, added.pigId])
    assert.equal(roster.pigs[0].selected, false)
    assert.equal(roster.pigs[1].selected, true)
    const switched = await secondProcess.manager.select(originalPigId)
    assert.equal(switched.ok, true)
    assert.equal(switched.restarting, true)
    await secondProcess.restarted
    assert.equal(selectionStore.read().active.pigId, originalPigId)
    assert.equal(secondProcess.getPigId(), originalPigId)
    finalHost = secondProcess.getHost()
  } finally {
    await finalHost.dispose().catch(() => {})
  }
})

test('owner-pig IPC accepts only the panel and exposes no path or owner arguments', async () => {
  const handlers = new Map()
  const calls = []
  const manager = {
    status: () => ({ ok: true, available: true }),
    list: () => ({ ok: true, pigs: [] }),
    select: value => { calls.push(['select', value]); return { ok: true } },
    addAndSelect: () => { calls.push(['add']); return { ok: true } },
  }
  registerOwnerPigsIpc({ ipcMain: { handle(name, handler) { handlers.set(name, handler) } }, fromPanelOnly: event => event?.panel === true, manager })
  assert.deepEqual(await handlers.get('piggy:owner-pigs:list')({ panel: false }), { ok: false, reason: '来源不对' })
  assert.deepEqual(await handlers.get('piggy:owner-pigs:select')({ panel: true }, 'pig-a'), { ok: true })
  assert.deepEqual(calls, [['select', 'pig-a']])
  assert.deepEqual([...handlers.keys()], [
    'piggy:owner-pigs:status', 'piggy:owner-pigs:list', 'piggy:owner-pigs:select', 'piggy:owner-pigs:add-and-select',
  ])
})

test('legacy v15 and packages without the owner-pig capability do not gain a roster path', async () => {
  let calls = 0
  const manager = createOwnerPigManager({
    getHost: () => ({ listOwnerPigs() { calls += 1 }, createOwnerPig() { calls += 1 } }),
    getOwnerConfig: () => null,
    isSupported: () => false,
    selectionStore: { read() { throw new Error('must not read owner selection in legacy mode') } },
    lifecycle: { reserveAction() { calls += 1 } },
    isQuitting: () => false,
    log() {},
  })
  assert.equal(manager.status().available, false)
  assert.equal((await manager.list()).ok, false)
  assert.equal((await manager.addAndSelect()).ok, false)
  assert.equal(calls, 0, 'default legacy v15 does not start an owner runtime or create a pig')
})
