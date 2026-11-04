// M3 第三刀：第三方动作包的客户端注册、DOM 播放入口和失败隔离。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createArtResourceRegistry, defaultArtResources } from '../../../src/client/art-path.js'
import { attachPigActions, pigActionArt, playPigAction } from '../../../src/client/pig-actions.js'
import { EXT_ACTION_EVENT, createExtensionActionRuntime } from '../../../src/client/ext-actions.js'

const KEY = 'demo'
const BASE = `/dsh-piggy/ext/${KEY}/actions/wave/`
const PACK = JSON.stringify({
  pack: 'wave',
  revision: 1,
  actions: [
    { key: 'hello', kind: 'action', source: { scheme: 'path', path: 'hello.png' }, durationMs: 200 },
    { key: 'pulse', kind: 'action', frames: { fps: 10 }, durationMs: 200 },
    { key: 'sway', kind: 'action', frames: { durationsMs: [50, 150] }, durationMs: 200 },
  ],
})

function response(body, status = 200) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    body: { cancel() {} },
  }
}

/** Only the exact routes this fixture declares exist. */
function fakeFetch(urls = {}) {
  const calls = []
  const fetch = async (url, init) => {
    calls.push({ url, init })
    if (Object.hasOwn(urls, url)) return urls[url]
    return response({ error: 'not found' }, 404)
  }
  return { fetch, calls }
}

function extension(key, pack, extra = {}) {
  return {
    key,
    on: true,
    installed: true,
    version: '1.2.3',
    ...extra,
    assetPacks: {
      actions: [{
        kind: 'actions', pack, namespace: 'ext-' + key,
        base: `/dsh-piggy/ext/${key}/actions/${pack}/`,
        entries: 2, frames: 2, files: 3, bytes: 100, available: true,
        ...(extra.assetPacks?.actions?.[0] ?? {}),
      }],
      sounds: [],
    },
  }
}

function eventTarget() {
  const handlers = {}
  return {
    handlers,
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn) },
    removeEventListener(type, fn) { if (handlers[type]) handlers[type] = handlers[type].filter(item => item !== fn) },
    fire(detail) { for (const fn of handlers[EXT_ACTION_EVENT] || []) fn({ detail }) },
  }
}

function demoRoutes() {
  return {
    [BASE + 'pack.json']: response(PACK),
    [BASE + 'pulse/00.png']: response('png'),
    [BASE + 'pulse/01.png']: response('png'),
    [BASE + 'sway/00.webp']: response('webp'),
  }
}

test('注册单图/帧动作：handle、URL、帧时长和第一方隔离', async () => {
  const registry = createArtResourceRegistry()
  const target = eventTarget()
  const { fetch } = fakeFetch(demoRoutes())
  const runtime = createExtensionActionRuntime({ registry, play: () => true, target, fetch })
  await runtime.sync([extension(KEY, 'wave')])

  const hello = registry.resolve('ext-demo/wave/hello')
  assert.ok(hello)
  assert.equal(hello.descriptor.namespace, 'ext-demo')
  assert.equal(hello.descriptor.pack, 'wave')
  assert.equal(hello.descriptor.kind, 'action')
  assert.match(hello.url, /^\/dsh-piggy\/ext\/demo\/actions\/wave\/hello\.png\?v=1-/)
  assert.equal(hello.artKey, 'ext-demo/wave/hello')

  const pulse = registry.resolve({ namespace: 'ext-demo', pack: 'wave', key: 'pulse' })
  assert.ok(pulse)
  assert.deepEqual(pulse.descriptor.frames?.map(frame => [frame.path, frame.durationMs]), [
    ['ext/demo/actions/wave/pulse/00.png', 100],
    ['ext/demo/actions/wave/pulse/01.png', 100],
  ])
  assert.match(pulse.url, /^\/dsh-piggy\/ext\/demo\/actions\/wave\/pulse\/00\.png\?v=1-/)
  assert.equal(pulse.descriptor.duration, 200)

  const sway = registry.resolveRef({ namespace: 'ext-demo', pack: 'wave', key: 'sway' })
  assert.ok(sway)
  assert.deepEqual(sway.descriptor.frames?.map(frame => [frame.path, frame.durationMs]), [
    ['ext/demo/actions/wave/sway/00.webp', 50],
    ['ext/demo/actions/wave/sway/01.webp', 150],
  ], 'PNG 404 后探测 WebP')

  // 第一方仍在父级，第三方 namespace 不会污染默认 registry。
  assert.equal(registry.resolve('blink')?.descriptor.namespace, 'dsh-piggy')
  assert.equal(defaultArtResources.resolveRef({ namespace: 'ext-demo', pack: 'wave', key: 'hello' }), null)
  runtime.dispose()
})

test('dsh-piggy:action 只播放已注册的 ext- handle', async () => {
  const registry = createArtResourceRegistry()
  const target = eventTarget()
  const played = []
  const runtime = createExtensionActionRuntime({
    registry, target, fetch: fakeFetch(demoRoutes()).fetch, play: key => { played.push(key); return true },
  })
  await runtime.sync([extension(KEY, 'wave')])

  target.fire({ key: 'ext-demo/wave/hello' })
  assert.deepEqual(played, ['ext-demo/wave/hello'])

  target.fire({ key: 'ext-demo/wave/missing' })
  target.fire({ key: 'blink' })
  target.fire({ key: 'dsh-piggy/actions/blink' })
  target.fire({ key: 42 })
  assert.deepEqual(played, ['ext-demo/wave/hello'])
  assert.equal(runtime.handle({ key: 'ext-demo/wave/pulse' }), true)
  assert.deepEqual(played, ['ext-demo/wave/hello', 'ext-demo/wave/pulse'])
  runtime.dispose()
  assert.equal(target.handlers[EXT_ACTION_EVENT]?.length ?? 0, 0)
})

