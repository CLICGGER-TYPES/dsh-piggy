import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createCloudSaveConfigStore } from '../lib/cloud-save-config.js'
import { registerCloudSaveIpc } from '../lib/ipc/cloud-save.js'
import { readCloudSaveSettings } from '../../../runtime/cloud-save-settings.js'

test('desktop cloud settings leaf is byte-identical to the DSH runtime canonical source', () => {
  const desktopHelper = readFileSync(new URL('../lib/cloud-save-settings.js', import.meta.url), 'utf8')
  const runtimeHelper = readFileSync(new URL('../../../runtime/cloud-save-settings.js', import.meta.url), 'utf8')
  assert.equal(desktopHelper, runtimeHelper)
})

test('desktop cloud IPC persists only local configuration and applies it without testing or syncing', async () => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-cloud-ipc-'))
  const settings = createCloudSaveConfigStore(root)
  const handlers = new Map()
  const hostCalls = []
  const host = {
    async configureCloudSave(value) { hostCalls.push({ kind: 'configure', value }); return { ok: true } },
    async testCloudSave(value) { hostCalls.push({ kind: 'test', value }); return { ok: true } },
  }
  const ipcMain = { handle: (channel, listener) => handlers.set(channel, listener) }
  registerCloudSaveIpc({ ipcMain, fromPage: event => event?.trusted === true, getHost: () => host, settings })
  const call = (channel, ...args) => handlers.get(`piggy:cloud:${channel}`)({ trusted: true }, ...args)
  try {
    const initial = await call('get')
    assert.equal(initial.ok, true)
    assert.equal(initial.config.enabled, false)
    assert.equal(hostCalls.length, 0)

    const next = { enabled: true, provider: 'gitee', remote: 'https://gitee.com/acme/pig.git', branch: 'main' }
    const saved = await call('set', next)
    assert.deepEqual(saved, { ok: true, config: { version: 1, ...next } })
    assert.deepEqual(hostCalls.map(item => item.kind), ['configure'])
    assert.deepEqual(readCloudSaveSettings(settings.file).config, saved.config)

    const checked = await call('test', next)
    assert.deepEqual(checked, { ok: true })
    assert.deepEqual(hostCalls.map(item => item.kind), ['configure', 'test'])
    assert.equal(hostCalls[0].value.syncReady, undefined, 'first-sync authorization is never accepted from page input')

    const before = hostCalls.length
    const rejected = await call('set', { ...next, remote: 'https://user:token@gitee.com/acme/pig.git' })
    assert.equal(rejected.ok, false)
    assert.equal(hostCalls.length, before)
    assert.equal(JSON.stringify(rejected).includes('token'), false)
    assert.equal((await handlers.get('piggy:cloud:get')({ trusted: false })).ok, false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
