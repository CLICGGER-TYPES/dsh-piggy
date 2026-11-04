// M3 第四刀：第三方音效包注册、DOM 播放入口、失败隔离和动作 sound 绑定。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { RECIPES } from '../../../src/client/sounds.js'
import { attachPigActions, playPigAction } from '../../../src/client/pig-actions.js'
import { createArtResourceRegistry } from '../../../src/client/art-path.js'
import { buildExtensionActionPack } from '../../../src/client/ext-actions-pack.js'
import { EXT_SOUND_EVENT, createExtensionSoundRuntime } from '../../../src/client/ext-sounds.js'
import { hasExtensionSound, resolveExtensionSound } from '../../../src/client/audio-context.js'

const KEY = 'demo'
const BASE = `/dsh-piggy/ext/${KEY}/sounds/sfx/`
const PACK = JSON.stringify({
  pack: 'sfx',
  revision: 1,
  sounds: [
    { key: 'beep', synth: { tones: [{ type: 'sine', from: 440, to: 660, ms: 80, gain: 0.4 }] } },
    { key: 'boom', file: 'boom.ogg', durationMs: 400, gain: 0.5, debounceMs: 0, fallback: 'synth:beep' },
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
      actions: [],
      sounds: [{
        kind: 'sounds', pack, namespace: 'ext-' + key,
        base: `/dsh-piggy/ext/${key}/sounds/${pack}/`,
        entries: 2, files: 3, bytes: 100, available: true,
        ...(extra.assetPacks?.sounds?.[0] ?? {}),
      }],
    },
  }
}

function eventTarget() {
  const handlers = {}
  return {
    handlers,
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn) },
    removeEventListener(type, fn) { if (handlers[type]) handlers[type] = handlers[type].filter(item => item !== fn) },
    fire(detail) { for (const fn of handlers[EXT_SOUND_EVENT] || []) fn({ detail }) },
  }
}

function demoRoutes() {
  return {
    [BASE + 'pack.json']: response(PACK),
    '/dsh-piggy/ext/good/sounds/ok/pack.json': response(JSON.stringify({
      pack: 'ok',
      sounds: [{ key: 'ding', synth: { tones: [{ type: 'sine', from: 880, to: 880, ms: 50, gain: 0.2 }] } }],
    })),
  }
}

test('注册音效包：完整 key 和省略 pack 的短名都可解析', async () => {
  const target = eventTarget()
  const { fetch } = fakeFetch(demoRoutes())
  const runtime = createExtensionSoundRuntime({ play: () => true, target, fetch })
  await runtime.sync([extension(KEY, 'sfx')])
  try {
    assert.equal(hasExtensionSound('ext-demo/sfx/beep'), true)
    assert.equal(hasExtensionSound('ext-demo/sfx/boom'), true)
    assert.deepEqual(resolveExtensionSound('ext-demo/beep')?.key, 'ext-demo/sfx/beep')
    assert.equal(hasExtensionSound('ext-demo/sfx/missing'), false)
    assert.equal(hasExtensionSound('tap'), false, '第一方 key 不进扩展表')
    assert.equal(runtime.owns('ext-demo/sfx/beep'), true)
    assert.equal(runtime.owns('ext-demo/beep'), true)
    assert.equal(runtime.owns('tap'), false)
  } finally {
    runtime.dispose()
  }
  assert.equal(hasExtensionSound('ext-demo/sfx/beep'), false, 'dispose 注销全部扩展音效')
})

test('dsh-piggy:sound 只播放已注册的 ext- key；停用/卸载/恢复走同一生命周期', async () => {
  const target = eventTarget()
  const played = []
  const runtime = createExtensionSoundRuntime({
    target, fetch: fakeFetch(demoRoutes()).fetch, play: key => { played.push(key); return true },
  })
  await runtime.sync([extension(KEY, 'sfx')])
  target.fire({ key: 'ext-demo/sfx/beep' })
  target.fire({ key: 'ext-demo/sfx/boom' })
  assert.deepEqual(played, ['ext-demo/sfx/beep', 'ext-demo/sfx/boom'])

  target.fire({ key: 'ext-demo/sfx/missing' })
  target.fire({ key: 'tap' })
  target.fire({ key: 'dsh-piggy/sfx/tap' })
  target.fire({ key: 42 })
  assert.deepEqual(played, ['ext-demo/sfx/beep', 'ext-demo/sfx/boom'], '未知/第一方/裸 key 全部忽略')

  await runtime.sync([extension(KEY, 'sfx', { on: false })])
  assert.equal(hasExtensionSound('ext-demo/sfx/beep'), false, '停用后注销')
  target.fire({ key: 'ext-demo/sfx/beep' })
  assert.equal(played.length, 2, '停用后事件被拒绝')

  await runtime.sync([extension(KEY, 'sfx')])
  target.fire({ key: 'ext-demo/sfx/beep' })
  assert.equal(played.length, 3, '重新启用恢复播放')

  await runtime.sync([extension(KEY, 'sfx', { assetPacks: { sounds: [{ available: false }] } })])
  target.fire({ key: 'ext-demo/sfx/beep' })
  assert.equal(played.length, 3, 'available:false 也注销')

  await runtime.sync([extension(KEY, 'sfx')])
  target.fire({ key: 'ext-demo/sfx/beep' })
  assert.equal(played.length, 4)
  runtime.dispose()
})

