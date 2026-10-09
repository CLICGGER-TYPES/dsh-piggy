import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createProxy, proxyPreference, proxyConfig } from '../lib/proxy.js'

test('proxy endpoints cannot inject alternate routes or persist embedded credentials', () => {
  assert.deepEqual(proxyPreference({ mode: 'http', address: 'http://localhost:80' }), { mode: 'http', address: 'localhost:80' })
  assert.deepEqual(proxyPreference({ mode: 'socks5', address: '[::1]:1080' }), { mode: 'socks5', address: '[::1]:1080' })
  for (const address of ['localhost', 'user:password@localhost:8080', 'localhost:70000', 'localhost:80;direct://', 'foo,bar:80', 'foo;bar:80', 'localhost:80/path']) {
    assert.throws(() => proxyPreference({ mode: 'http', address }), address)
  }
  assert.deepEqual(proxyConfig(proxyPreference({ mode: 'socks5', address: 'localhost:1080' })), { mode: 'fixed_servers', proxyRules: 'socks5://localhost:1080' })
})

test('app and updater sessions share persistent settings, rollback and clear to system', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pig-proxy-'))
  try {
    const path = join(dir, 'proxy.json')
    const calls = []
    let reject = false
    const sessions = [0, 1].map(id => ({
      async setProxy(config) { calls.push([id, config]); if (reject && id === 1 && config.mode === 'direct') throw new Error('failed') },
      async closeAllConnections() { calls.push([id, 'close']) },
    }))
    const proxy = createProxy({ path, sessions })
    await proxy.init()
    assert.deepEqual(calls.slice(0, 2), [[0, { mode: 'system' }], [1, { mode: 'system' }]])
    assert.equal((await proxy.set({ mode: 'socks5', address: '127.0.0.1:1080' })).ok, true)
    const saved = JSON.parse(readFileSync(path))
    assert.deepEqual(createProxy({ path, sessions }).get(), saved)
    reject = true
    assert.equal((await proxy.set({ mode: 'direct' })).ok, false)
    assert.deepEqual(proxy.get(), saved)
    assert.deepEqual(JSON.parse(readFileSync(path)), saved)
    assert.deepEqual(calls.at(-3), [1, { mode: 'fixed_servers', proxyRules: 'socks5://127.0.0.1:1080' }])
    assert.equal((await proxy.clear()).ok, true)
    assert.equal(existsSync(path), false)
    assert.deepEqual(proxy.get(), { mode: 'system', address: '' })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
