// M3 第二刀：第三方素材包的静态路由与 /state 摘要（播放/注册仍不接）。
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg } from '../../../core.js'
import { registerGameRoutes } from '../../../routes.js'
import { createStore } from '../../../store.js'
import { makeBundle } from '../../../store/ext-import.js'
import { createExtRuntime } from '../../../store/ext-runtime.js'

const KEY = 'assetpack'
const PLAIN = 'plaine'
const PNG = (() => {
  const body = Buffer.alloc(33)
  body.writeUInt32BE(0x89504e47, 0)
  body.writeUInt32BE(0x0d0a1a0a, 4)
  body.writeUInt32BE(13, 8)
  body.write('IHDR', 12, 'ascii')
  body.writeUInt32BE(2, 16)
  body.writeUInt32BE(2, 20)
  body[24] = 8
  body[25] = 6
  return body
})()
const WEBP = (() => {
  const body = Buffer.alloc(30)
  body.write('RIFF', 0, 'ascii')
  body.writeUInt32LE(22, 4)
  body.write('WEBP', 8, 'ascii')
  body.write('VP8L', 12, 'ascii')
  body.writeUInt32LE(10, 16)
  body[20] = 0x2f
  body.writeUInt32LE(1 | (1 << 14), 21)
  return body
})()
const WAV = Buffer.from('RIFF' + '\0'.repeat(4) + 'WAVEfmt ' + '\0'.repeat(20), 'binary')
const OGG = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(20)])

function assetFiles() {
  return {
    'manifest.json': JSON.stringify({
      key: KEY, label: '素材扩展', emoji: '🎨', version: '1.0.0',
      assetPacks: { actions: ['wave', 'glide'], sounds: ['sfx', 'chime'] },
    }),
    'server.js': 'export default { init() { return { saved: 0 } }, actions: { ping() { return { ok: true } } } }',
    'client.js': 'void 0',
    'actions/wave/pack.json': JSON.stringify({
      pack: 'wave',
      actions: [{ key: 'wave', kind: 'action', frames: { fps: 10 }, durationMs: 200 }],
    }),
    'actions/wave/wave/00.png': PNG,
    'actions/wave/wave/01.png': PNG,
    'actions/glide/pack.json': JSON.stringify({
      pack: 'glide',
      actions: [{ key: 'glide', kind: 'action', frames: { durationsMs: [100, 100] }, durationMs: 200 }],
    }),
    'actions/glide/glide/00.webp': WEBP,
    'actions/glide/glide/01.webp': WEBP,
    'sounds/sfx/pack.json': JSON.stringify({
      pack: 'sfx',
      sounds: [{ key: 'beep', file: 'beep.wav', durationMs: 100 }],
    }),
    'sounds/sfx/beep.wav': WAV,
    'sounds/chime/pack.json': JSON.stringify({
      pack: 'chime',
      sounds: [{ key: 'ding', file: 'ding.ogg', durationMs: 100 }],
    }),
    'sounds/chime/ding.ogg': OGG,
  }
}

function plainFiles() {
  return {
    'manifest.json': JSON.stringify({ key: PLAIN, label: '旧扩展', emoji: '🧩', version: '1.0.0' }),
    'server.js': 'export default { init() { return { saved: 1 } } }',
    'client.js': 'void 0',
  }
}

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-asset-route-'))
  writeFileSync(join(dir, 'state.json'), JSON.stringify(hatchEgg(Date.now())))
  const store = createStore(join(dir, 'state.json'), { journal: undefined })
  const runtime = createExtRuntime(store, {
    gameVersion: '0.37.2',
    fetch: async () => { throw new Error('offline') },
    registryUrl: 'https://example.test/registry.json',
    sleep: async () => {},
  })
  store.ext = runtime
  const dirs = {
    ext: join(dir, 'extensions', KEY),
    actions: join(dir, 'extensions', KEY, 'actions'),
    sounds: join(dir, 'extensions', KEY, 'sounds'),
  }
  return {
    dir, store, runtime, dirs,
    async install() {
      const result = await runtime.importBundle(makeBundle(assetFiles()), true)
      assert.equal(result.ok, true, JSON.stringify(result))
      return result
    },
    async installPlain() {
      const result = await runtime.importBundle(makeBundle(plainFiles()), true)
      assert.equal(result.ok, true, JSON.stringify(result))
      return result
    },
    done: () => { store.dispose(); rmSync(dir, { recursive: true, force: true }) },
  }
}