test('更新 pack.json 后只保留新音效；坏包只影响自己且 warn 一次', async () => {
  const target = eventTarget()
  const played = []
  const urls = demoRoutes()
  const warnings = []
  const runtime = createExtensionSoundRuntime({
    target, warn: message => warnings.push(message), fetch: fakeFetch(urls).fetch,
    play: key => { played.push(key); return true },
  })
  await runtime.sync([extension(KEY, 'sfx')])
  assert.equal(hasExtensionSound('ext-demo/sfx/beep'), true)

  urls[BASE + 'pack.json'] = response(JSON.stringify({
    pack: 'sfx',
    revision: 2,
    sounds: [{ key: 'yip', synth: { tones: [{ type: 'square', from: 500, to: 400, ms: 60, gain: 0.3 }] } }],
  }))
  await runtime.sync([extension(KEY, 'sfx', { version: '2.0.0' })])
  assert.equal(hasExtensionSound('ext-demo/sfx/beep'), false, '旧音效被移除')
  assert.equal(hasExtensionSound('ext-demo/sfx/yip'), true)

  const bad = extension('bad', 'broken', { version: '1.0.0' })
  const good = extension('good', 'ok', { version: '1.0.0' })
  urls['/dsh-piggy/ext/bad/sounds/broken/pack.json'] = response('{not json', 200)
  await runtime.sync([bad, good])
  assert.equal(hasExtensionSound('ext-bad/broken/none'), false)
  assert.equal(hasExtensionSound('ext-good/ok/ding'), true, '另一个扩展照常注册')
  assert.deepEqual(RECIPES.tap, { tones: [{ type: 'sine', from: 660, to: 520, ms: 70, gain: 0.35 }] }, '第一方配方未受影响')
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /第三方音效包加载失败/)

  await runtime.sync([bad, good])
  assert.equal(warnings.length, 1, '同一份坏摘要不重复刷日志')
  runtime.dispose()
})

test('动作 sound 转成完整的 ext key，并由播放器原样交给音频通道', async () => {
  const input = await buildExtensionActionPack({
    key: KEY,
    pack: 'wave',
    version: '1.0.0',
    body: '{}',
    fetch: fakeFetch({}).fetch,
    value: {
      pack: 'wave',
      revision: 1,
      actions: [
        {
          key: 'hello', kind: 'action', durationMs: 200, sound: 'sfx/beep',
          frames: [
            { path: 'hello/00.png', durationMs: 100 },
            { path: 'hello/01.png', durationMs: 100 },
          ],
        },
        {
          key: 'nod', kind: 'action', durationMs: 100, sound: 'beep', source: 'nod.png',
        },
      ],
    },
  })
  assert.equal(input.resources[0].sound, 'ext-demo/sfx/beep')
  assert.equal(input.resources[1].sound, 'ext-demo/beep', '裸 key 保留为扩展内短名')

  const registry = createArtResourceRegistry()
  registry.registerPack(input, { replace: true })
  assert.equal(registry.resolveRef({ namespace: 'ext-demo', pack: 'wave', key: 'hello' })?.descriptor.sound, 'ext-demo/sfx/beep')

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
  const cues = []
  const savedDocument = globalThis.document
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }
  const player = attachPigActions({
    pig,
    clock: { setTimeout: () => 1, clearTimeout() {} },
    preload: async () => {},
    isStopped: () => false,
    isDragging: () => false,
    render() {},
    artResources: registry,
    audio: { play: (key, options) => { cues.push({ key, options }); return true } },
  })
  try {
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(playPigAction(pig, 'ext-demo/wave/hello'), true)
    assert.deepEqual(cues, [{ key: 'ext-demo/sfx/beep', options: undefined }])
  } finally {
    player.dispose()
    globalThis.document = savedDocument
  }
})
