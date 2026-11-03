// @ts-check
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createOwnerCloudManager } from '../lib/owner-cloud-manager.js'
import { createOwnerCloudReadyStore } from '../lib/owner-cloud-ready.js'

const config = { version: 1, enabled: true, provider: 'github', remote: 'https://github.com/acme/pig.git', branch: 'main' }

test('local-to-cloud first sync persists a device-local owner/branch binding before enabling the queue', async () => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-owner-cloud-manager-'))
  const ready = createOwnerCloudReadyStore(root)
  const calls = []
  const host = {
    async firstSyncCloud(direction) { calls.push(['first-sync', direction]); return { ok: true, created: true } },
    async configureCloudSave(value) { calls.push(['configure', value.syncReady]); return { ok: true } },
  }
  const manager = createOwnerCloudManager({
    getHost: () => host,
    getOwnerConfig: () => ({ ownerId: 'owner-local' }),
    settings: { load: () => ({ ok: true, config }) },
    readyStore: ready,
    archiveManager: {},
    isSupported: () => true,
    isQuitting: () => false,
  })
  try {
    assert.deepEqual(await manager.firstSync('local-to-cloud'), {
      ok: true, direction: 'local-to-cloud', created: true, alreadyCurrent: false,
    })
    assert.deepEqual(calls, [['first-sync', 'local-to-cloud'], ['configure', true]])
    assert.equal(ready.matches('owner-local', config), true)
    assert.equal(ready.matches('owner-other', config), false)
    assert.equal(ready.matches('owner-local', { ...config, remote: 'https://github.com/acme/other.git' }), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('cloud-to-local remains a validated owner-archive preview until explicit copy-and-switch confirmation', async () => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-owner-cloud-restore-'))
  const ready = createOwnerCloudReadyStore(root)
  let activeOwner = { ownerId: 'owner-local' }
  let imported = 0
  const manager = createOwnerCloudManager({
    getHost: () => ({ async firstSyncCloud(direction) {
      assert.equal(direction, 'cloud-to-local')
      return { ok: true, archive: new Uint8Array([1, 2, 3]), ownerId: 'owner-remote' }
    } }),
    getOwnerConfig: () => activeOwner,
    settings: { load: () => ({ ok: true, config }) },
    readyStore: ready,
    archiveManager: {
      async previewArchive(bytes) { assert.deepEqual([...bytes], [1, 2, 3]); return { ok: true, token: 'opaque-preview', summary: { pigCount: 2 }, warnings: [] } },
      previewOwnerId(token) { return token === 'opaque-preview' ? 'owner-remote' : null },
      async importAndSwitch(token, options) {
        assert.equal(token, 'opaque-preview')
        assert.equal(options.acceptWarnings, false)
        imported += 1
        return { ok: true, restarting: true }
      },
      clear() {},
    },
    isSupported: () => true,
    isQuitting: () => false,
  })
  try {
    const preview = await manager.firstSync('cloud-to-local')
    assert.equal(preview.ok, true)
    assert.equal(preview.token, 'opaque-preview')
    assert.equal(ready.matches('owner-remote', config), false, 'preview alone cannot activate the remote owner')
    const switched = await manager.importCloudPreview('opaque-preview')
    assert.deepEqual(switched, { ok: true, restarting: true, cloudReadyAfterRestart: true })
    assert.equal(imported, 1)
    assert.equal(ready.matches('owner-remote', config), true)
    assert.equal(ready.matches(activeOwner.ownerId, config), false, 'the current owner is not overwritten or re-bound')
  } finally { rmSync(root, { recursive: true, force: true }) }
})