function routesFor(store) {
  const routes = new Map()
  const dispose = registerGameRoutes({
    register(route) { routes.set(route.path, route); return () => {} },
  }, store)
  return { routes, dispose }
}

async function request(routes, url, options = {}) {
  const path = url.split('?')[0]
  const route = routes.get(path) ?? routes.get('/dsh-piggy/ext')
  assert.notEqual(route, undefined)
  const method = options.method ?? 'GET'
  const req = {
    method, url, headers: options.headers ?? {},
    async *[Symbol.asyncIterator]() { /* GET 没有请求体 */ },
  }
  let status = 0
  let headers = {}
  let body = Buffer.alloc(0)
  const res = {
    writeHead(code, next = {}) { status = code; headers = next },
    end(chunk) { body = chunk === undefined ? Buffer.alloc(0) : Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)) },
  }
  await route.handler(req, res)
  return { status, headers, body, text: body.toString('utf8') }
}

test('素材包静态路由：pack.json、PNG/WebP 帧、WAV/OGG 音效、MIME 与 ETag', async () => {
  const t = setup()
  try {
    await t.install()
    const { routes, dispose } = routesFor(t.store)
    try {
      const packJson = readFileSync(join(t.dirs.ext, 'actions', 'wave', 'pack.json'))
      const json = await request(routes, `/dsh-piggy/ext/${KEY}/actions/wave/pack.json`)
      assert.equal(json.status, 200)
      assert.equal(json.headers['content-type'], 'application/json; charset=utf-8')
      assert.equal(json.headers['cache-control'], 'no-cache')
      assert.match(json.headers.etag, /^"[0-9a-f]{32}"$/)
      assert.deepEqual(json.body, packJson)

      const png = await request(routes, `/dsh-piggy/ext/${KEY}/actions/wave/wave/00.png`)
      assert.equal(png.status, 200)
      assert.equal(png.headers['content-type'], 'image/png')
      assert.deepEqual(png.body, PNG)

      const webp = await request(routes, `/dsh-piggy/ext/${KEY}/actions/glide/glide/01.webp`)
      assert.equal(webp.status, 200)
      assert.equal(webp.headers['content-type'], 'image/webp')
      assert.deepEqual(webp.body, WEBP)

      const wav = await request(routes, `/dsh-piggy/ext/${KEY}/sounds/sfx/beep.wav`)
      assert.equal(wav.status, 200)
      assert.equal(wav.headers['content-type'], 'audio/wav')
      assert.deepEqual(wav.body, WAV)

      const ogg = await request(routes, `/dsh-piggy/ext/${KEY}/sounds/chime/ding.ogg`)
      assert.equal(ogg.status, 200)
      assert.equal(ogg.headers['content-type'], 'audio/ogg')
      assert.deepEqual(ogg.body, OGG)

      // 内容 hash 相同就 304，不重新发文件。
      const cached = await request(routes, `/dsh-piggy/ext/${KEY}/actions/wave/wave/00.png`, {
        headers: { 'if-none-match': png.headers.etag },
      })
      assert.equal(cached.status, 304)
      assert.equal(cached.body.length, 0)
    } finally { dispose() }
  } finally { t.done() }
})

