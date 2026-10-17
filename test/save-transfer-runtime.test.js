import assert from 'node:assert/strict'
import fsSync from 'node:fs'
import fsPromises from 'node:fs/promises'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { hatchEgg } from '../core.js'
import { createGameRuntime } from '../runtime/index.js'
import { createSaveArchive } from '../runtime/save-archive.js'

const NOW = 1_800_000_000_000
const directory = () => mkdtempSync(path.join(tmpdir(), 'piggy-save-runtime-'))
const readJson = file => JSON.parse(readFileSync(file, 'utf8'))
const json = response => JSON.parse(response.body)
const event = { version: 1, source: 'save-transfer-test', id: 'turn:receipt-1', type: 'turn', at: NOW }
const importToken = (runtime, token) => runtime.handle('POST', '/dsh-piggy/save/import', JSON.stringify({ token }))

async function preview(runtime, archive) {
  const response = await runtime.handle('POST', '/dsh-piggy/save/preview', archive)
  assert.equal(response.status, 200, String(response.body))
  return json(response)
}

test('real runtime export and import rebind an arbitrary basename across directories and restore receipt dedupe', async () => {
  const root = directory()
  const sourcePath = path.join(root, 'source', 'origin-pig.json')
  const targetPath = path.join(root, 'different', 'nested', 'portable-profile.data')
  let source, target
  try {
    mkdirSync(path.dirname(sourcePath), { recursive: true })
    writeFileSync(sourcePath, JSON.stringify(hatchEgg(NOW)))
    mkdirSync(path.dirname(targetPath), { recursive: true })
    source = createGameRuntime({ statePath: sourcePath, now: () => NOW })
    assert.equal(source.acceptWorkEvent(event).status, 'applied')
    const exported = await source.handle('GET', '/dsh-piggy/save/export')
    assert.equal(exported.status, 200)
    assert.equal(exported.headers['content-type'], 'application/zip')
    assert.ok(Buffer.isBuffer(exported.body))

    target = createGameRuntime({ statePath: targetPath, now: () => NOW })
    const renamedOld = await target.handle('POST', '/dsh-piggy/act', JSON.stringify({ action: 'name', name: '旧猪' }))
    assert.equal(renamedOld.status, 200)
    const mounted = new Map()
    target.mountRoutes({ register(route) { mounted.set(route.path, route.handler); return () => {} } })
    const parsed = await preview(target, exported.body)
    assert.equal(parsed.summary.name, readJson(sourcePath).name)
    const before = { ...readJson(sourcePath) }
    const imported = await importToken(target, parsed.token)
    assert.equal(imported.status, 200, String(imported.body))
    assert.equal(json(imported).ok, true)
    assert.equal(readJson(targetPath).name, before.name)
    assert.equal(readJson(targetPath).coins, before.coins)
    assert.equal(target.acceptWorkEvent(event).status, 'duplicate')
    const importedState = readJson(targetPath)
    assert.equal(importedState.name, readJson(sourcePath).name)
    assert.equal(importedState.coins, readJson(sourcePath).coins)

    // The old Store's 1.5s timer must not later overwrite the imported snapshot.
    await new Promise(resolve => setTimeout(resolve, 1650))
    assert.deepEqual(readJson(targetPath), importedState)

    const response = await new Promise(resolve => {
      let status = 200, body = ''
      mounted.get('/dsh-piggy/state')({ method: 'GET', url: '/dsh-piggy/state' }, {
        writeHead(code) { status = code }, setHeader() {}, end(chunk) { body = String(chunk ?? ''); resolve({ status, body }) },
      })
    })
    assert.equal(response.status, 200)
    assert.equal(JSON.parse(response.body).pig.name, before.name)
  } finally {
    source?.dispose(); target?.dispose(); rmSync(root, { recursive: true, force: true })
  }
})

test('an unhatched archive imports into a runtime without creating a state file', async () => {
  const root = directory(), statePath = path.join(root, 'save-without-hatch.json')
  let runtime
  try {
    runtime = createGameRuntime({ statePath, now: () => NOW })
    const archive = createSaveArchive({ statePath: path.join(root, 'from-other-device.json'), state: null, nowMs: NOW })
    const parsed = await preview(runtime, archive.buffer)
    assert.equal(parsed.summary.name, '未孵化')
    const result = await importToken(runtime, parsed.token)
    assert.equal(result.status, 200, String(result.body))
    assert.equal(existsSync(statePath), false)
    const state = await runtime.handle('GET', '/dsh-piggy/state')
    assert.equal(state.status, 200)
    assert.equal(json(state).pig, null)
  } finally { runtime?.dispose(); rmSync(root, { recursive: true, force: true }) }
})

