// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createDshOwnerCloudClient,
  normalizeStatus,
  OWNER_CLOUD_PATHS,
  OWNER_CLOUD_TIMEOUTS,
} from '../../adapters/dsh/owner-cloud-client.js'

function fixture(handler) {
  const calls = []
  const request = async (method, path, body, options) => {
    calls.push({ method, path, body, options })
    return handler({ method, path, body, options })
  }
  return { api: createDshOwnerCloudClient(request), calls }
}

const json = (status, body) => ({ status, body })

test('ownerStatus maps configured to enabled and keeps the DSH transport fields', async () => {
  const { api, calls } = fixture(() => json(200, {
    ok: true,
    configured: true,
    directionRequired: false,
    markerError: null,
    enabled: false,
    ready: false,
    branch: 'release/2026',
  }))
  assert.equal(api.version, 1)
  assert.equal(api.transport, 'dsh')
  assert.equal(api.restartAfterImport, false)
  assert.equal(api.restore, api.importFirstSync)
  assert.deepEqual(await api.ownerStatus(), {
    ok: true,
    available: true,
    enabled: true,
    configured: true,
    ready: false,
    branch: 'release/2026',
    directionRequired: false,
    markerError: null,
    transport: 'dsh',
    restartAfterImport: false,
  })
  assert.deepEqual(calls, [{
    method: 'GET',
    path: OWNER_CLOUD_PATHS.status,
    body: undefined,
    options: { timeoutMs: OWNER_CLOUD_TIMEOUTS.status },
  }])
})

test('ownerStatus normalizes 403, 404, non-JSON, network and timeout without throwing', async () => {
  const loopback = fixture(() => json(403, { ok: false, reason: 'loopback-only' }))
  assert.deepEqual(await loopback.api.ownerStatus(), {
    ok: false,
    available: false,
    code: 'loopback-only',
    reason: '完整档云同步只在本机打开 DSH 时可用',
  })

  const unsupported = fixture(() => json(404, { ok: false, reason: 'not-found' }))
  assert.equal((await unsupported.api.ownerStatus()).code, 'owner-cloud-unsupported')

  const html = fixture(() => ({ status: 404, body: null, parseError: true }))
  assert.equal((await html.api.ownerStatus()).code, 'bad-response')

  const network = fixture(() => { throw new Error('offline') })
  assert.deepEqual(await network.api.ownerStatus(), {
    ok: false,
    available: false,
    code: 'network',
    reason: '无法连接 DSH 后端',
  })

  const timeout = fixture(() => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }) })
  assert.deepEqual(await timeout.api.ownerStatus(), {
    ok: false,
    available: false,
    code: 'timeout',
    reason: '请求超时，请稍后重试',
  })
})

test('normalizeStatus rejects legacy bodies but never promotes runtime enabled to configured', () => {
  assert.equal(normalizeStatus({ ok: true, configured: false, enabled: true, ready: true }).enabled, false)
  assert.equal(normalizeStatus({ ok: false }).available, false)
  assert.equal(normalizeStatus(null).available, false)
})

test('firstSync sends only the direction and marks cloud previews as switching', async () => {
  const preview = {
    ok: true,
    token: 'preview-token',
    ownerId: 'owner-a',
    pigIds: ['pig-a'],
    initialPigId: 'pig-a',
    summary: { pigCount: 1, pigs: [] },
    warnings: [],
  }
  const { api, calls } = fixture(({ body }) => body.direction === 'cloud-to-local'
    ? json(200, preview)
    : json(200, { ok: true, direction: 'local-to-cloud', automaticPushEnabled: true }))
  const result = await api.firstSync('cloud-to-local')
  assert.deepEqual(result, { ...preview, switchAfterImport: true })
  assert.deepEqual(calls[0].body, { direction: 'cloud-to-local' })
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].path, OWNER_CLOUD_PATHS.firstSync)
  assert.equal(calls[0].options.timeoutMs, OWNER_CLOUD_TIMEOUTS.firstSync)

  const upload = await api.firstSync('local-to-cloud')
  assert.equal(upload.switchAfterImport, undefined)
  assert.deepEqual(calls[1].body, { direction: 'local-to-cloud' })

  const invalid = await api.firstSync('sideways')
  assert.equal(invalid.code, 'request-invalid')
  assert.equal(calls.length, 2, 'an invalid direction never reaches the host')
})

test('firstSync keeps the server conflict reason', async () => {
  const { api } = fixture(() => json(409, { ok: false, reason: 'remote-branch-empty' }))
  assert.deepEqual(await api.firstSync('cloud-to-local'), {
    ok: false,
    code: 'remote-branch-empty',
    reason: 'remote-branch-empty',
  })
})

test('importFirstSync sends only token and acceptWarnings, never a path or owner id', async () => {
  const { api, calls } = fixture(() => json(200, {
    ok: true, imported: true, switched: true, ownerId: 'owner-a', pigIds: ['pig-a'], pigId: 'pig-a',
  }))
  const result = await api.importFirstSync('secret-token', { acceptWarnings: true })
  assert.equal(result.ok, true)
  assert.equal(result.switched, true)
  assert.deepEqual(calls[0].body, { token: 'secret-token', acceptWarnings: true })
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].path, OWNER_CLOUD_PATHS.restore)
  assert.equal(calls[0].options.timeoutMs, OWNER_CLOUD_TIMEOUTS.restore)
  assert.equal(calls[0].path.includes('secret-token'), false)
  assert.equal(JSON.stringify(calls[0].options).includes('secret-token'), false)

  await api.importFirstSync('plain-token')
  assert.deepEqual(calls[1].body, { token: 'plain-token' })
  for (const forbidden of ['ownerDocumentPath', 'pigId', 'ownerId', 'archiveRoot']) {
    assert.equal(Object.hasOwn(calls[1].body, forbidden), false, forbidden)
  }
})

