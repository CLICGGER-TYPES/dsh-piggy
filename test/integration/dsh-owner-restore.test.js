// @ts-check
/** DSH cloud-to-local restore: copy validation, selection recovery and fail-closed startup. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'
import { test } from 'node:test'

import { apply } from '../../adapters/dsh/index.js'
import { registerDshOwnerControlRoutes } from '../../adapters/dsh/owner-control-routes.js'
import { createDshOwnerRestoreService } from '../../adapters/dsh/owner-restore.js'
import { clearOwnerCloudReady, writeOwnerCloudReady } from '../../adapters/dsh/owner-cloud.js'
import { hatchEgg } from '../../src/host/core.js'
import { createOwnerArchiveSelectionStore } from '../../runtime/owner-archive-selection.js'
import { createOwnerCloudSync } from '../../runtime/owner-cloud-sync.js'
import { exportOwnerDocumentArchive } from '../../runtime/owner-document-archive.js'
import { inspectOwnerDocumentFile, writeOwnerDocumentFile } from '../../runtime/owner-document-file.js'
import { ownerDocumentFromLegacyV15 } from '../../store/owner-document.js'

const NOW = 1_800_000_000_000
const SETTINGS = { enabled: true, provider: 'github', remote: 'https://github.com/example/piggy.git', branch: 'main' }

function ownerFile(directory, ownerId, pigId, coins = 100) {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const ownerDocumentPath = join(directory, 'owner-document.json')
  const legacy = hatchEgg(NOW)
  legacy.coins = coins
  const document = ownerDocumentFromLegacyV15(legacy, { ownerId, pigId })
  writeOwnerDocumentFile({ filePath: ownerDocumentPath, document, expectedRevision: 'missing' })
  return ownerDocumentPath
}

function createContext() {
  const routes = []
  let cleanup = null
  const webServer = {
    register(route) {
      routes.push(route)
      return () => { const index = routes.indexOf(route); if (index >= 0) routes.splice(index, 1) }
    },
  }
  const ctx = {
    on() {},
    inject(services, handler) {
      if (services[0] === 'webServer') handler({ webServer })
      else if (services[0] === 'commands') handler({ commands: { register() { return () => {} } } })
    },
    effect(effect) { cleanup = effect() },
  }
  return { ctx, routes, dispose: async () => { if (typeof cleanup === 'function') await cleanup() } }
}

async function requestRoute(route, method, path, value) {
  const request = Readable.from(value === undefined ? [] : [Buffer.from(JSON.stringify(value))])
  request.method = method
  request.url = path
  request.headers = value === undefined ? { host: '127.0.0.1:4100' } : { host: '127.0.0.1:4100', 'content-type': 'application/json' }
  request.socket = { remoteAddress: '127.0.0.1' }
  const response = {
    headersSent: false,
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true },
    end(text = '') { this.text = String(text) },
  }
  await route.handler(request, response)
  let body = null
  try { body = JSON.parse(response.text) } catch { /* non-json responses surface via status */ }
  return { status: response.status, body }
}

function selectionFile(dshHome) { return join(dshHome, 'dsh-piggy', 'owner-archive-selection.json') }

function writeSelection(dshHome, active, pending = null) {
  mkdirSync(join(dshHome, 'dsh-piggy'), { recursive: true, mode: 0o700 })
  writeFileSync(selectionFile(dshHome), JSON.stringify({ version: 1, active, pending }))
}

async function withDshHome(dshHome, action) {
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = dshHome
  try { return await action() } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
}