test('invalid preview returns an error without writing or replacing managed files', async () => {
  const root = directory(), statePath = path.join(root, 'keep-profile.json')
  const original = hatchEgg(NOW)
  writeFileSync(statePath, JSON.stringify(original))
  writeFileSync(path.join(root, 'keep.txt'), 'leave me')
  let runtime
  try {
    runtime = createGameRuntime({ statePath, now: () => NOW })
    const before = readFileSync(statePath)
    const result = await runtime.handle('POST', '/dsh-piggy/save/preview', Buffer.from('{not a save'))
    assert.equal(result.status, 400)
    assert.equal(readFileSync(statePath).compare(before), 0)
    assert.equal(readFileSync(path.join(root, 'keep.txt'), 'utf8'), 'leave me')
    assert.equal(existsSync(path.join(root, 'backups')), false)
  } finally { runtime?.dispose(); rmSync(root, { recursive: true, force: true }) }
})

test('two imports racing for the same preview perform at most one replacement', async () => {
  const root = directory()
  const sourcePath = path.join(root, 'source', 'source-save.json')
  const targetPath = path.join(root, 'target', 'another-name.json')
  let source, target
  try {
    mkdirSync(path.dirname(sourcePath), { recursive: true })
    writeFileSync(sourcePath, JSON.stringify(hatchEgg(NOW)))
    source = createGameRuntime({ statePath: sourcePath, now: () => NOW })
    const exported = await source.handle('GET', '/dsh-piggy/save/export')
    mkdirSync(path.dirname(targetPath), { recursive: true })
    target = createGameRuntime({ statePath: targetPath, now: () => NOW })
    const parsed = await preview(target, exported.body)
    const results = await Promise.all([importToken(target, parsed.token), importToken(target, parsed.token)])
    assert.deepEqual(results.map(result => result.status).sort(), [200, 503])
    assert.equal(readJson(targetPath).name, readJson(sourcePath).name)
  } finally { source?.dispose(); target?.dispose(); rmSync(root, { recursive: true, force: true }) }
})

test('import freezes new work and waits for an already active game route to drain', async () => {
  const root = directory()
  const sourcePath = path.join(root, 'source', 'source.json')
  const targetPath = path.join(root, 'target', 'target.json')
  let source, target, releaseFetch, fetchStarted = false
  try {
    mkdirSync(path.dirname(sourcePath), { recursive: true })
    mkdirSync(path.dirname(targetPath), { recursive: true })
    writeFileSync(sourcePath, JSON.stringify(hatchEgg(NOW)))
    writeFileSync(targetPath, JSON.stringify(hatchEgg(NOW)))
    source = createGameRuntime({ statePath: sourcePath, now: () => NOW })
    target = createGameRuntime({ statePath: targetPath, now: () => NOW,
      fetch: () => { fetchStarted = true; return new Promise(resolve => { releaseFetch = resolve }) } })
    const exported = await source.handle('GET', '/dsh-piggy/save/export')
    const parsed = await preview(target, exported.body)
    const activeRoute = target.handle('GET', '/dsh-piggy/extensions/online?force=1')
    while (!fetchStarted) await new Promise(resolve => setImmediate(resolve))

    let settled = false
    const importing = importToken(target, parsed.token).then(result => { settled = true; return result })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(settled, false, 'import must drain the pending game route')
    assert.throws(() => target.dispatchCommand('hatch'), /正在处理存档/)

    releaseFetch({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ extensions: [] }) })
    const [routeResult, importResult] = await Promise.all([activeRoute, importing])
    assert.equal(routeResult.status, 200)
    assert.equal(importResult.status, 200, String(importResult.body))
  } finally { source?.dispose(); target?.dispose(); rmSync(root, { recursive: true, force: true }) }
})