test('importFirstSync keeps imported:true on 409 and maps unknown results without retrying', async () => {
  const conflict = fixture(() => json(409, {
    ok: false,
    imported: true,
    reason: 'Owner copy could not be activated; the new copy was kept',
  }))
  const result = await conflict.api.importFirstSync('token')
  assert.equal(result.imported, true)
  assert.equal(result.code, 'Owner copy could not be activated; the new copy was kept')

  const timeout = fixture(() => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }) })
  assert.deepEqual(await timeout.api.importFirstSync('token'), {
    ok: false,
    code: 'unknown',
    reason: '恢复请求的结果未知；请检查当前完整档',
    unknown: true,
  })
  assert.equal(timeout.calls.length, 1, 'a timed-out import is never replayed')

  const invalid = await timeout.api.importFirstSync('')
  assert.equal(invalid.code, 'request-invalid')
  assert.equal(timeout.calls.length, 1, 'an empty token is rejected before any request')
})

test('ownerHistory ignores the desktop branch argument and never adds a query', async () => {
  const { api, calls } = fixture(() => json(200, {
    ok: true,
    manual: { hash: 'a'.repeat(40), at: '2026-11-04T10:00:00Z', subject: 'save-manual', manual: true },
    auto: [],
  }))
  const result = await api.ownerHistory('release/2026')
  assert.equal(result.ok, true)
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].path, OWNER_CLOUD_PATHS.history)
  assert.equal(calls[0].path.includes('?'), false)
  assert.equal(calls[0].body, undefined)
  assert.equal(calls[0].options.timeoutMs, OWNER_CLOUD_TIMEOUTS.history)

  const conflict = fixture(() => json(409, { ok: false, reason: 'first-sync-required' }))
  assert.deepEqual(await conflict.api.ownerHistory(), {
    ok: false,
    code: 'first-sync-required',
    reason: 'first-sync-required',
  })
})

test('selection is a read-only GET and failures never expose large bodies', async () => {
  const ok = fixture(() => json(200, {
    ok: true, source: 'archive', active: { ownerId: 'owner-a' }, pending: null, archiveRoot: '/private/path',
  }))
  assert.equal((await ok.api.selection()).source, 'archive')
  assert.equal(ok.calls[0].method, 'GET')
  assert.equal(ok.calls[0].path, OWNER_CLOUD_PATHS.selection)

  const failure = fixture(() => json(409, {
    ok: false,
    reason: 'owner-operation-failed',
    archive: 'x'.repeat(1024),
  }))
  const result = await failure.api.selection()
  assert.equal(result.ok, false)
  assert.equal(Object.hasOwn(result, 'archive'), false)
})

test('the DSH adapter fetches the loopback route with same-origin credentials and keeps 403', async t => {
  const oldWindow = globalThis.window, oldFetch = globalThis.fetch
  const calls = []
  globalThis.window = { __ModuleLoader__: { load() {} } }
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    return { ok: false, status: 403, json: async () => ({ ok: false, reason: 'loopback-only' }) }
  }
  t.after(() => {
    globalThis.window = oldWindow
    globalThis.fetch = oldFetch
  })
  await import('../../adapters/dsh/client.js?dsh-owner-cloud-fetch-403')
  const bridge = /** @type {any} */ (globalThis.window).__dshPiggyOwnerCloud
  assert.deepEqual(await bridge.ownerStatus(), {
    ok: false,
    available: false,
    code: 'loopback-only',
    reason: '完整档云同步只在本机打开 DSH 时可用',
  })
  assert.equal(calls[0].url, OWNER_CLOUD_PATHS.status)
  assert.equal(calls[0].init.method, 'GET')
  assert.equal(calls[0].init.credentials, 'same-origin')
  assert.equal(calls[0].init.cache, 'no-store')
  assert.equal(calls[0].init.body, undefined)
})

test('the DSH adapter sends the restore token in the JSON body only', async t => {
  const oldWindow = globalThis.window, oldFetch = globalThis.fetch
  const calls = []
  globalThis.window = { __ModuleLoader__: { load() {} } }
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, imported: true, switched: true, pigId: 'pig-a' }),
    }
  }
  t.after(() => {
    globalThis.window = oldWindow
    globalThis.fetch = oldFetch
  })
  await import('../../adapters/dsh/client.js?dsh-owner-cloud-fetch-restore')
  const bridge = /** @type {any} */ (globalThis.window).__dshPiggyOwnerCloud
  const result = await bridge.importFirstSync('body-token', { acceptWarnings: true })
  assert.equal(result.switched, true)
  assert.equal(calls[0].url, OWNER_CLOUD_PATHS.restore)
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.credentials, 'same-origin')
  assert.equal(calls[0].init.headers['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(calls[0].init.body), { token: 'body-token', acceptWarnings: true })
  assert.equal(calls[0].url.includes('body-token'), false)
  assert.ok(calls[0].init.signal, 'the request carries an abort signal for the timeout')
})

test('the failed 403 and 404 operations stay read-only and carry no retry flag', async () => {
  for (const [status, code] of [[403, 'loopback-only'], [404, 'owner-cloud-unsupported']]) {
    const { api } = fixture(() => json(status, { ok: false, reason: 'nope' }))
    const result = await api.firstSync('cloud-to-local')
    assert.equal(result.ok, false)
    assert.equal(result.code, code)
    assert.equal(result.retryable, undefined)
    assert.equal(result.available, undefined)
  }
})