test('owner control routes expose the restore selection and keep its body strict', async t => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-dsh-restore-route-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const calls = []
  let route = null
  const webServer = { register(value) { route = value; return () => {} } }
  registerDshOwnerControlRoutes(webServer, {
    getRuntime: () => ({}),
    getNetwork: () => ({}),
    getCloud: () => ({}),
    getRestore: () => ({
      async import(token, options) {
        calls.push([token, options])
        return token === 'expired' ? { ok: false, reason: 'expired' } : { ok: true, switched: true }
      },
    }),
    getSelection: () => ({ source: 'archive', active: { ownerId: 'owner-a', pigId: 'pig-a' }, pending: null }),
  })
  if (route === null) throw new Error('owner control route was not registered')

  const restored = await requestRoute(route, 'POST', '/dsh-piggy/owner/cloud/restore',
    { token: 'token-a', acceptWarnings: true, pigId: 'pig-a' })
  assert.equal(restored.status, 200)
  assert.deepEqual(calls, [['token-a', { acceptWarnings: true, pigId: 'pig-a' }]])

  const expired = await requestRoute(route, 'POST', '/dsh-piggy/owner/cloud/restore', { token: 'expired' })
  assert.equal(expired.status, 409, 'a refused restore is not reported as applied')
  assert.deepEqual(calls.at(-1), ['expired', { acceptWarnings: false }])

  assert.equal((await requestRoute(route, 'POST', '/dsh-piggy/owner/cloud/restore',
    { token: 'token-a', ownerDocumentPath: '/tmp/elsewhere' })).status, 400,
  'the restore route does not accept a caller-supplied target path')
  assert.equal((await requestRoute(route, 'POST', '/dsh-piggy/owner/cloud/restore', { token: '' })).status, 400)

  const selection = await requestRoute(route, 'GET', '/dsh-piggy/owner/selection')
  assert.equal(selection.status, 200)
  assert.equal(selection.body.active.ownerId, 'owner-a')
})

test('DSH control route restores a cloud owner into DSH_HOME and serves it after the switch', async t => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-dsh-restore-e2e-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const remote = join(root, 'remote.git')
  execFileSync('git', ['init', '--bare', '--initial-branch=main', remote], { stdio: 'ignore' })
  const remoteUrl = 'https://example.invalid/piggy.git'
  const gitConfig = join(root, 'gitconfig')
  writeFileSync(gitConfig, [
    '[user]', '  name = piggy-test', '  email = piggy@localhost',
    `[url "${pathToFileURL(remote).href}"]`, `  insteadOf = ${remoteUrl}`,
  ].join('\n'))
  const previousConfig = process.env.GIT_CONFIG_GLOBAL
  const previousNoSystem = process.env.GIT_CONFIG_NOSYSTEM
  process.env.GIT_CONFIG_GLOBAL = gitConfig
  process.env.GIT_CONFIG_NOSYSTEM = '1'

  try {
    const sourceOwner = ownerFile(join(root, 'source-owner'), 'owner-a', 'pig-a', 777)
    const seed = createOwnerCloudSync({ ownerDocumentPath: sourceOwner, ownerId: 'owner-a', remote: remoteUrl,
      branch: 'main', now: () => NOW })
    try {
      const pushed = await seed.firstSync('local-to-cloud')
      assert.equal(pushed.ok, true, `seed push failed: ${pushed.reason ?? ''}`)
    } finally { await seed.close({ finalPush: false }) }

    const dshHome = join(root, 'dsh-home')
    const basePath = ownerFile(join(root, 'base'), 'owner-b', 'pig-b', 100)
    const baseBytes = readFileSync(basePath)
    await withDshHome(dshHome, async () => {
      const fixture = createContext()
      try {
        apply(fixture.ctx, {
          ownerDocumentPath: basePath, ownerId: 'owner-b', pigId: 'pig-b',
          ownerCloud: { enabled: true, provider: 'git', remote: remoteUrl, branch: 'main' },
        })
        const control = fixture.routes.find(route => route.kind === 'prefix' && route.path === '/dsh-piggy/owner')
        assert.ok(control)
        const preview = await requestRoute(control, 'POST', '/dsh-piggy/owner/cloud/first-sync',
          { direction: 'cloud-to-local' })
        assert.equal(preview.status, 200, JSON.stringify(preview.body))
        assert.equal(preview.body.ownerId, 'owner-a')
        assert.deepEqual(preview.body.pigIds, ['pig-a'])

        const restored = await requestRoute(control, 'POST', '/dsh-piggy/owner/cloud/restore',
          { token: preview.body.token })
        assert.equal(restored.status, 200, JSON.stringify(restored.body))
        assert.equal(restored.body.switched, true)

        const pigA = await requestRoute(control, 'GET', '/dsh-piggy/owner/pigs/pig-a/state')
        assert.equal(pigA.status, 200)
        assert.equal(pigA.body.pig.coins, 777, 'the switched runtime serves the imported owner copy')
        const selection = await requestRoute(control, 'GET', '/dsh-piggy/owner/selection')
        assert.equal(selection.body.active.ownerId, 'owner-a')
        assert.equal(selection.body.pending, null)
        assert.ok(selection.body.active.ownerDocumentPath.startsWith(join(dshHome, 'dsh-piggy', 'owner-archives', 'archive-')))
        assert.deepEqual(readFileSync(basePath), baseBytes, 'the configured owner was never rewritten')
        assert.equal(inspectOwnerDocumentFile(basePath).kind, 'owner-document')
      } finally { await fixture.dispose() }
    })
  } finally {
    if (previousConfig === undefined) delete process.env.GIT_CONFIG_GLOBAL
    else process.env.GIT_CONFIG_GLOBAL = previousConfig
    if (previousNoSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM
    else process.env.GIT_CONFIG_NOSYSTEM = previousNoSystem
  }
})

