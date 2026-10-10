import { PIG_ART_ASSETS } from '../packages/pet-core/src/data/art-assets.js'
import { BUILTIN_FRAMING, FRAME_HEIGHT } from '../src/client/feedback-framing.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { CSS } from '../src/client/styles.js'
import { SNAPSHOT, contentOf, findByAttr, findByClass, hostOf, mount, openPanel, sceneOf, settle } from './helpers/bundle.js'
import { hatchEgg, startInterest, decay } from '../core.js'

test('every composed CSS rule closes before another ordinary rule begins', () => {
  const stack = []
  let start = 0
  for (let index = 0; index < CSS.length; index += 1) {
    const char = CSS[index]
    if (char === '{') {
      const selector = CSS.slice(start, index).trim()
      const parent = stack.at(-1)
      assert.ok(!parent || parent.startsWith('@'), `nested rule inside ${parent}: ${selector}`)
      stack.push(selector)
      start = index + 1
    } else if (char === '}') {
      assert.ok(stack.length > 0, 'CSS closes a rule that was never opened')
      stack.pop()
      start = index + 1
    }
  }
  assert.deepEqual(stack, [], 'CSS leaves a rule open')
})

test('interest points arrive when the lesson ends, not when it starts', () => {
  const now = new Date(2026, 9, 4, 10).getTime()
  const pig = hatchEgg(now)
  pig.coins = 500
  pig.satiety = 100
  const before = pig.traits.charm ?? 0
  assert.equal(startInterest(pig, 'photography', now).ok, true)
  assert.equal(pig.traits.charm ?? 0, before)
  decay(pig, now + 29 * 60_000)
  assert.equal(pig.traits.charm ?? 0, before)
  decay(pig, now + 30 * 60_000)
  assert.equal(pig.traits.charm, before + 2)
})

test('interest tile states the wait and reward, and an active lesson shows time left', async () => {
  const interest = { key: 'photography', label: '摄影', emoji: '📷', traitLabel: '魅力', minutes: 30,
    cost: 40, gain: 2, certificate: '摄影证', certificateAfter: 5, times: 0, affordable: true }
  const options = { status: { ...SNAPSHOT, interests: [interest], subjects: [{ key: 'chinese', label: '语文', emoji: '📖', lessons: 0, affordable: true }] } }
  const { dom } = await mount(options)
  openPanel(dom, 'study')
  findByAttr(contentOf(dom), 'data-stage', 'interest').fire('click')
  assert.match(contentOf(dom).allText(), /约 30 分钟后 魅力 \+2/)

  options.status = { ...options.status, activity: { kind: 'interest', key: 'photography', label: '兴趣·摄影', emoji: '📷', secondsLeft: 1250, progress: 30 } }
  const { dom: active } = await mount({ status: options.status })
  openPanel(active, 'study')
  assert.match(contentOf(active).allText(), /摄影.*还有 21 分钟/)
})

test('finishing an interest lesson speaks its earned trait above the pig', async () => {
  const { dom } = await mount({ status: { ...SNAPSHOT, pending: [
    { id: 101, kind: 'interest', at: 1000, text: '大花 学会了摄影，魅力 +2 📷' },
  ] } })
  const bubble = findByClass(hostOf(dom), 'dp-bubble')
  assert.match(bubble.allText(), /学会了摄影，魅力 \+2/)
  assert.equal(bubble.hidden, false)
})

for (const [action, daily, line] of [
  ['signIn', { canSignIn: true, unclaimed: 0 }, '签到成功'],
  ['openGift', { canSignIn: false, unclaimed: 1 }, '礼包打开'],
]) {
  test(`collapsed ${action} says the actual reward above the pig`, async () => {
    const status = { ...SNAPSHOT, daily: { ...SNAPSHOT.daily, ...daily } }
    const { dom } = await mount({ status, actResult: { ...status, ok: true, reward: '20 🪙' } })
    const hint = findByClass(hostOf(dom), 'dp-daily')
    assert.equal(hostOf(dom).getAttribute('data-open'), 'false')
    hint.fire('click')
    await settle()
    const bubble = findByClass(hostOf(dom), 'dp-bubble')
    assert.match(bubble.allText(), new RegExp(`${line}.*20`))
    assert.equal(bubble.hidden, false)
  })
}

test('an old save can take off its worn scarf and hat without a dress shop shelf', async () => {
  const scarf = { key: 'scarf', label: '围巾', emoji: '🧣', kind: 'dress', slot: 'neck', worn: true, owned: true }
  const hat = { key: 'strawhat', label: '草帽', emoji: '👒', kind: 'dress', slot: 'head', worn: true, owned: true }
  const { dom, calls } = await mount({ status: { ...SNAPSHOT, dress: [scarf, hat], shop: [scarf, hat] } })
  openPanel(dom, 'bag')
  assert.equal(findByAttr(contentOf(dom), 'data-bag', 'dress'), undefined)
  findByAttr(contentOf(dom), 'data-bag', 'worn').fire('click')
  assert.match(contentOf(dom).allText(), /围巾.*脱下.*草帽.*脱下/)
  findByAttr(contentOf(dom), 'data-take-off', 'scarf').fire('click')
  await settle()
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'wear', item: 'scarf', on: false })
})

