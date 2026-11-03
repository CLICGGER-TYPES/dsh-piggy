// @ts-check
/**
 * F03 presentation ownership regression (author-only; the developer did not run
 * product tests). Independent V03 should run this against the frozen candidate
 * after installing the normal build/test dependencies.
 *
 * These cases are deliberately two real presentation contexts with explicit
 * roots/state, not two calls into one module-global art slot.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { artSource, createArtResourceRegistry } from '../src/client/art-path.js'
import { attachPigActions } from '../src/client/pig-actions.js'
import { fakeDom } from './helpers/bundle.js'

function installEnvironment() {
  const dom = fakeDom()
  const windowListeners = {}
  globalThis.document = dom.document
  globalThis.window = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: id => clearTimeout(id),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: id => clearInterval(id),
    addEventListener: (name, fn) => { (windowListeners[name] ??= []).push(fn) },
    removeEventListener: (name, fn) => { windowListeners[name] = (windowListeners[name] ?? []).filter(entry => entry !== fn) },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    innerWidth: 1280,
    innerHeight: 800,
  }
  return dom
}

function root(dom) {
  const node = dom.document.createElement('div')
  dom.body.appendChild(node)
  return node
}

function syncBase(presentation, art = 'piglet') {
  presentation.parts.pig.setAttribute('data-stage', 'piglet')
  presentation.parts.pig.setAttribute('data-art', art)
  presentation.parts.pig.setAttribute('data-mood', 'fine')
  return presentation.art.sync()
}

test('two explicit roots keep independent feedback, art and teardown', async () => {
  const dom = installEnvironment()
  const { createPresentationContext } = await import('../src/client/presentation-context.js')
  const leftRoot = root(dom)
  const rightRoot = root(dom)
  const left = createPresentationContext({ root: leftRoot, state: { isStopped: () => false } })
  const right = createPresentationContext({ root: rightRoot, state: { isStopped: () => false } })
  try {
    assert.equal(leftRoot.children.includes(left.parts.host), true)
    assert.equal(rightRoot.children.includes(right.parts.host), true)
    assert.notEqual(left.parts.host, right.parts.host)
    assert.notEqual(left.parts.pig, right.parts.pig)
    assert.notEqual(left.art, right.art)

    syncBase(left)
    syncBase(right)
    const rightBefore = right.parts.pigArt.src
    left.art.forceFeedbackArt('faint')
    left.art.sync()
    assert.equal(left.parts.pigArt.src, artSource('feedback/faint'))
    assert.equal(right.parts.pigArt.src, rightBefore, 'forcing A feedback must not touch B')

    right.art.forceFeedbackArt('birthday')
    right.art.sync()
    assert.equal(right.parts.pigArt.src, artSource('feedback/birthday'))
    assert.equal(left.parts.pigArt.src, artSource('feedback/faint'), 'B feedback must not replace A')

    left.dispose()
    assert.equal(leftRoot.children.includes(left.parts.host), false, 'dispose removes only A root')
    assert.equal(rightRoot.children.includes(right.parts.host), true, 'dispose keeps B root')
    assert.equal(left.art.sync(), false)
    right.art.clearEffectArt()
    right.parts.pig.setAttribute('data-art', 'piglet')
    assert.equal(right.art.sync(), true, 'B remains usable after A disposal')
  } finally {
    left.dispose()
    right.dispose()
    delete globalThis.window
    delete globalThis.document
  }
})

test('one live art context per pig; a disposed owner cannot damage a rebind', async () => {
  const dom = installEnvironment()
  const { createPresentationContext } = await import('../src/client/presentation-context.js')
  const { createArtContext } = await import('../src/client/art.js')
  const left = createPresentationContext({ root: root(dom), state: { isStopped: () => false } })
  let rebound = null
  try {
    syncBase(left)
    const pig = left.parts.pig
    const image = left.parts.pigArt
    const emoji = left.parts.pigEmoji
    assert.throws(
      () => createArtContext({ pig, image, emoji }),
      /live presentation art context/,
      'a second live owner for the same pig is rejected',
    )
    assert.equal(left.art.sync(), true, 'rejected duplicate did not damage the live owner')

    let queued = null
    left.art.setArtSwapHook(apply => { queued = apply })
    pig.setAttribute('data-art', 'skin-mint')
    left.art.sync()
    left.dispose()

    rebound = createArtContext({ pig, image, emoji })
    pig.setAttribute('data-art', 'piglet')
    const before = image.src
    assert.equal(rebound.sync(), true, 'a disposed pig can bind a fresh context')
    assert.equal(left.art.sync(), false, 'old context stays dead')
    left.art.dispose()
    left.art.forceFeedbackArt('faint')
    if (queued !== null) queued()
    assert.equal(rebound.sync(), true, 'late old callbacks do not mark the rebound pig dead')
    assert.equal(image.src, before, 'stale old selection cannot replace rebound artwork')
    left.dispose()
    assert.equal(rebound.sync(), true, 'old presentation dispose stays idempotent')
  } finally {
    left.dispose()
    if (rebound !== null) rebound.dispose()
    delete globalThis.window
    delete globalThis.document
  }
})

test('dizzy show/clear/sync is bound to its own pig across microtasks', async () => {
  const dom = installEnvironment()
  const { createPresentationContext } = await import('../src/client/presentation-context.js')
  const { createDizzy } = await import('../src/client/feel/dizzy.js')
  const left = createPresentationContext({ root: root(dom), state: { isStopped: () => false } })
  const right = createPresentationContext({ root: root(dom), state: { isStopped: () => false } })
  const noBurst = () => {}
  const leftDizzy = createDizzy({ pig: left.parts.pig, pigArt: left.parts.pigArt, pigEmoji: left.parts.pigEmoji, burst: noBurst, getMode: () => 'full', art: left.art })
  const rightDizzy = createDizzy({ pig: right.parts.pig, pigArt: right.parts.pigArt, pigEmoji: right.parts.pigEmoji, burst: noBurst, getMode: () => 'full', art: right.art })
  try {
    syncBase(left)
    syncBase(right)
    const rightBefore = right.parts.pigArt.src
    leftDizzy.trigger()
    assert.equal(left.parts.pig.getAttribute('data-react'), 'dizzy')
    assert.equal(left.parts.pigArt.src, artSource('feedback/faint'))
    assert.equal(right.parts.pigArt.src, rightBefore, 'A dizzy never selects B art')
    await Promise.resolve()
    right.art.sync()
    assert.equal(right.parts.pigArt.src, rightBefore, 'microtask/interleaved B sync stays on B art')

    rightDizzy.trigger()
    assert.equal(right.parts.pigArt.src, artSource('feedback/faint'))
    assert.equal(left.parts.pigArt.src, artSource('feedback/faint'))
    leftDizzy.cancel()
    assert.equal(left.parts.pig.getAttribute('data-react'), null)
    assert.notEqual(left.parts.pigArt.src, artSource('feedback/faint'))
    assert.equal(right.parts.pigArt.src, artSource('feedback/faint'), 'clearing A does not clear B')
    rightDizzy.cancel()
    assert.notEqual(right.parts.pigArt.src, artSource('feedback/faint'))
  } finally {
    leftDizzy.dispose()
    rightDizzy.dispose()
    left.dispose()
    right.dispose()
    delete globalThis.window
    delete globalThis.document
  }
})

test('a queued A swap cannot apply after A disposal or touch B', async () => {
  const dom = installEnvironment()
  const { createPresentationContext } = await import('../src/client/presentation-context.js')
  const left = createPresentationContext({ root: root(dom), state: { isStopped: () => false } })
  const right = createPresentationContext({ root: root(dom), state: { isStopped: () => false } })
  try {
    syncBase(left)
    syncBase(right)
    const leftBefore = left.parts.pigArt.src
    const rightBefore = right.parts.pigArt.src
    let queued = null
    left.art.setArtSwapHook(apply => { queued = apply })
    left.parts.pig.setAttribute('data-art', 'skin-mint')
    left.art.sync()
    assert.equal(typeof queued, 'function')
    left.dispose()
    queued()
    assert.equal(left.parts.pigArt.src, leftBefore, 'a disposed instance ignores its stale queued swap')
    assert.equal(right.parts.pigArt.src, rightBefore, 'A stale swap never edits B')
  } finally {
    left.dispose()
    right.dispose()
    delete globalThis.window
    delete globalThis.document
  }
})

test('a delayed reaction timer is owned by its instance and dies with it', async () => {
  const dom = installEnvironment()
  const { createPresentationContext } = await import('../src/client/presentation-context.js')
  const left = createPresentationContext({ root: root(dom), state: { isStopped: () => false } })
  const right = createPresentationContext({ root: root(dom), state: { isStopped: () => false } })
  try {
    syncBase(left)
    syncBase(right)
    left.effects.react('pet', 5)
    assert.equal(left.parts.pig.getAttribute('data-react'), 'pet')
    left.dispose()
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.equal(left.parts.pig.getAttribute('data-react'), 'pet', 'disposed timer did not run')
    assert.equal(right.parts.pig.getAttribute('data-react'), null, 'A timer never touched B')
  } finally {
    left.dispose()
    right.dispose()
    delete globalThis.window
    delete globalThis.document
  }
})

test('owner resource definitions are shared by reference while identity, skin view, actions and channel stay per presentation', async () => {
  const dom = installEnvironment()
  const { createPresentationContext } = await import('../src/client/presentation-context.js')
  const ownerResources = createArtResourceRegistry()
  ownerResources.registerPack({
    namespace: 'owner-one',
    pack: 'visuals',
    revision: 'skin-v1',
    resources: [
      { key: 'rose', kind: 'skin', source: { scheme: 'path', path: 'pigs/rose.png' } },
      { key: 'wave', kind: 'action', source: { scheme: 'builtin', key: 'piglet-blink' }, duration: 240 },
    ],
  })
  const unrelatedOwnerResources = createArtResourceRegistry()
  const viewA = { pig: { skin: 'owner-one/visuals/rose', worn: ['rose-hat'] } }
  const viewB = { pig: { skin: 'piglet', worn: [] } }
  const a = createPresentationContext({
    root: root(dom), identity: { ownerId: 'owner-one', pigId: 'pig-a' }, artResources: ownerResources,
    state: { getView: () => viewA, isStopped: () => false, isQuiet: () => false },
  })
  const b = createPresentationContext({
    root: root(dom), identity: { ownerId: 'owner-one', pigId: 'pig-b' }, artResources: ownerResources,
    state: { getView: () => viewB, isStopped: () => false, isQuiet: () => false },
  })
  const clock = () => {
    let sequence = 0
    return { setTimeout: () => ++sequence, clearTimeout: () => {} }
  }
  const playerA = attachPigActions({
    pig: a.parts.pig, artResources: a.artResources, isStopped: () => false, isDragging: () => false,
    render() {}, clock: clock(), random: () => 0, preload: () => Promise.resolve(true),
  })
  const playerB = attachPigActions({
    pig: b.parts.pig, artResources: b.artResources, isStopped: () => false, isDragging: () => false,
    render() {}, clock: clock(), random: () => 0, preload: () => Promise.resolve(true),
  })
  try {
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(a.identity, { ownerId: 'owner-one', pigId: 'pig-a' })
    assert.equal(Object.isFrozen(a.identity), true, 'the identity label cannot be retargeted after construction')
    assert.throws(() => { a.identity = { ownerId: 'owner-one', pigId: 'pig-b' } }, TypeError)
    assert.equal(b.identity.pigId, 'pig-b')
    assert.strictEqual(a.artResources, ownerResources)
    assert.strictEqual(b.artResources, ownerResources, 'one owner registry is shared by reference')
    assert.equal(ownerResources.resolveString('owner-one/visuals/wave')?.descriptor.kind, 'action')
    const foreignResource = unrelatedOwnerResources.resolveString('owner-one/visuals/wave')
    assert.equal(foreignResource?.exists, false,
      'another owner registry cannot resolve this owner pack as a real resource')
    assert.equal(foreignResource?.legacy, true, 'the pre-existing unknown-string fallback remains available')

    for (const presentation of [a, b]) {
      presentation.parts.pig.setAttribute('data-stage', 'piglet')
      presentation.parts.pig.setAttribute('data-mood', 'fine')
      presentation.parts.pig.setAttribute('data-art', presentation.getView().pig.skin)
      assert.equal(presentation.art.sync(), true)
    }
    assert.equal(a.parts.pigArt.src, artSource(viewA.pig.skin, ownerResources))
    assert.equal(b.parts.pigArt.src, artSource(viewB.pig.skin, ownerResources))
    assert.notEqual(a.parts.pigArt.src, b.parts.pigArt.src, 'each presentation selects art from its own pig body')
    assert.notEqual(a.audio, b.audio, 'audio channels are per presentation')

    assert.equal(playerA.play('owner-one/visuals/wave'), true)
    assert.equal(playerB.play('owner-one/visuals/wave'), true, 'shared action registration does not share player state')
    assert.equal(a.parts.pig.getAttribute('data-micro-action'), 'wave')
    assert.equal(b.parts.pig.getAttribute('data-micro-action'), 'wave')

    viewA.pig.skin = 'skin-mint'
    viewA.pig.worn.push('custom-hat')
    assert.equal(a.getView().pig.skin, 'skin-mint')
    assert.deepEqual(a.getView().pig.worn, ['rose-hat', 'custom-hat'])
    assert.equal(b.getView().pig.skin, 'piglet', 'changing A does not change B skin')
    assert.deepEqual(b.getView().pig.worn, [], 'changing A does not change B worn selection')
    a.parts.pig.setAttribute('data-art', a.getView().pig.skin)
    a.art.sync()
    assert.equal(b.parts.pigArt.src, artSource(viewB.pig.skin, ownerResources), 'A selection does not repaint B')

    playerA.dispose()
    a.dispose()
    assert.equal(a.audio.disposed, true)
    assert.equal(b.audio.disposed, false)
    assert.equal(b.parts.pig.getAttribute('data-micro-action'), 'wave', 'A teardown leaves B action active')
    assert.equal(ownerResources.resolveString('owner-one/visuals/wave')?.descriptor.kind, 'action',
      'presentation teardown does not dispose the shared owner registry')
  } finally {
    playerA.dispose()
    playerB.dispose()
    a.dispose()
    b.dispose()
    delete globalThis.window
    delete globalThis.document
  }
})

test('presentation identity is optional for the legacy single-pig caller and rejects a partial pair', async () => {
  const dom = installEnvironment()
  const { createPresentationContext } = await import('../src/client/presentation-context.js')
  const legacy = createPresentationContext({ root: root(dom), state: { isStopped: () => false } })
  try {
    assert.equal(legacy.identity, null)
    assert.strictEqual(legacy.artResources, (await import('../src/client/art-path.js')).defaultArtResources)
    assert.throws(() => createPresentationContext({ identity: { ownerId: 'owner-one' } }), /ownerId and pigId/)
  } finally {
    legacy.dispose()
    delete globalThis.window
    delete globalThis.document
  }
})

test('normal mount consumes the same presentation factory and owns its disposal', async () => {
  const source = await readFile(new URL('../src/client/index.js', import.meta.url), 'utf8')
  assert.match(source, /var presentation = createPresentationContext\(\{/)
  assert.match(source, /var fx = presentation\.effects/)
  assert.match(source, /var feel = presentation\.feel/)
  assert.match(source, /presentation\.createBirthday\(ctx, function \(\) \{ refresh\(\) \}\)/)
  assert.match(source, /presentation\.dispose\(\)/)
  assert.match(source, /identity: identity,/)
  assert.match(source, /artResources: presentation\.artResources,/)
  assert.doesNotMatch(source, /setArtSwapHook\(function \(apply\) \{ feel\.coverSwap\(apply\) \}\)/, 'the old module-global hook must not be used by the normal path')
})