test('cloud preview validates the remote record and imports a new root under DSH_HOME without touching the old owner', async t => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-dsh-restore-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const archiveRoot = join(root, 'owner-archives')
  const readyDirectory = join(root, 'ready')
  const selectionStore = createOwnerArchiveSelectionStore({ directory: root, archiveRoot })
  const previousPath = ownerFile(join(root, 'base'), 'owner-b', 'pig-b', 100)
  const previousBytes = readFileSync(previousPath)
  const remotePath = ownerFile(join(root, 'remote'), 'owner-a', 'pig-a', 777)
  const remote = exportOwnerDocumentArchive({ ownerDocumentPath: remotePath, ownerId: 'owner-a', nowMs: NOW })
  let active = { ownerDocumentPath: previousPath, ownerId: 'owner-b', pigId: 'pig-b' }

  const runtime = {
    async firstSyncCloud(direction) {
      assert.equal(direction, 'cloud-to-local')
      return { ok: true, archive: new Uint8Array(remote.buffer), ownerId: 'owner-a', pigIds: ['pig-a'],
        summary: { pigCount: 1 }, remoteHead: 'a'.repeat(40) }
    },
  }
  const service = createDshOwnerRestoreService({
    archiveRoot,
    selectionStore,
    getRuntime: () => runtime,
    getActive: () => active,
    getCloudConfig: () => SETTINGS,
    switchOwner: async next => {
      selectionStore.stage(next)
      selectionStore.commitPending()
      active = next
      return { ok: true }
    },
    prepareCloudReady: input => writeOwnerCloudReady({ readyDirectory, config: SETTINGS, ...input }),
    clearCloudReady: input => clearOwnerCloudReady({ readyDirectory, config: SETTINGS, ...input }),
    now: () => NOW,
  })

  const preview = await service.preview()
  assert.equal(preview.ok, true)
  assert.equal(preview.ownerId, 'owner-a')
  assert.deepEqual(preview.pigIds, ['pig-a'])
  assert.match(preview.token, /^[0-9a-f-]{36}$/u)
  assert.deepEqual(readFileSync(previousPath), previousBytes, 'preview never writes the live owner')

  const wrongPig = await service.import(preview.token, { pigId: 'pig-missing' })
  assert.equal(wrongPig.ok, false, 'a pig target absent from the archive is refused before importing')
  assert.equal(selectionStore.read().active, null)

  const imported = await service.import(preview.token)
  assert.equal(imported.ok, true)
  assert.equal(imported.switched, true)
  assert.deepEqual(readFileSync(previousPath), previousBytes, 'the old owner stays byte-identical after the switch')
  const activeSelection = selectionStore.read()
  assert.ok(activeSelection.active)
  assert.equal(activeSelection.active.ownerId, 'owner-a')
  assert.equal(activeSelection.active.pigId, 'pig-a')
  assert.equal(activeSelection.pending, null)
  assert.ok(activeSelection.active.ownerDocumentPath.startsWith(join(archiveRoot, 'archive-')))
  const importedDocument = inspectOwnerDocumentFile(activeSelection.active.ownerDocumentPath)
  assert.equal(importedDocument.kind, 'owner-document')
  if (importedDocument.kind === 'owner-document') assert.equal(importedDocument.document.resources.coins, 777)
  assert.equal(readdirSync(readyDirectory).includes('owner-cloud-ready.json'), true)

  const replay = await service.import(preview.token)
  assert.equal(replay.ok, false, 'an imported preview token cannot be replayed')
  assert.deepEqual(readFileSync(previousPath), previousBytes)
})