test('dex skin action sits in a spaced, centered row', async () => {
  const skin = { key: 'skin-angel', label: '天使猪', emoji: '😇', art: 'skin-angel', acquired: true, count: 1, description: '云朵上的猪' }
  const { dom } = await mount({ status: { ...SNAPSHOT, dex: { forms: [], skins: [skin], fish: [], items: [], souvenirs: [] },
    skins: { current: null, available: [skin] } } })
  openPanel(dom, 'dex')
  findByAttr(contentOf(dom), 'data-dex-section', 'skins').fire('click')
  findByAttr(contentOf(dom), 'data-dex-entry', 'skin-angel').fire('click')
  const button = findByAttr(contentOf(dom), 'data-dex-skin', 'skin-angel')
  assert.notEqual(button, undefined)
  assert.match(button.parentNode.className, /dp-dex-skin-action/)
  assert.match(CSS, /\.dp-dex-skin-action\{[^}]*margin-top:[1-9][0-9]*px;[^}]*justify-content:center/)
})

test('web outside click closes by default; setting can turn it off', async () => {
  const first = await mount()
  openPanel(first.dom, 'settings')
  assert.notEqual(findByAttr(contentOf(first.dom), 'data-auto-collapse', 'false'), undefined)
  const outside = first.dom.document.createElement('div')
  const clickOutside = first.documentListeners.pointerdown?.[0]
  assert.equal(typeof clickOutside, 'function')
  clickOutside({ target: outside, button: 0 })
  assert.equal(hostOf(first.dom).getAttribute('data-open'), 'false')

  const second = await mount({ store: { 'dsh-piggy:auto-collapse': 'false' } })
  openPanel(second.dom, 'settings')
  second.documentListeners.pointerdown[0]({ target: second.dom.document.createElement('div'), button: 0 })
  assert.equal(hostOf(second.dom).getAttribute('data-open'), 'true')
})

test('outside click waits during text input, pig dragging and hooked fishing', async () => {
  const { dom, documentListeners } = await mount()
  const outside = dom.document.createElement('div')
  const clickOutside = () => documentListeners.pointerdown[0]({ target: outside, button: 0 })
  openPanel(dom, 'dex')
  const input = dom.document.createElement('input')
  dom.document.activeElement = input
  clickOutside()
  assert.equal(hostOf(dom).getAttribute('data-open'), 'true')
  dom.document.activeElement = null
  sceneOf(dom).fire('pointerdown', { button: 0, clientX: 50, clientY: 50, pointerId: 1 })
  clickOutside()
  assert.equal(hostOf(dom).getAttribute('data-open'), 'true')

  const hooked = { id: 'f7', phase: 'hooked', key: 'fish_carp', label: '鲤鱼', emoji: '🐟', difficulty: 20 }
  const game = await mount({ status: { ...SNAPSHOT, fishing: { pending: hooked, bag: [], autoLeft: 2 } } })
  openPanel(game.dom, 'fishing')
  game.documentListeners.pointerdown[0]({ target: game.dom.document.createElement('div'), button: 0 })
  assert.equal(hostOf(game.dom).getAttribute('data-open'), 'true')
})

test('desktop window blur closes only when the setting is on', async () => {
  const shell = { beginDrag() {}, endDrag() {}, room: () => ({ above: 900, below: 100, width: 1920, height: 1040 }) }
  const first = await mount({ windowExtra: { __dshPiggyShell: shell } })
  openPanel(first.dom)
  assert.equal(typeof first.windowListeners.blur?.[0], 'function')
  first.windowListeners.blur[0]()
  assert.equal(hostOf(first.dom).getAttribute('data-open'), 'false')
  const second = await mount({ windowExtra: { __dshPiggyShell: shell }, store: { 'dsh-piggy:auto-collapse': 'false' } })
  openPanel(second.dom)
  second.windowListeners.blur[0]()
  assert.equal(hostOf(second.dom).getAttribute('data-open'), 'true')
})

test('tag release has no token-gated npm job and documents manual publishing', () => {
  const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')
  const guide = readFileSync(new URL('../docs/DEVELOPMENT.md', import.meta.url), 'utf8')
  assert.doesNotMatch(workflow, /^  npm:\s*$/m)
  assert.doesNotMatch(workflow, /NPM_TOKEN/)
  for (const step of ['npm publish --access public', 'npm view dsh-piggy version', 'dsh-plugin-piggy']) {
    assert.ok(guide.includes(step), `manual release guide missing ${step}`)
  }
})

test('all 54 character scenes share one visible height and visual center', () => {
  const entries = JSON.parse(readFileSync(new URL('../assets/pigs/manifest.json', import.meta.url), 'utf8'))
  const families = ['career-chef', 'career-astronaut', 'skin-detective', 'skin-angel', 'skin-pirate', 'skin-wizard']
  const scenes = ['', '-eat', '-bathe', '-play', '-pet', '-relaxed', '-work', '-study', '-trip']
  for (const family of families) for (const scene of scenes) {
    const path = PIG_ART_ASSETS[family + scene]
    const entry = entries.find(item => item.path === path)
    const [zoom, x, y] = BUILTIN_FRAMING[path]
    const [left, top, right, bottom] = entry.bounds
    assert.ok(Math.abs((bottom - top) / 256 * zoom - FRAME_HEIGHT) < .001, path)
    assert.ok(Math.abs(.5 + ((left + right) / 512 - .5) * zoom + x / 100 - .5) < .001, path)
    assert.ok(Math.abs(.5 + ((top + bottom) / 512 - .5) * zoom + y / 100 - .5) < .001, path)
  }
})