test('素材包静态路由：未声明、缺失、跨扩展、路径逃逸和非 GET 都被拒绝', async () => {
  const t = setup()
  try {
    await t.install()
    await t.installPlain()
    const { routes, dispose } = routesFor(t.store)
    try {
      // 未安装的 key、其它扩展的 key。
      assert.equal((await request(routes, `/dsh-piggy/ext/nope/actions/wave/pack.json`)).status, 404)
      assert.equal((await request(routes, `/dsh-piggy/ext/${PLAIN}/actions/wave/pack.json`)).status, 404)

      // manifest 没声明的包 / 包里没声明的动作目录和音效文件。
      assert.equal((await request(routes, `/dsh-piggy/ext/${KEY}/actions/missing/pack.json`)).status, 404)
      assert.equal((await request(routes, `/dsh-piggy/ext/${KEY}/actions/sfx/pack.json`)).status, 404)
      mkdirSync(join(t.dirs.actions, 'wave', 'extra'), { recursive: true })
      writeFileSync(join(t.dirs.actions, 'wave', 'extra', '00.png'), PNG)
      writeFileSync(join(t.dirs.sounds, 'sfx', 'evil.wav'), WAV)
      assert.equal((await request(routes, `/dsh-piggy/ext/${KEY}/actions/wave/extra/00.png`)).status, 404)
      assert.equal((await request(routes, `/dsh-piggy/ext/${KEY}/sounds/sfx/evil.wav`)).status, 404)
      // 安装后才塞进来的帧也不发：fps + durationMs 能反推出安装时的帧数。
      writeFileSync(join(t.dirs.actions, 'wave', 'wave', '02.png'), PNG)
      assert.equal((await request(routes, `/dsh-piggy/ext/${KEY}/actions/wave/wave/02.png`)).status, 404)

      // 存在但没声明的帧、pack.json 被改成别的包名，都不再服务。
      assert.equal((await request(routes, `/dsh-piggy/ext/${KEY}/actions/wave/wave/09.png`)).status, 404)
      writeFileSync(join(t.dirs.actions, 'wave', 'pack.json'), JSON.stringify({ pack: 'other', actions: [] }))
      assert.equal((await request(routes, `/dsh-piggy/ext/${KEY}/actions/wave/pack.json`)).status, 404)

      // 路径逃逸：原样、%2e%2e、反斜杠都在读盘前拒绝。
      assert.equal((await request(routes, `/dsh-piggy/ext/${KEY}/actions/wave/../../manifest.json`)).status, 403)
      assert.equal((await request(routes, `/dsh-piggy/ext/${KEY}/actions/wave/%2e%2e/%2e%2e/manifest.json`)).status, 403)
      assert.equal((await request(routes, `/dsh-piggy/ext/${KEY}/actions/wave/%2e%2e%5cmanifest.json`)).status, 403)

      // 符号链接不能借道读到扩展目录外面。
      symlinkSync(join(t.dir, 'state.json'), join(t.dirs.actions, 'wave', 'wave', '99.png'))
      assert.equal((await request(routes, `/dsh-piggy/ext/${KEY}/actions/wave/wave/99.png`)).status, 403)

      const post = await request(routes, `/dsh-piggy/ext/${KEY}/actions/wave/pack.json`, { method: 'POST' })
      assert.equal(post.status, 405)
    } finally { dispose() }
  } finally { t.done() }
})

test('/state 的素材包摘要带 kind、数量、可用状态和基址，旧扩展保持空表', async () => {
  const t = setup()
  try {
    await t.install()
    await t.installPlain()
    const { routes, dispose } = routesFor(t.store)
    try {
      const state = await request(routes, '/dsh-piggy/state')
      assert.equal(state.status, 200)
      const body = JSON.parse(state.text)
      const entry = body.extensions.find(item => item.key === KEY)
      assert.ok(entry)
      assert.deepEqual(entry.assetPacks.actions.map(item => item.kind), ['actions', 'actions'])
      const wave = entry.assetPacks.actions.find(item => item.pack === 'wave')
      assert.deepEqual(wave, {
        kind: 'actions', pack: 'wave', namespace: 'ext-' + KEY,
        base: `/dsh-piggy/ext/${KEY}/actions/wave/`,
        entries: 1, frames: 2, files: 3, bytes: wave.bytes, available: true,
      })
      assert.equal(typeof wave.frames, 'number', '摘要不能塞完整帧列表')
      const sfx = entry.assetPacks.sounds.find(item => item.pack === 'sfx')
      assert.equal(sfx.kind, 'sounds')
      assert.equal(sfx.base, `/dsh-piggy/ext/${KEY}/sounds/sfx/`)
      assert.equal(sfx.entries, 1)
      assert.equal(sfx.available, true)

      const plain = body.extensions.find(item => item.key === PLAIN)
      assert.ok(plain)
      assert.deepEqual(plain.assetPacks, { actions: [], sounds: [] })
      assert.equal(plain.version, '1.0.0')
      assert.equal(plain.installed, true)
    } finally { dispose() }
  } finally { t.done() }
})