test('restore rolls back the pending selection and keeps the new copy when activation fails', async t => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-dsh-restore-fail-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const archiveRoot = join(root, 'owner-archives')
  const readyDirectory = join(root, 'ready')
  const selectionStore = createOwnerArchiveSelectionStore({ directory: root, archiveRoot })
  const previousPath = ownerFile(join(root, 'base'), 'owner-b', 'pig-b', 100)
  const remotePath = ownerFile(join(root, 'remote'), 'owner-a', 'pig-a', 777)
  const remote = exportOwnerDocumentArchive({ ownerDocumentPath: remotePath, ownerId: 'owner-a', nowMs: NOW })
  const active = { ownerDocumentPath: previousPath, ownerId: 'owner-b', pigId: 'pig-b' }
  const runtime = {
    async firstSyncCloud() {
      return { ok: true, archive: new Uint8Array(remote.buffer), ownerId: 'owner-a', pigIds: ['pig-a'],
        summary: { pigCount: 1 }, remoteHead: 'b'.repeat(40) }
    },
  }
  const service = createDshOwnerRestoreService({
    archiveRoot,
    selectionStore,
    getRuntime: () => runtime,
    getActive: () => active,
    getCloudConfig: () => SETTINGS,
    switchOwner: async next => {
      selectionStore.stage(next)
      selectionStore.rollbackPending()
      return { ok: false, reason: 'simulated activation failure' }
    },
    prepareCloudReady: input => writeOwnerCloudReady({ readyDirectory, config: SETTINGS, ...input }),
    clearCloudReady: input => clearOwnerCloudReady({ readyDirectory, config: SETTINGS, ...input }),
    now: () => NOW,
  })
  const preview = await service.preview()
  assert.equal(preview.ok, true)
  const imported = await service.import(preview.token)
  assert.equal(imported.ok, false)
  assert.equal(imported.imported, true)
  assert.equal(selectionStore.read().active, null, 'the previous active owner (configured root) is still selected')
  const copyRoots = readdirSync(archiveRoot).filter(name => name.startsWith('archive-'))
  assert.equal(copyRoots.length, 1, 'the imported copy is kept as evidence')
  assert.equal(readdirSync(readyDirectory).includes('owner-cloud-ready.json'), false,
    'a readiness record for the failed switch is not left behind')
})

test('startup uses the active archive selection and refuses corrupted or missing selections', async t => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-dsh-selection-startup-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const dshHome = join(root, 'dsh-home')
  const archiveRoot = join(dshHome, 'dsh-piggy', 'owner-archives')
  const basePath = ownerFile(join(root, 'base'), 'owner-b', 'pig-b', 100)
  const baseBytes = readFileSync(basePath)
  const archivePath = ownerFile(join(archiveRoot, 'archive-a'), 'owner-a', 'pig-a', 555)
  writeSelection(dshHome, { ownerDocumentPath: archivePath, ownerId: 'owner-a', pigId: 'pig-a' })

  await withDshHome(dshHome, async () => {
    const fixture = createContext()
    try {
      apply(fixture.ctx, { ownerDocumentPath: basePath, ownerId: 'owner-b', pigId: 'pig-b' })
      const control = fixture.routes.find(route => route.kind === 'prefix' && route.path === '/dsh-piggy/owner')
      assert.ok(control)
      const stateA = await requestRoute(control, 'GET', '/dsh-piggy/owner/pigs/pig-a/state')
      assert.equal(stateA.status, 200)
      assert.ok(stateA.body.pig)
      const selection = await requestRoute(control, 'GET', '/dsh-piggy/owner/selection')
      assert.equal(selection.body.source, 'archive')
      assert.equal(selection.body.active.ownerId, 'owner-a')
      assert.deepEqual(readFileSync(basePath), baseBytes, 'startup never rewrites the configured owner')
    } finally { await fixture.dispose() }
  })

  await withDshHome(dshHome, async () => {
    writeSelection(dshHome, { ownerDocumentPath: join(archiveRoot, 'archive-missing', 'owner-document.json'),
      ownerId: 'owner-a', pigId: 'pig-a' })
    assert.throws(() => apply(createContext().ctx, { ownerDocumentPath: basePath, ownerId: 'owner-b', pigId: 'pig-b' }),
      /所选存档文件不存在/)

    writeFileSync(selectionFile(dshHome), '{"version":1,"active":null}')
    assert.throws(() => apply(createContext().ctx, { ownerDocumentPath: basePath, ownerId: 'owner-b', pigId: 'pig-b' }),
      /损坏/)
  })
})