test('卸载/停用后事件不再播放，第一方动作不受影响', async () => {
  const registry = createArtResourceRegistry()
  const target = eventTarget()
  const played = []
  const runtime = createExtensionActionRuntime({
    registry, target, fetch: fakeFetch(demoRoutes()).fetch, play: key => { played.push(key); return true },
  })
  await runtime.sync([extension(KEY, 'wave')])
  target.fire({ key: 'ext-demo/wave/hello' })
  assert.equal(played.length, 1)

  await runtime.sync([])
  assert.equal(registry.resolveRef({ namespace: 'ext-demo', pack: 'wave', key: 'hello' }), null)
  assert.equal(registry.resolve('blink')?.descriptor.namespace, 'dsh-piggy')
  target.fire({ key: 'ext-demo/wave/hello' })
  assert.equal(played.length, 1, '卸载后的事件被拒绝')

  // 停用也算不可用，但重新启用能恢复。
  await runtime.sync([extension(KEY, 'wave')])
  await runtime.sync([extension(KEY, 'wave', { on: false })])
  target.fire({ key: 'ext-demo/wave/hello' })
  assert.equal(played.length, 1, '停用后事件被拒绝')
  await runtime.sync([extension(KEY, 'wave')])
  target.fire({ key: 'ext-demo/wave/hello' })
  assert.equal(played.length, 2)
  runtime.dispose()
})

test('扩展更新后只保留新 pack.json 里的动作', async () => {
  const registry = createArtResourceRegistry()
  const target = eventTarget()
  const urls = demoRoutes()
  const played = []
  const runtime = createExtensionActionRuntime({
    registry, target, fetch: fakeFetch(urls).fetch, play: key => { played.push(key); return true },
  })
  await runtime.sync([extension(KEY, 'wave')])
  assert.ok(registry.resolveRef({ namespace: 'ext-demo', pack: 'wave', key: 'pulse' }))

  urls[BASE + 'pack.json'] = response(JSON.stringify({
    pack: 'wave',
    revision: 2,
    actions: [{ key: 'hello', kind: 'action', source: 'hello.png', durationMs: 200 }],
  }))
  await runtime.sync([extension(KEY, 'wave', { version: '2.0.0' })])
  assert.ok(registry.resolveRef({ namespace: 'ext-demo', pack: 'wave', key: 'hello' }))
  assert.equal(registry.resolveRef({ namespace: 'ext-demo', pack: 'wave', key: 'pulse' }), null, '旧动作被移除')
  target.fire({ key: 'ext-demo/wave/pulse' })
  assert.deepEqual(played, [])
  runtime.dispose()
})

test('坏 pack.json 只影响该包，console.warn 只报一次', async () => {
  const registry = createArtResourceRegistry()
  const target = eventTarget()
  const warnings = []
  const urls = {
    ...demoRoutes(),
    '/dsh-piggy/ext/bad/actions/broken/pack.json': response('{not json', 200),
    '/dsh-piggy/ext/good/actions/ok/pack.json': response(JSON.stringify({
      pack: 'ok',
      actions: [{ key: 'nod', kind: 'action', source: 'nod.png', durationMs: 100 }],
    })),
  }
  const runtime = createExtensionActionRuntime({
    registry, target, warn: (message) => warnings.push(message), fetch: fakeFetch(urls).fetch,
    play: () => true,
  })
  const bad = extension('bad', 'broken', { version: '1.0.0' })
  const good = extension('good', 'ok', { version: '1.0.0' })
  await runtime.sync([bad, good])

  assert.equal(registry.resolveRef({ namespace: 'ext-bad', pack: 'broken', key: 'none' }), null)
  assert.ok(registry.resolve('ext-good/ok/nod'), '另一个扩展照常注册')
  assert.equal(registry.resolve('blink')?.descriptor.namespace, 'dsh-piggy', '第一方照常')
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /third-party|第三方动作包加载失败/)

  // 同一份坏摘要再轮询一次不会重复刷日志。
  await runtime.sync([bad, good])
  assert.equal(warnings.length, 1)
  runtime.dispose()
})

test('注册后动态到达的帧动作会被播放器预加载并真的播放', async () => {
  const attrs = { 'data-art': 'piglet', 'data-mood': 'fine' }
  const listeners = {}
  const pig = {
    parentNode: null,
    getAttribute: key => attrs[key] || null,
    setAttribute(key, value) { attrs[key] = value },
    removeAttribute(key) { delete attrs[key] },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn) },
    removeEventListener() {},
  }
  const savedDocument = globalThis.document
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }
  const registry = createArtResourceRegistry()
  const player = attachPigActions({
    pig,
    clock: { setTimeout: () => 1, clearTimeout() {} },
    preload: async () => {},
    isStopped: () => false,
    isDragging: () => false,
    render() {},
    artResources: registry,
  })
  const target = eventTarget()
  const runtime = createExtensionActionRuntime({
    registry, target, fetch: fakeFetch(demoRoutes()).fetch,
    play: key => playPigAction(pig, key),
  })
  await runtime.sync([extension(KEY, 'wave')])
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(target.handlers[EXT_ACTION_EVENT].length, 1)
  target.fire({ key: 'ext-demo/wave/pulse' })
  assert.equal(pigActionArt(pig), 'pulse')

  await runtime.sync([])
  assert.equal(pigActionArt(pig), null, '卸载时正在播的帧动作安全结束')
  player.dispose()
  runtime.dispose()
  globalThis.document = savedDocument
})