test('dispose during import activation aborts the transaction and preserves the previous save', async () => {
  const root = directory()
  const sourcePath = path.join(root, 'source', 'source.json')
  const targetPath = path.join(root, 'target', 'target.json')
  const old = hatchEgg(NOW); old.name = '原存档'
  mkdirSync(path.dirname(sourcePath), { recursive: true })
  writeFileSync(sourcePath, JSON.stringify(hatchEgg(NOW)))
  mkdirSync(path.dirname(targetPath), { recursive: true })
  writeFileSync(targetPath, JSON.stringify(old))
  let target, closeOnBackup = false
  const now = () => {
    if (closeOnBackup) queueMicrotask(() => target.dispose())
    return NOW
  }
  let source
  try {
    source = createGameRuntime({ statePath: sourcePath, now: () => NOW })
    target = createGameRuntime({ statePath: targetPath, now })
    const exported = await source.handle('GET', '/dsh-piggy/save/export')
    const parsed = await preview(target, exported.body)
    closeOnBackup = true
    const result = await importToken(target, parsed.token)
    closeOnBackup = false
    assert.equal(result.status, 400)
    assert.equal(readJson(targetPath).name, '原存档')
    assert.equal(readdirSync(path.dirname(targetPath)).some(name => name.startsWith('.piggy-save-import-')), false)
    target = createGameRuntime({ statePath: targetPath, now: () => NOW })
    assert.equal(readJson(targetPath).name, '原存档', 'dispose releases the owner lock after rollback')
  } finally { closeOnBackup = false; source?.dispose(); target?.dispose(); rmSync(root, { recursive: true, force: true }) }
})

test('rollback failure faults the runtime closed until a new runtime recovers the journal', async t => {
  const root = directory(), statePath = path.join(root, 'faulted-profile.json')
  const old = hatchEgg(NOW); old.name = '回滚前的小猪'
  const imported = hatchEgg(NOW); imported.name = '待导入的小猪'
  writeFileSync(statePath, JSON.stringify(old))
  let headerCalls = 0
  const journalHeader = new Proxy({}, { ownKeys() {
    headerCalls += 1
    if (headerCalls === 2) throw new Error('injected activation failure')
    return []
  } })
  const originalAsyncCopy = fsPromises.copyFile.bind(fsPromises)
  const originalSyncCopy = fsSync.copyFileSync.bind(fsSync)
  const originalRename = fsSync.renameSync.bind(fsSync)
  let stateWriteAttempts = 0, runtime, retry
  try {
    runtime = createGameRuntime({ statePath, now: () => NOW, journalHeader })
    const archive = createSaveArchive({ statePath: path.join(root, 'other-device.json'), state: imported, nowMs: NOW })
    const parsed = await preview(runtime, archive.buffer)
    t.mock.method(fsPromises, 'copyFile', async (source, destination, ...args) => {
      if (String(source).split(path.sep).includes('old')) throw new Error('injected async rollback copy failure')
      return originalAsyncCopy(source, destination, ...args)
    })
    t.mock.method(fsSync, 'copyFileSync', (source, destination, ...args) => {
      if (String(source).split(path.sep).includes('old')) throw new Error('injected sync rollback copy failure')
      return originalSyncCopy(source, destination, ...args)
    })
    t.mock.method(fsSync, 'renameSync', (source, destination, ...args) => {
      if (destination === statePath) stateWriteAttempts += 1
      return originalRename(source, destination, ...args)
    })

    const result = await importToken(runtime, parsed.token)
    assert.equal(result.status, 400)
    assert.equal(headerCalls, 2)
    assert.equal(existsSync(statePath), false, 'both rollback attempts fail before restoring state.json')
    assert.ok(readdirSync(root).some(name => name.startsWith('.piggy-save-import-')), 'applying journal remains for restart recovery')

    const state = await runtime.handle('GET', '/dsh-piggy/state')
    const action = await runtime.handle('POST', '/dsh-piggy/act', JSON.stringify({ action: 'hatch' }))
    assert.equal(state.status, 503)
    assert.equal(action.status, 503)
    assert.throws(() => runtime.dispatchCommand('hatch'), error => error.status === 503)
    assert.throws(() => runtime.acceptWorkEvent(event), error => error.status === 503)

    runtime.dispose()
    runtime = null
    assert.equal(existsSync(statePath), false, 'faulted dispose must not flush a replacement state')
    assert.equal(stateWriteAttempts, 0)

    t.mock.restoreAll()
    retry = createGameRuntime({ statePath, now: () => NOW, journalHeader })
    assert.equal(readJson(statePath).name, '回滚前的小猪')
    assert.equal((await retry.handle('GET', '/dsh-piggy/state')).status, 200)
  } finally {
    t.mock.restoreAll()
    runtime?.dispose(); retry?.dispose()
    rmSync(root, { recursive: true, force: true })
  }
})
