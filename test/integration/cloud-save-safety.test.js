import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'

import { hatchEgg } from '../../core.js'
import { createGameRuntime } from '../../runtime/index.js'
import { createSaveArchive, parseSaveArchive } from '../../runtime/save-archive.js'
import { createGitSync, defaultGit } from '../../runtime/git-sync.js'

const NOW = Date.UTC(2026, 10, 1, 12)
const temp = () => mkdtempSync(path.join(tmpdir(), 'piggy-cloud-safety-'))

function fakeGit() {
  let active = 0
  let maxActive = 0
  const calls = []
  return {
    calls,
    maxActive: () => maxActive,
    git: async args => {
      active += 1
      maxActive = Math.max(maxActive, active)
      calls.push([...args])
      try {
        if (args[0] === 'remote') return { stdout: 'origin\n', stderr: '' }
        if (args[0] === 'status') return { stdout: '', stderr: '' }
        if (args[0] === 'log' || args[0] === 'ls-remote') return { stdout: '', stderr: '' }
        return { stdout: '', stderr: '' }
      } finally {
        active -= 1
      }
    },
  }
}

test('Git operations share one queue, recover after failure, reject overflow, and close explicitly', async () => {
  const root = temp()
  let release
  let started
  const gate = new Promise(resolve => { release = resolve })
  const didStart = new Promise(resolve => { started = resolve })
  const fake = fakeGit()
  // Replace the one blocked command with a deterministic rejection, then prove a later item still runs.
  const sync = createGitSync({
    statePath: path.join(root, 'state.json'), directory: path.join(root, 'cloud-save'), remote: 'file:///unused',
    branch: 'main', maxQueuedOperations: 1,
    archive: async () => ({ buffer: Buffer.from('save') }),
    parse: async () => ({ files: new Map() }), importFiles: async () => {},
    git: async args => {
      if (args[0] === 'status') {
        started()
        await gate
        throw new Error('injected git failure')
      }
      return fake.git(args)
    },
  })
  try {
    const failing = sync.dirty()
    await didStart
    await assert.rejects(sync.ensure(), /queue is full/)
    release()
    await assert.rejects(failing, /injected git failure/)
    assert.equal(await sync.ensure(), path.join(root, 'cloud-save'))
    const closed = await sync.close({ finalPush: false })
    assert.deepEqual(closed, { drained: true, finalPush: false })
    await assert.rejects(sync.ensure(), /queue is closing/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('concurrent public Git tasks serialize across complete operations', async () => {
  const root = temp()
  const fake = fakeGit()
  const sync = createGitSync({
    statePath: path.join(root, 'state.json'), directory: path.join(root, 'cloud-save'), remote: 'file:///unused',
    archive: async () => ({ buffer: Buffer.from('save') }),
    parse: async () => ({ files: new Map() }), importFiles: async () => {},
    git: async (...args) => {
      await new Promise(resolve => setTimeout(resolve, 2))
      return fake.git(...args)
    },
  })
  try {
    await Promise.all([sync.pushSnapshot(), sync.history(), sync.listBranches()])
    assert.equal(fake.maxActive(), 1)
    const result = await sync.close({ finalPush: true })
    assert.equal(result.finalPush, true)
    assert.equal(fake.calls.filter(args => args[0] === 'push').length, 2, 'close waits for one final push')
  } finally { await sync.close({ finalPush: false }).catch(() => {}); rmSync(root, { recursive: true, force: true }) }
})

test('close drains accepted queue work before it performs its one final push', async () => {
  const root = temp()
  let release, started
  const gate = new Promise(resolve => { release = resolve })
  const startedPromise = new Promise(resolve => { started = resolve })
  const fake = fakeGit()
  const sync = createGitSync({
    statePath: path.join(root, 'state.json'), directory: path.join(root, 'cloud-save'), remote: 'file:///unused',
    archive: async () => ({ buffer: Buffer.from('save') }),
    parse: async () => ({ files: new Map() }), importFiles: async () => {}, git: fake.git,
  })
  try {
    const accepted = sync.sequence(async () => { started(); await gate; return 'finished' })
    await startedPromise
    let closed = false
    const closing = sync.close({ finalPush: true }).then(result => { closed = true; return result })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(closed, false, 'close must wait for accepted queue work')
    await assert.rejects(sync.ensure(), /queue is closing/)
    release()
    assert.equal(await accepted, 'finished')
    assert.equal((await closing).finalPush, true)
    assert.equal(fake.calls.filter(args => args[0] === 'push').length, 1)
  } finally { release(); await sync.close({ finalPush: false }).catch(() => {}); rmSync(root, { recursive: true, force: true }) }
})

test('the default Git child process has an enforced timeout', async t => {
  if (process.platform === 'win32' || !existsSync('/bin/sleep')) return t.skip('requires POSIX test executable')
  const root = temp(), bin = path.join(root, 'bin')
  const oldPath = process.env.PATH
  try {
    mkdirSync(bin)
    const executable = path.join(bin, 'git')
    writeFileSync(executable, '#!/bin/sh\nexec /bin/sleep 2\n')
    chmodSync(executable, 0o755)
    process.env.PATH = `${bin}${path.delimiter}${oldPath ?? ''}`
    await assert.rejects(defaultGit(['push'], { cwd: root, timeoutMs: 40 }), error => error.code === 'GIT_TIMEOUT')
  } finally {
    if (oldPath === undefined) delete process.env.PATH
    else process.env.PATH = oldPath
    rmSync(root, { recursive: true, force: true })
  }
})

test('cloud restore uses the local save transaction and close waits for the final result', async () => {
  const root = temp()
  const remote = path.join(root, 'private-save.git')
  const seedPath = path.join(root, 'seed', 'source.json')
  const targetPath = path.join(root, 'target', 'local.json')
  const seedWorktree = path.join(root, 'seed-worktree')
  let seed, runtime
  try {
    execFileSync('git', ['init', '--bare', '-q', '-b', 'main', remote], { stdio: 'ignore' })
    const incoming = hatchEgg(NOW)
    incoming.name = '云端猪'
    incoming.coins = 907
    incoming.inventory = { ...(incoming.inventory ?? {}), apple: 13 }
    incoming.isOfflineFeedEnabled = false
    incoming.extData = { ...(incoming.extData ?? {}), cloudFixture: { marker: 'preserved' } }
    mkdirSync(path.dirname(seedPath), { recursive: true })
    writeFileSync(seedPath, JSON.stringify(incoming))
    seed = createGitSync({
      statePath: seedPath, directory: seedWorktree, remote, branch: 'main',
      archive: async () => createSaveArchive({ statePath: seedPath, state: incoming, nowMs: NOW }),
      parse: async (_name, bytes) => parseSaveArchive(bytes), importFiles: async () => {},
    })
    await seed.pushSnapshot({ manual: true })
    await seed.close({ finalPush: false })
    seed = null

    const local = hatchEgg(NOW)
    local.name = '本地猪'
    local.coins = 111
    mkdirSync(path.dirname(targetPath), { recursive: true })
    writeFileSync(targetPath, JSON.stringify(local))
    runtime = createGameRuntime({ statePath: targetPath, now: () => NOW,
      cloudSave: { enabled: true, remote, branch: 'main', debounceMs: 60_000 } })

    const response = await runtime.handle('POST', '/dsh-piggy/cloud/pull', JSON.stringify({ branch: 'main' }))
    assert.equal(response.status, 200)
    const result = JSON.parse(response.body)
    assert.equal(result.ok, true, JSON.stringify(result))
    const restored = JSON.parse(readFileSync(targetPath, 'utf8'))
    assert.equal(restored.name, '云端猪')
    assert.equal(restored.coins, 907)
    assert.equal(restored.inventory.apple, 13)
    assert.equal(restored.isOfflineFeedEnabled, false)
    assert.deepEqual(restored.extData.cloudFixture, { marker: 'preserved' })

    const close = await runtime.dispose()
    runtime = null
    assert.equal(close.localPersisted, true)
    assert.equal(close.cloudPush.ok, true)
  } finally {
    await seed?.close({ finalPush: false }).catch(() => {})
    await runtime?.dispose().catch(() => {})
    rmSync(root, { recursive: true, force: true })
  }
})

test('an invalid cloud archive leaves the existing save byte-for-byte unchanged', async () => {
  const root = temp(), remote = path.join(root, 'invalid-save.git')
  const statePath = path.join(root, 'local', 'state.json')
  let seed, runtime
  try {
    execFileSync('git', ['init', '--bare', '-q', '-b', 'main', remote], { stdio: 'ignore' })
    const broken = createGitSync({
      statePath, directory: path.join(root, 'broken-worktree'), remote, branch: 'main',
      archive: async () => ({ buffer: Buffer.from('not an archive') }),
      parse: async (_name, bytes) => parseSaveArchive(bytes), importFiles: async () => {},
    })
    seed = broken
    await seed.pushSnapshot({ manual: true })
    await seed.close({ finalPush: false })
    seed = null

    mkdirSync(path.dirname(statePath), { recursive: true })
    writeFileSync(statePath, JSON.stringify(hatchEgg(NOW)))
    runtime = createGameRuntime({ statePath, now: () => NOW, cloudSave: { enabled: true, remote, branch: 'main' } })
    await runtime.exclusive(async () => null)
    const before = readFileSync(statePath)
    const response = await runtime.handle('POST', '/dsh-piggy/cloud/pull', JSON.stringify({ branch: 'main' }))
    assert.equal(response.status, 200)
    assert.equal(JSON.parse(response.body).ok, false)
    assert.deepEqual(readFileSync(statePath), before)
    assert.equal(readdirSync(path.dirname(statePath)).some(name => name.startsWith('.piggy-save-import-')), false)
    const close = await runtime.dispose()
    runtime = null
    assert.equal(close.localPersisted, true)
  } finally {
    await seed?.close({ finalPush: false }).catch(() => {})
    await runtime?.dispose().catch(() => {})
    rmSync(root, { recursive: true, force: true })
  }
})

test('cloud status never returns the configured remote URL', async () => {
  const root = temp(), statePath = path.join(root, 'state.json'), remote = path.join(root, 'private-save.git')
  let runtime
  try {
    execFileSync('git', ['init', '--bare', '-q', '-b', 'main', remote], { stdio: 'ignore' })
    runtime = createGameRuntime({ statePath, cloudSave: { enabled: true, remote } })
    const response = await runtime.handle('GET', '/dsh-piggy/cloud/status')
    const status = JSON.parse(response.body)
    assert.equal(status.remoteConfigured, true)
    assert.equal(status.remote, undefined)
    assert.equal(JSON.stringify(status).includes(remote), false)
    await runtime.dispose()
    runtime = null
  } finally {
    await runtime?.dispose().catch(() => {})
    rmSync(root, { recursive: true, force: true })
  }
})

test('a failed final push is returned as failure after local close completes', async () => {
  const root = temp(), statePath = path.join(root, 'local', 'state.json')
  mkdirSync(path.dirname(statePath), { recursive: true })
  let runtime
  try {
    runtime = createGameRuntime({ statePath, now: () => NOW,
      cloudSave: { enabled: true, remote: path.join(root, 'missing-parent', 'missing.git'), branch: 'main' } })
    const result = await runtime.dispose()
    runtime = null
    assert.equal(result.localPersisted, true)
    assert.equal(result.cloudPush.ok, false)
    assert.equal(result.cloudPush.reason, 'final-push-failed')
  } finally {
    await runtime?.dispose().catch(() => {})
    rmSync(root, { recursive: true, force: true })
  }
})