test('startup commits a verified pending copy, but rolls back when the runtime cannot open it', async t => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-dsh-selection-pending-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const dshHome = join(root, 'dsh-home')
  const archiveRoot = join(dshHome, 'dsh-piggy', 'owner-archives')
  const basePath = ownerFile(join(root, 'base'), 'owner-b', 'pig-b', 100)
  const archiveA = ownerFile(join(archiveRoot, 'archive-a'), 'owner-a', 'pig-a', 555)
  const archiveB = ownerFile(join(archiveRoot, 'archive-b'), 'owner-c', 'pig-c', 666)
  const activeA = { ownerDocumentPath: archiveA, ownerId: 'owner-a', pigId: 'pig-a' }

  await withDshHome(dshHome, async () => {
    writeSelection(dshHome, activeA, { previous: activeA, next: { ownerDocumentPath: archiveB, ownerId: 'owner-c', pigId: 'pig-c' } })
    const fixture = createContext()
    try {
      apply(fixture.ctx, { ownerDocumentPath: basePath, ownerId: 'owner-b', pigId: 'pig-b' })
      const control = fixture.routes.find(route => route.kind === 'prefix' && route.path === '/dsh-piggy/owner')
      const stateC = await requestRoute(control, 'GET', '/dsh-piggy/owner/pigs/pig-c/state')
      assert.equal(stateC.status, 200, 'the verified pending copy becomes active')
      const selection = await requestRoute(control, 'GET', '/dsh-piggy/owner/selection')
      assert.equal(selection.body.active.ownerId, 'owner-c')
      assert.equal(selection.body.pending, null)
    } finally { await fixture.dispose() }

    const archiveC = ownerFile(join(archiveRoot, 'archive-c'), 'owner-d', 'pig-d', 777)
    // A regular file where the runtime needs its work directory makes the copy
    // readable but unopenable, exercising the post-open rollback path.
    writeFileSync(`${archiveC}.work-events`, 'not a directory')
    writeSelection(dshHome, activeA, { previous: activeA, next: { ownerDocumentPath: archiveC, ownerId: 'owner-d', pigId: 'pig-d' } })
    const second = createContext()
    try {
      apply(second.ctx, { ownerDocumentPath: basePath, ownerId: 'owner-b', pigId: 'pig-b' })
      const control = second.routes.find(route => route.kind === 'prefix' && route.path === '/dsh-piggy/owner')
      const stateA = await requestRoute(control, 'GET', '/dsh-piggy/owner/pigs/pig-a/state')
      assert.equal(stateA.status, 200, 'the previous active owner is reopened')
      const selection = await requestRoute(control, 'GET', '/dsh-piggy/owner/selection')
      assert.equal(selection.body.active.ownerId, 'owner-a')
      assert.equal(selection.body.pending, null, 'the failed pending switch rolled back')
      assert.equal(inspectOwnerDocumentFile(archiveC).kind, 'owner-document', 'the new copy is kept')
    } finally { await second.dispose() }
  })
})
