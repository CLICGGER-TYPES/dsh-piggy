import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerGameProtocol, createSessionResolver, pigIdFromRequest } from '../lib/game-protocol.js'

function register({ rendererDir, gameDir, fetchFile, getHost = () => ({ handle: async () => ({ status: 200, headers: {}, body: '' }) }),
  isQuitting = () => false, onStateChanged = () => {}, resolveSession, sessions }) {
  let registeredScheme = null
  let handler = null
  registerGameProtocol({
    protocol: { handle(scheme, callback) { registeredScheme = scheme; handler = callback } },
    fetchFile, rendererDir, gameDir, getHost, isQuitting, onStateChanged, resolveSession, sessions,
  })
  assert.equal(registeredScheme, 'piggy')
  assert.equal(typeof handler, 'function')
  return handler
}

function request(url, method = 'GET', arrayBuffer = async () => new ArrayBuffer(0)) {
  return { url, method, arrayBuffer }
}

test('piggy protocol serves renderer and active-game files through the injected file fetcher', async t => {
  const root = await mkdtemp(join(tmpdir(), 'piggy-game-protocol-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const rendererDir = join(root, 'renderer')
  const gameDir = join(root, 'game')
  await mkdir(rendererDir)
  await mkdir(gameDir)
  await writeFile(join(rendererDir, 'index.html'), '<main>renderer</main>')
  await writeFile(join(rendererDir, 'pig.png'), Buffer.from([1, 2, 3]))
  await writeFile(join(rendererDir, 'face.ttf'), Buffer.from([4, 5, 6]))
  await writeFile(join(rendererDir, 'opaque.bin'), Buffer.from([7, 8]))
  await writeFile(join(gameDir, 'client.js'), 'game client')

  const fetched = []
  const handler = register({
    rendererDir,
    gameDir,
    fetchFile: async fileUrl => {
      fetched.push(fileUrl)
      return new Response(await readFile(fileURLToPath(fileUrl)))
    },
  })

  const index = await handler(request('piggy://app/'))
  assert.equal(index.status, 200)
  assert.equal(index.headers.get('content-type'), 'text/html')
  assert.equal(index.headers.get('cache-control'), null)
  assert.equal(await index.text(), '<main>renderer</main>')

  const client = await handler(request('piggy://app/client.js?cache=1'))
  assert.equal(client.headers.get('content-type'), 'text/javascript')
  assert.equal(client.headers.get('cache-control'), null)
  assert.equal(await client.text(), 'game client')

  const image = await handler(request('piggy://app/pig.png'))
  assert.equal(image.headers.get('content-type'), 'image/png')
  assert.equal(image.headers.get('cache-control'), 'max-age=86400')
  assert.deepEqual([...new Uint8Array(await image.arrayBuffer())], [1, 2, 3])

  const font = await handler(request('piggy://app/face.ttf'))
  assert.equal(font.headers.get('content-type'), 'font/ttf')
  assert.equal(font.headers.get('cache-control'), 'max-age=86400')

  const opaque = await handler(request('piggy://app/opaque.bin'))
  assert.equal(opaque.headers.get('content-type'), 'application/octet-stream')
  assert.equal(opaque.headers.get('cache-control'), null)
  assert.equal(fetched.length, 5)
})

test('piggy protocol forwards decoded API path and query, exact POST bytes, response fields, and post-resolution notification', async () => {
  const events = []
  const payload = Uint8Array.from([0, 65, 255])
  const handler = register({
    rendererDir: '/unused/renderer', gameDir: '/unused/game',
    fetchFile: async () => { throw new Error('API request must not use file fetch') },
    isQuitting: () => { events.push('closing-check'); return false },
    getHost: () => {
      events.push('get-host')
      return { async handle(method, url, body) {
        events.push('host-start')
        assert.equal(method, 'POST')
        assert.equal(url, '/dsh-piggy/act one?tab=1')
        assert.deepEqual([...new Uint8Array(body)], [...payload])
        await Promise.resolve()
        events.push('host-resolved')
        return { status: 207, headers: { 'x-host-result': 'kept' }, body: 'host body' }
      } }
    },
    onStateChanged: () => events.push('state-changed'),
  })
  const body = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength)
  const response = await handler(request('piggy://app/dsh-piggy/act%20one?tab=1', 'POST', async () => {
    events.push('body-read')
    return body
  }))

  assert.equal(response.status, 207)
  assert.equal(response.headers.get('x-host-result'), 'kept')
  assert.equal(await response.text(), 'host body')
  assert.deepEqual(events, ['body-read', 'closing-check', 'get-host', 'host-start', 'host-resolved', 'state-changed'])
})

test('piggy protocol does not read GET bodies or announce GET responses', async () => {
  const events = []
  const handler = register({
    rendererDir: '/unused/renderer', gameDir: '/unused/game', fetchFile: async () => { throw new Error('unexpected file fetch') },
    isQuitting: () => { events.push('closing-check'); return false },
    getHost: () => ({ async handle(method, url, body) {
      events.push('host')
      assert.equal(method, 'GET')
      assert.equal(url, '/dsh-piggy/state?force=1')
      assert.equal(body, undefined)
      return { status: 202, headers: { 'x-response': 'get' }, body: 'state' }
    } }),
    onStateChanged: () => events.push('state-changed'),
  })
  const response = await handler(request('piggy://app/dsh-piggy/state?force=1', 'GET', async () => {
    throw new Error('GET request body must not be read')
  }))
  assert.equal(response.status, 202)
  assert.equal(await response.text(), 'state')
  assert.deepEqual(events, ['closing-check', 'host'])
})

test('closing POST consumes its body before returning 503 and never dispatches or announces', async () => {
  const events = []
  const handler = register({
    rendererDir: '/unused/renderer', gameDir: '/unused/game', fetchFile: async () => { throw new Error('unexpected file fetch') },
    isQuitting: () => { events.push('closing-check'); return true },
    getHost: () => { events.push('get-host'); throw new Error('closing request must not get host') },
    onStateChanged: () => events.push('state-changed'),
  })
  const response = await handler(request('piggy://app/dsh-piggy/act', 'POST', async () => {
    events.push('body-read')
    return new ArrayBuffer(2)
  }))
  assert.equal(response.status, 503)
  assert.equal(await response.text(), 'game runtime closing')
  assert.deepEqual(events, ['body-read', 'closing-check'])
})

test('host exceptions propagate without being converted to a response or notification', async () => {
  const events = []
  const handler = register({
    rendererDir: '/unused/renderer', gameDir: '/unused/game', fetchFile: async () => { throw new Error('unexpected file fetch') },
    isQuitting: () => false,
    getHost: () => ({ async handle() { throw new Error('host route failed') } }),
    onStateChanged: () => events.push('state-changed'),
  })
  await assert.rejects(handler(request('piggy://app/dsh-piggy/act', 'POST')), /host route failed/)
  assert.deepEqual(events, [])
})

test('file fetch non-ok bodies are cancelled, and traversal or fetch errors return 404', async t => {
  const root = await mkdtemp(join(tmpdir(), 'piggy-game-protocol-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const rendererDir = join(root, 'renderer')
  await mkdir(rendererDir)
  await writeFile(join(rendererDir, 'missing.html'), 'fixture')
  let fetchCount = 0
  let cancelled = 0
  const handler = register({
    rendererDir, gameDir: join(root, 'game'),
    fetchFile: async fileUrl => {
      fetchCount++
      if (fileUrl.endsWith('/missing.html')) {
        return new Response(new ReadableStream({
          start(controller) { controller.enqueue(new Uint8Array([9])) },
          cancel() { cancelled++ },
        }), { status: 404 })
      }
      throw new Error('file fetch failed')
    },
  })

  const missing = await handler(request('piggy://app/missing.html'))
  assert.equal(missing.status, 404)
  assert.equal(await missing.text(), 'not found')
  assert.equal(cancelled, 1)

  const traversal = await handler(request('piggy://app/%2e%2e%2foutside.js'))
  assert.equal(traversal.status, 404)
  assert.equal(await traversal.text(), 'not found')
  assert.equal(fetchCount, 1)

  const failed = await handler(request('piggy://app/fetch-error.html'))
  assert.equal(failed.status, 404)
  assert.equal(await failed.text(), 'not found')
  assert.equal(fetchCount, 2)
})

test('?pig=<pigId> resolves to that worker session while requests without pig stay on the default session', async () => {
  const calls = []
  const handler = register({
    rendererDir: '/unused/renderer', gameDir: '/unused/game',
    fetchFile: async () => { throw new Error('API request must not use file fetch') },
    getHost: () => ({ async handle(method, url, body, session) {
      calls.push({ method, url, session })
      return { status: 200, headers: {}, body: '' }
    } }),
    sessions: new Map([['pig-b', 'token-b']]),
  })
  await handler(request('piggy://app/dsh-piggy/state?pig=pig-b'))
  await handler(request('piggy://app/dsh-piggy/state'))
  assert.deepEqual(calls, [
    { method: 'GET', url: '/dsh-piggy/state?pig=pig-b', session: 'token-b' },
    { method: 'GET', url: '/dsh-piggy/state', session: undefined },
  ])
})

test('pet window URL carries ?pig; same-origin API fetches may only expose it through Referer', async () => {
  const calls = []
  const handler = register({
    rendererDir: '/unused/renderer', gameDir: '/unused/game',
    fetchFile: async () => { throw new Error('API request must not use file fetch') },
    getHost: () => ({ async handle(method, url, body, session) {
      calls.push({ method, url, session })
      return { status: 200, headers: {}, body: '' }
    } }),
    sessions: new Map([['pig-a', 'token-a'], ['pig-b', 'token-b']]),
  })
  const request = (headers) => ({
    url: 'piggy://app/dsh-piggy/state', method: 'GET',
    headers: { get: name => headers[name] ?? null },
    arrayBuffer: async () => new ArrayBuffer(0),
  })
  await handler(request({ referer: 'piggy://app/index.html?pig=pig-b' }))
  await handler(request({ referer: 'piggy://app/index.html' }))
  await handler(request({ referer: 'piggy://app/index.html?pig=pig-a' }))
  assert.deepEqual(calls, [
    { method: 'GET', url: '/dsh-piggy/state', session: 'token-b' },
    { method: 'GET', url: '/dsh-piggy/state', session: undefined },
    { method: 'GET', url: '/dsh-piggy/state', session: 'token-a' },
  ])
})

test('injected resolveSession may be async; an unknown pig is rejected instead of falling back to the default session', async () => {
  assert.equal(pigIdFromRequest({ url: 'piggy://app/dsh-piggy/state?pig=pig-b' }), 'pig-b')
  assert.equal(pigIdFromRequest({ url: 'piggy://app/dsh-piggy/state' }), null)
  assert.equal(pigIdFromRequest({ url: 'not a url' }), null)

  let touches = 0
  const handler = register({
    rendererDir: '/unused/renderer', gameDir: '/unused/game',
    fetchFile: async () => { throw new Error('API request must not use file fetch') },
    getHost: () => ({ async handle(method, url, body, session) {
      touches += 1
      assert.equal(session, 'token-a')
      return { status: 200, headers: {}, body: 'ok' }
    } }),
    resolveSession: async request => createSessionResolver(new Map([['pig-a', 'token-a']]))(request),
  })
  const response = await handler(request('piggy://app/dsh-piggy/state?pig=pig-a'))
  assert.equal(await response.text(), 'ok')
  assert.equal(touches, 1)

  await assert.rejects(handler(request('piggy://app/dsh-piggy/state?pig=missing')), error => {
    assert.match(error.message, /no desktop session for pig missing/)
    assert.equal(error.status, 404)
    return true
  })
  assert.equal(touches, 1, 'unknown pig must not reach the host under the default session')
})
