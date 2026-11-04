// @ts-check
/**
 * F04/F04R authored resource-contract regression (author-only; the developer did
 * not run product tests). Independent V04 should run this against the frozen
 * final source together with the six presentation tests.
 *
 * These cases exercise the declarative descriptor/registry API and the default
 * compatibility adapter; they do not claim UI, multi-pig product or network
 * behavior.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { PIG_ART_ASSETS } from '../../../packages/pet-core/src/data/art-assets.js'
import { PIG_ART_REVISIONS } from '../../../packages/pet-core/src/data/art-revisions.js'
import {
  ART_RESOURCE_SCHEMA,
  LEGACY_NAMESPACE,
  artSource,
  createArtResourceRegistry,
  defaultArtResources,
  hasArtResource,
  hasBuiltinArt,
  normalizeArtKey,
  resolveArtResource,
} from '../../../src/client/art-path.js'
import { refreshCustomArt } from '../../../src/client/custom-art.js'
import { ACTION_DURATION, attachPigActions, matchesPigActionEligibility, pigActionArt, pigActionResource, playPigAction } from '../../../src/client/pig-actions.js'

function attributePig(initial = {}) {
  const attrs = { 'data-art': 'piglet', 'data-mood': 'fine', ...initial }
  return {
    attrs,
    parentNode: null,
    getAttribute: key => attrs[key] ?? null,
    setAttribute(key, value) { attrs[key] = value },
    removeAttribute(key) { delete attrs[key] },
    addEventListener() {}, removeEventListener() {},
  }
}

function artImage(style = new Map()) {
  let src = ''
  return {
    hidden: false,
    get src() { return src },
    set src(value) { src = String(value) },
    getAttribute(key) { return key === 'src' ? src : null },
    removeAttribute(key) { if (key === 'src') src = '' },
    style: { setProperty(key, value) { style.set(key, String(value)) } },
  }
}

function timerFixture() {
  let now = 0
  let sequence = 0
  const timers = new Map()
  return {
    clock: {
      setTimeout(fn, ms) { const id = ++sequence; timers.set(id, { fn, at: now + ms }); return id },
      clearTimeout(id) { timers.delete(id) },
    },
    advance(ms) {
      const end = now + ms
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (next === undefined) break
        now = next[1].at
        timers.delete(next[0])
        next[1].fn()
      }
      now = end
    },
    pending: () => timers.size,
  }
}

test('default adapter keeps every existing legacy URL and fallback exactly', () => {
  for (const [key, path] of Object.entries(PIG_ART_ASSETS)) {
    assert.equal(artSource(key), '/dsh-piggy/art/' + path + '?v=' + PIG_ART_REVISIONS[key], key)
  }
  assert.equal(artSource('feedback/faint'), '/dsh-piggy/art/pigs/feedback/faint.png?v=' + PIG_ART_REVISIONS['feedback/faint'])
  assert.equal(artSource('does-not-exist'), '/dsh-piggy/art/does-not-exist.svg')
  assert.equal(hasBuiltinArt('piglet'), true)
  assert.equal(hasBuiltinArt('does-not-exist'), false)
  assert.equal(hasArtResource('feedback/faint'), true)
  assert.equal(hasArtResource('does-not-exist'), false)
  assert.equal(artSource('custom-f04-adapter'), '/dsh-piggy/art/custom-f04-adapter')
  assert.equal(refreshCustomArt('custom-f04-adapter'), 1)
  assert.equal(artSource('custom-f04-adapter'), '/dsh-piggy/art/custom-f04-adapter?v=1')
})

test('default registry exposes the unchanged action pack and is read-only', () => {
  const actions = defaultArtResources.list({ kind: 'action' })
  assert.deepEqual(actions.map(entry => [entry.descriptor.key, entry.descriptor.duration]), [['blink', 100], ['shy-pet', 420]])
  const blink = defaultArtResources.resolve('blink')
  assert.equal(blink?.descriptor.schema, ART_RESOURCE_SCHEMA)
  assert.equal(blink?.descriptor.kind, 'action')
  assert.equal(blink?.artKey, 'piglet-blink')
  assert.equal(Object.isFrozen(blink?.descriptor), true)
  assert.equal(Object.isFrozen(defaultArtResources), true)
  assert.equal(defaultArtResources.readonly, true)
  assert.throws(() => defaultArtResources.registerPack({
    namespace: 'nope', pack: 'x', resources: [{ key: 'a', source: { scheme: 'path', path: 'pigs/nope/a.png' } }],
  }), /read-only/)
})

test('namespaces and revisions keep the same short custom key distinct', () => {
  const ownerA = createArtResourceRegistry({ parent: null })
  const ownerB = createArtResourceRegistry({ parent: null })
  const pack = (path, revision) => ({
    namespace: path,
    pack: 'skins',
    resources: [{ key: 'custom-shared', kind: 'skin', source: { scheme: 'custom', key: 'custom-shared' }, revision }],
  })
  ownerA.registerPack(pack('owner-a', 'rev-a'))
  ownerB.registerPack(pack('owner-b', 'rev-b'))
  const a = ownerA.resolveRef({ namespace: 'owner-a', pack: 'skins', key: 'custom-shared' })
  const b = ownerB.resolveRef({ namespace: 'owner-b', pack: 'skins', key: 'custom-shared' })
  assert.notEqual(a?.url, b?.url)
  assert.notEqual(a?.cacheKey, b?.cacheKey)
  assert.equal(a?.url, '/dsh-piggy/art/custom-shared?v=rev-a')
  assert.equal(b?.url, '/dsh-piggy/art/custom-shared?v=rev-b')
  assert.equal(ownerA.resolveRef({ namespace: 'owner-b', pack: 'skins', key: 'custom-shared' }), null)
  const shortA = ownerA.resolveString('custom-shared')
  assert.equal(shortA?.id, 'owner-a/skins/custom-shared')
})

test('revision replacement is atomic, announced and only drops the previous cache key', () => {
  const registry = createArtResourceRegistry({ parent: null })
  const changes = []
  const off = registry.subscribe(change => changes.push(change))
  const pack = revision => ({
    namespace: 'owner', pack: 'skins', revision,
    resources: [{ key: 'custom-reload', kind: 'skin', source: { scheme: 'custom', key: 'custom-reload' } }],
  })
  registry.registerPack(pack('1'))
  const first = registry.resolveRef({ namespace: 'owner', pack: 'skins', key: 'custom-reload' })
  registry.registerPack(pack('2'), { replace: true })
  const second = registry.resolveRef({ namespace: 'owner', pack: 'skins', key: 'custom-reload' })
  assert.equal(registry.list().length, 1, 'replacing a revision does not duplicate the handle')
  assert.notEqual(first?.cacheKey, second?.cacheKey)
  assert.equal(registry.resolveRef({ namespace: 'owner', pack: 'skins', key: 'custom-reload', revision: '1' }), null)
  assert.equal(changes.length, 2)
  assert.equal(changes[1].changes[0].previousCacheKey, first?.cacheKey)
  assert.equal(changes[1].changes[0].cacheKey, second?.cacheKey)
  off()
  registry.registerPack({ ...pack('3') }, { replace: true })
  assert.equal(changes.length, 2, 'unsubscribe stops change delivery')
})

test('registration validates the whole pack before mutating and freezes descriptors', () => {
  const registry = createArtResourceRegistry({ parent: null })
  assert.throws(() => registry.registerPack({
    namespace: 'owner', pack: 'skins', revision: '1',
    resources: [
      { key: 'good', source: { scheme: 'path', path: 'pigs/owner/good.png' } },
      { key: 'bad', source: { scheme: 'path', path: '../escape.png' } },
    ],
  }), /invalid art resource path/)
  assert.equal(registry.list().length, 0, 'a bad entry does not half-install the first entry')

  assert.throws(() => registry.registerPack({
    namespace: 'owner', pack: 'skins', revision: '1',
    resources: [
      { key: 'same', source: { scheme: 'path', path: 'pigs/owner/a.png' } },
      { key: 'same', source: { scheme: 'path', path: 'pigs/owner/b.png' } },
    ],
  }), /duplicate art resource in pack/)
  assert.equal(registry.list().length, 0)

  const source = { scheme: 'path', path: 'pigs/owner/locked.png' }
  const declaration = { key: 'locked', kind: 'skin', source, revision: '1' }
  registry.registerPack({ namespace: 'owner', pack: 'skins', resources: [declaration] })
  declaration.key = 'mutated'
  source.path = 'pigs/owner/other.png'
  const frozen = registry.resolveRef({ namespace: 'owner', pack: 'skins', key: 'locked' })
  assert.equal(frozen?.url, '/dsh-piggy/art/pigs/owner/locked.png?v=1')
  assert.equal(Object.isFrozen(frozen?.descriptor), true)
  assert.equal(Object.isFrozen(frozen?.descriptor.source), true)

  assert.throws(() => registry.registerPack({
    namespace: 'owner', pack: 'skins', revision: '1',
    resources: [{ key: 'locked', source: { scheme: 'path', path: 'pigs/owner/locked.png' } }],
  }), /duplicate art resource/)

  assert.throws(() => registry.registerPack({
    namespace: 'owner', pack: 'evil', revision: '1',
    resources: [{ key: 'remote', source: { scheme: 'url', url: 'https://example.test/a.png' } }],
  }), /unsupported art resource source scheme/)

  assert.throws(() => registry.registerPack({
    namespace: 'owner', pack: 'skins', revision: '1',
    resources: [{ key: 'no-duration', kind: 'action', source: { scheme: 'path', path: 'pigs/owner/action.png' } }],
  }), /needs a duration/)

  assert.throws(() => registry.registerPack({
    namespace: 'owner', pack: 'skins', revision: '1',
    resources: [{ key: 'typo', kind: 'action', source: { scheme: 'path', path: 'pigs/owner/typo.png' }, duration: 100, eligibilty: {} }],
  }), /unsupported art resource field/)
})

test('a private action pack plays through the normal player without a new branch', async () => {
  const registry = createArtResourceRegistry()
  registry.registerPack({
    namespace: 'helper', pack: 'work', revision: '1',
    resources: [{
      key: 'sweep', kind: 'action', source: { scheme: 'path', path: 'pigs/helper/sweep.png' },
      duration: 250,
      sound: 'sweep',
      eligibility: { art: 'piglet', stageNot: ['box', 'grave', 'dead-day'], absent: ['activity', 'idle', 'illness'], party: false, react: [] },
    }],
  })
  const savedDocument = globalThis.document
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }
  const first = attributePig()
  const second = attributePig()
  const timer = timerFixture()
  const cues = []
  const playerA = attachPigActions({
    pig: first, clock: timer.clock, preload: async () => {}, isStopped: () => false, isDragging: () => false,
    render() {}, artResources: registry,
    audio: { play(key) { cues.push(key); return true } },
  })
  const playerB = attachPigActions({
    pig: second, clock: timer.clock, preload: async () => {}, isStopped: () => false, isDragging: () => false,
    render() {}, artResources: registry,
  })
  try {
    await Promise.resolve()
    await Promise.resolve()
    const resolved = registry.resolveRef({ namespace: 'helper', pack: 'work', key: 'sweep' })
    assert.ok(resolved)
    assert.equal(playerA.play(resolved), true)
    assert.deepEqual(cues, ['sweep'], 'action sound goes through the presentation channel')
    assert.equal(pigActionArt(first), 'helper/work/sweep')
    assert.equal(pigActionResource(first)?.cacheKey, resolved.cacheKey)
    assert.equal(pigActionArt(second), null, 'a played action never leaks to another pig')
    timer.advance(249)
    assert.equal(pigActionArt(first), 'helper/work/sweep')
    timer.advance(1)
    assert.equal(pigActionArt(first), null)
    first.setAttribute('data-idle', 'nap')
    assert.equal(playerA.play(resolved), false, 'declarative eligibility still blocks the private action')
    assert.equal(playPigAction(first, resolved), false)
  } finally {
    playerA.dispose()
    playerB.dispose()
    globalThis.document = savedDocument
  }
})

test('unknown refs, missing art and unsafe strings use the existing fallback/no-op', () => {
  const registry = createArtResourceRegistry({ parent: null })
  assert.equal(resolveArtResource({ namespace: 'missing', pack: 'pack', key: 'x' }, registry), null)
  const fallback = registry.resolveString('missing/pack/x')
  assert.equal(fallback?.exists, false)
  assert.equal(fallback?.url, '/dsh-piggy/art/missing/pack/x.svg')
  assert.equal(hasArtResource('missing/pack/x', registry), false)
  assert.equal(normalizeArtKey('piglet'), 'piglet')
  assert.equal(normalizeArtKey('custom-safe'), 'custom-safe')
  assert.equal(normalizeArtKey('feedback/faint'), 'feedback/faint')
  assert.equal(normalizeArtKey('helper/work/sweep'), 'helper/work/sweep')
  assert.equal(normalizeArtKey('../escape'), '')
  assert.equal(normalizeArtKey('https://example.test/a.png'), '')
  assert.equal(normalizeArtKey('a?b=1'), '')
})

test('a private action can declare a generic fallback and default timings stay 100/420', async () => {
  const registry = createArtResourceRegistry()
  registry.registerPack({
    namespace: 'helper', pack: 'fallback', revision: '1',
    resources: [{
      key: 'only-on-mint', kind: 'action', source: { scheme: 'path', path: 'pigs/helper/only-mint.png' },
      duration: 333,
      eligibility: { art: 'skin-mint' },
      fallback: { namespace: 'dsh-piggy', pack: 'actions', key: 'blink' },
    }],
  })
  const savedDocument = globalThis.document
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }
  const pig = attributePig()
  const timer = timerFixture()
  const player = attachPigActions({
    pig, clock: timer.clock, preload: async () => {}, isStopped: () => false, isDragging: () => false,
    render() {}, artResources: registry,
  })
  try {
    await Promise.resolve()
    await Promise.resolve()
    const entry = registry.resolveRef({ namespace: 'helper', pack: 'fallback', key: 'only-on-mint' })
    assert.ok(entry)
    assert.equal(playPigAction(pig, entry), true)
    assert.equal(pigActionArt(pig), 'piglet-blink', 'ineligible private action falls back to the default blink descriptor')
    timer.advance(99)
    assert.equal(pigActionArt(pig), 'piglet-blink')
    timer.advance(1)
    assert.equal(pigActionArt(pig), null)
    assert.deepEqual(ACTION_DURATION, { blink: 100, 'shy-pet': 420 })
  } finally {
    player.dispose()
    globalThis.document = savedDocument
  }
})

test('normal mount forwards the optional registry through the frozen life spread', () => {
  const life = readFileSync(new URL('../../../src/client/life.js', import.meta.url), 'utf8')
  const index = readFileSync(new URL('../../../src/client/index.js', import.meta.url), 'utf8')
  assert.match(life, /attachPigActions\(\{ \.\.\.c, render:/, 'life.js still forwards its whole context')
  assert.match(index, /var lifeOptions = \{/)
  assert.match(index, /artResources: artResources,/)
  assert.match(index, /attachLife\(lifeOptions\)/)
})

test('a registered skin descriptor frame is consumed by the art context', async () => {
  const registry = createArtResourceRegistry()
  registry.registerPack({
    namespace: 'owner', pack: 'skins', revision: '1',
    resources: [{
      key: 'framed', kind: 'skin', source: { scheme: 'path', path: 'pigs/owner/framed.png' }, frame: [2, 5, -3],
    }],
  })
  const { createArtContext } = await import('../../../src/client/art.js')
  const pig = attributePig({ 'data-art': 'owner/skins/framed', 'data-stage': 'piglet' })
  const style = new Map()
  const image = artImage(style)
  const art = createArtContext({ pig, image, artResources: registry })
  try {
    assert.equal(art.sync(), true)
    assert.equal(image.src, '/dsh-piggy/art/pigs/owner/framed.png?v=1')
    assert.equal(style.get('--art-zoom'), '2')
    assert.equal(style.get('--art-x'), '5%')
    assert.equal(style.get('--art-y'), '-3%')
  } finally {
    art.dispose()
  }
})

test('a queued registered-resource selection cannot apply after a revision replacement', async () => {
  const registry = createArtResourceRegistry()
  const pack = (revision, frame) => ({
    namespace: 'owner', pack: 'skins', revision,
    resources: [{
      key: 'queued', kind: 'skin',
      source: { scheme: 'path', path: 'pigs/owner/queued.png' },
      frame,
    }],
  })
  registry.registerPack(pack('1', [1, 2, 3]))
  const { createArtContext } = await import('../../../src/client/art.js')
  const pig = attributePig({ 'data-art': 'owner/skins/queued', 'data-stage': 'piglet' })
  const style = new Map()
  const image = artImage(style)
  const art = createArtContext({ pig, image, artResources: registry })
  let queued = null
  try {
    art.setArtSwapHook(apply => { queued = apply })
    assert.equal(art.sync(), true)
    assert.equal(typeof queued, 'function')
    registry.registerPack(pack('2', [2, 5, -3]), { replace: true })
    const stale = queued
    stale()
    assert.equal(image.src, '', 'stale rev1 callback cannot write after rev2 registration')
    assert.equal(style.has('--art-zoom'), false, 'stale rev1 frame cannot write either')
    art.setArtSwapHook(null)
    assert.equal(art.sync(), true)
    assert.equal(image.src, '/dsh-piggy/art/pigs/owner/queued.png?v=2')
    assert.equal(style.get('--art-zoom'), '2')
    assert.equal(style.get('--art-x'), '5%')
    assert.equal(style.get('--art-y'), '-3%')
  } finally {
    art.dispose()
  }
})

test('a queued selection is invalidated by same-revision frame metadata replacement', async () => {
  const registry = createArtResourceRegistry()
  const pack = (frame) => ({
    namespace: 'owner', pack: 'skins', revision: '1',
    resources: [{
      key: 'same-revision', kind: 'skin',
      source: { scheme: 'path', path: 'pigs/owner/same-revision.png' },
      frame,
    }],
  })
  registry.registerPack(pack([1, 2, 3]))
  const { createArtContext } = await import('../../../src/client/art.js')
  const pig = attributePig({ 'data-art': 'owner/skins/same-revision', 'data-stage': 'piglet' })
  const style = new Map()
  const image = artImage(style)
  const art = createArtContext({ pig, image, artResources: registry })
  let queued = null
  try {
    art.setArtSwapHook(apply => { queued = apply })
    assert.equal(art.sync(), true)
    registry.registerPack(pack([2, 5, -3]), { replace: true })
    const stale = queued
    stale()
    assert.equal(image.src, '', 'same-revision metadata replacement still invalidates the queued apply')
    art.setArtSwapHook(null)
    assert.equal(art.sync(), true)
    assert.equal(image.src, '/dsh-piggy/art/pigs/owner/same-revision.png?v=1')
    assert.equal(style.get('--art-zoom'), '2')
    assert.equal(style.get('--art-x'), '5%')
    assert.equal(style.get('--art-y'), '-3%')
  } finally {
    art.dispose()
  }
})

test('same-URL frame replacement updates on sync, resets when removed, and leaves B alone', async () => {
  const registry = createArtResourceRegistry()
  const packA = frame => ({
    namespace: 'owner', pack: 'skins', revision: '1',
    resources: [{
      key: 'framed', kind: 'skin',
      source: { scheme: 'builtin', key: 'piglet' },
      frame,
    }],
  })
  const packB = {
    namespace: 'owner', pack: 'skins', revision: '1',
    resources: [{
      key: 'other', kind: 'skin',
      source: { scheme: 'builtin', key: 'piglet' },
      frame: [0.8, 1, 1],
    }],
  }
  registry.registerPack(packA([1.2, 4, -2]))
  registry.registerPack(packB)
  const { createArtContext } = await import('../../../src/client/art.js')
  const styleA = new Map()
  const styleB = new Map()
  const imageA = artImage(styleA)
  const imageB = artImage(styleB)
  const pigA = attributePig({ 'data-art': 'owner/skins/framed', 'data-stage': 'piglet' })
  const pigB = attributePig({ 'data-art': 'owner/skins/other', 'data-stage': 'piglet' })
  const artA = createArtContext({ pig: pigA, image: imageA, artResources: registry })
  const artB = createArtContext({ pig: pigB, image: imageB, artResources: registry })
  try {
    assert.equal(artA.sync(), true)
    assert.equal(artB.sync(), true)
    const canonical = artSource('piglet')
    assert.equal(imageA.src, canonical)
    assert.equal(imageB.src, canonical)
    assert.equal(styleA.get('--art-zoom'), '1.2')
    assert.equal(styleB.get('--art-zoom'), '0.8')

    registry.registerPack(packA([2, 5, -3]), { replace: true })
    assert.equal(artA.sync(), true)
    assert.equal(imageA.src, canonical, 'frame replacement keeps the canonical builtin URL')
    assert.equal(styleA.get('--art-zoom'), '2')
    assert.equal(styleA.get('--art-x'), '5%')
    assert.equal(styleA.get('--art-y'), '-3%')
    assert.equal(styleB.get('--art-zoom'), '0.8', 'B keeps its own frame when A is replaced')
    assert.equal(styleB.get('--art-x'), '1%')
    assert.equal(styleB.get('--art-y'), '1%')

    registry.registerPack(packA(null), { replace: true })
    assert.equal(artA.sync(), true)
    assert.equal(imageA.src, canonical)
    assert.equal(styleA.get('--art-zoom'), '1.0693', 'removing the hint restores the builtin default')
    assert.equal(styleA.get('--art-x'), '0%')
    assert.equal(styleA.get('--art-y'), '0%')
    assert.equal(styleB.get('--art-zoom'), '0.8')
  } finally {
    artA.dispose()
    artB.dispose()
  }
})

test('a writable parent registry is rejected before construction can use it', () => {
  const writable = createArtResourceRegistry({ parent: null })
  assert.throws(() => createArtResourceRegistry({ parent: writable }), /read-only/)
  assert.throws(() => createArtResourceRegistry({ parent: {
    readonly: false,
    resolveRef() { return null },
    resolveString() { return null },
  } }), /read-only/)
  const withDefaultParent = createArtResourceRegistry({ parent: defaultArtResources })
  assert.equal(withDefaultParent.readonly, false)
})

test('legacy ordinary-pig eligibility matches the old blink/shy-pet conditions', () => {
  const pig = attributePig()
  assert.equal(matchesPigActionEligibility(pig, defaultArtResources.resolve('blink')?.descriptor.eligibility ?? null), true)
  assert.equal(matchesPigActionEligibility(pig, defaultArtResources.resolve('shy-pet')?.descriptor.eligibility ?? null), true)
  pig.setAttribute('data-react', 'pet')
  assert.equal(matchesPigActionEligibility(pig, defaultArtResources.resolve('blink')?.descriptor.eligibility ?? null), false)
  assert.equal(matchesPigActionEligibility(pig, defaultArtResources.resolve('shy-pet')?.descriptor.eligibility ?? null), true)
  pig.setAttribute('data-art', 'skin-mint')
  assert.equal(matchesPigActionEligibility(pig, defaultArtResources.resolve('shy-pet')?.descriptor.eligibility ?? null), false)
})

test('custom skin normalization consumes the resolver without changing existing art strings', async () => {
  const savedWindow = globalThis.window
  const savedDocument = globalThis.document
  const store = new Map()
  globalThis.window = {
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) },
    addEventListener() {}, removeEventListener() {},
  }
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }
  try {
    const { normalizeSkins } = await import('../../../src/client/normalize-skins.js')
    const skins = normalizeSkins({ entries: [
      { key: 'berry', art: 'custom-berry', contact: { x: 0.5, y: 0.2 } },
      { key: 'mint', art: 'skin-mint' },
      { key: 'builtin', art: 'piglet', contact: null },
      { key: 'bad', art: 'https://example.test/x.png' },
    ] })
    const byKey = key => skins.entries.find(entry => entry.key === key)
    assert.equal(byKey('berry').art, 'custom-berry')
    assert.equal(byKey('mint').art, 'skin-mint')
    assert.equal(byKey('builtin').art, 'piglet')
    assert.equal(byKey('bad').art, '')
    assert.deepEqual(byKey('berry').contact, { x: 0.5, y: 0.2 })
    assert.equal(byKey('mint').contact, null)
  } finally {
    if (savedWindow === undefined) delete globalThis.window
    else globalThis.window = savedWindow
    if (savedDocument === undefined) delete globalThis.document
    else globalThis.document = savedDocument
  }
})

test('resource module has no eval/Function/remote download path', () => {
  const source = readFileSync(new URL('../../../src/client/art-resources.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\beval\s*\(/)
  assert.doesNotMatch(source, /\bnew\s+Function\s*\(/)
  assert.doesNotMatch(source, /fetch\s*\(/)
  assert.equal(LEGACY_NAMESPACE, 'dsh-piggy')
})
