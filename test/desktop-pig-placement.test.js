import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

import { DESKTOP_VERSION } from '../src/client/desktop/index.js'
import { createPetController } from '../src/client/desktop/pet-controller.js'
import { createPlacement, pigScreenKey } from '../src/client/desktop/place.js'

const memory = new Map()
globalThis.localStorage = {
  getItem: key => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)) },
  removeItem: key => { memory.delete(key) },
}

const LEGACY_KEY = 'dsh-piggy:desktop-pig'
const AREA = [{ x: 0, y: 29, width: 1920, height: 985 }]
const PIG = { width: 54, height: 54 }
const report = (w, h, at, over = {}) => ({ width: w, height: h, pig: PIG, pigWindow: at, pigNow: at, panelOpen: false, ...over })
const foot = (win, at, size = PIG) => ({ x: win.x + at.x + size.width / 2, y: win.y + at.y + size.height })
const placeAt = (placement, win, pig) => placement.rehome(win, { ...pig, width: PIG.width, height: PIG.height }, AREA)

test('DESKTOP_VERSION is 7 for the pig-placement protocol', () => {
  assert.equal(DESKTOP_VERSION, 7)
})

test('two pigIds keep separate position keys and never overwrite each other', () => {
  memory.clear()
  const main = createPlacement({ pigId: 'pig-main', primary: true })
  const friend = createPlacement({ pigId: 'pig-friend', primary: false })
  const mainKey = pigScreenKey('pig-main')
  const friendKey = pigScreenKey('pig-friend')

  placeAt(main, { x: 1100, y: 600 }, { x: 10, y: 20 })
  placeAt(friend, { x: 300, y: 200 }, { x: 40, y: 30 })

  assert.deepEqual(JSON.parse(memory.get(mainKey)), { v: 3, area: AREA[0], x: 1137, y: 645 })
  assert.deepEqual(JSON.parse(memory.get(friendKey)), { v: 3, area: AREA[0], x: 367, y: 255 })
  assert.equal(memory.get(LEGACY_KEY), memory.get(mainKey), 'primary mirrors its scoped home to the legacy stage key')
  assert.notEqual(memory.get(friendKey), memory.get(mainKey), 'a second pig cannot write the primary home')

  // Restart each window: own scoped key wins and the homes stay different.
  const mainAgain = createPlacement({ pigId: 'pig-main', primary: true })
  const friendAgain = createPlacement({ pigId: 'pig-friend', primary: false })
  mainAgain.decide(report(304, 204, { x: 228, y: 120 }), { x: 100, y: 100, width: 304, height: 204 }, AREA)
  friendAgain.decide(report(304, 204, { x: 228, y: 120 }), { x: 100, y: 100, width: 304, height: 204 }, AREA)
  assert.deepEqual(mainAgain.home(), { x: 1137, y: 674 })
  assert.deepEqual(friendAgain.home(), { x: 367, y: 284 })
})

test('primary migrates the legacy home into its scoped key on first launch', () => {
  memory.clear()
  const legacy = JSON.stringify({ v: 3, area: AREA[0], x: 1055, y: 645 })
  memory.set(LEGACY_KEY, legacy)
  const main = createPlacement({ pigId: 'pig-main', primary: true })

  main.decide(report(304, 204, { x: 228, y: 120 }), { x: 100, y: 100, width: 304, height: 204 }, AREA)
  assert.deepEqual(main.home(), { x: 1055, y: 674 }, 'the first launch starts from the old single-pig home')
  assert.equal(memory.has(pigScreenKey('pig-main')), false, 'reading alone does not create the scoped key')

  main.persist(AREA)
  assert.deepEqual(JSON.parse(memory.get(pigScreenKey('pig-main'))), { v: 3, area: AREA[0], x: 1055, y: 645 })
  assert.equal(memory.get(LEGACY_KEY), legacy, 'the stage-compatible legacy key keeps the same home')
})

test('a non-primary pig neither reads nor writes the legacy key', () => {
  memory.clear()
  const legacy = JSON.stringify({ v: 3, area: AREA[0], x: 1055, y: 645 })
  memory.set(LEGACY_KEY, legacy)
  const win = { x: 100, y: 100, width: 304, height: 204 }
  const at = { x: 228, y: 120 }
  const friend = createPlacement({ pigId: 'pig-friend', primary: false })

  friend.decide(report(304, 204, at), win, AREA)
  assert.deepEqual(friend.home(), foot(win, at), 'no legacy home was adopted')
  friend.persist(AREA)
  assert.equal(memory.get(LEGACY_KEY), legacy, 'legacy key is untouched')
  assert.deepEqual(JSON.parse(memory.get(pigScreenKey('pig-friend'))), { v: 3, area: AREA[0], x: 355, y: 245 })
})

test('no pigId keeps the legacy single-pig key (old shells and the web page)', () => {
  memory.clear()
  const single = createPlacement()
  placeAt(single, { x: 500, y: 400 }, { x: 20, y: 30 })
  assert.equal(memory.size, 1)
  assert.ok(memory.has(LEGACY_KEY))
  assert.equal(pigScreenKey(null), null)
  assert.equal(pigScreenKey(''), null)
  assert.equal(pigScreenKey('bad id!'), null)
  assert.equal(pigScreenKey('a'.repeat(129)), null)
})

function loadPreload(args) {
  const source = readFileSync(new URL('../apps/desktop/preload.cjs', import.meta.url), 'utf8')
  let exposed = null
  const electron = {
    contextBridge: { exposeInMainWorld: (name, value) => { exposed = { name, value } } },
    ipcRenderer: { on() {}, send() {}, sendSync() {}, invoke() {} },
  }
  const run = new Function('require', 'process', 'document', 'window', source)
  run(name => (name === 'electron' ? electron : {}), { argv: args, platform: 'linux' }, undefined, undefined)
  return exposed
}

test('preload parses pig id, primary flag and multiPig from additionalArguments', () => {
  const main = loadPreload(['electron', '--piggy-role=pet', '--piggy-pig=pig-main', '--piggy-primary=1'])
  assert.equal(main.name, 'piggyShell')
  assert.equal(main.value.pigId, 'pig-main')
  assert.equal(main.value.primary, true)
  assert.equal(main.value.multiPig, true)
  assert.equal(typeof main.value.ownerPigs.list, 'function', 'existing ownerPigs channel is preserved')
  assert.equal(typeof main.value.ownerArchives.status, 'function', 'existing ownerArchives channel is preserved')
  assert.equal(typeof main.value.cloudSave.get, 'function', 'existing cloudSave channel is preserved')

  const friend = loadPreload(['electron', '--piggy-role=pet', '--piggy-pig=pig-friend'])
  assert.equal(friend.value.pigId, 'pig-friend')
  assert.equal(friend.value.primary, false)
  assert.equal(friend.value.multiPig, true)

  const oldShell = loadPreload(['electron', '--piggy-role=pet'])
  assert.equal(oldShell.value.pigId, null)
  assert.equal(oldShell.value.primary, false)
  assert.equal(Object.hasOwn(oldShell.value, 'multiPig'), false, 'old shells must not see multiPig')
})

test('preload rejects an illegal or missing pig id and never exposes multiPig for it', () => {
  for (const bad of ['.pig', 'bad id', 'a'.repeat(129), '']) {
    const shell = loadPreload(['electron', `--piggy-pig=${bad}`, '--piggy-primary=1'])
    assert.equal(shell.value.pigId, null, `rejected: ${JSON.stringify(bad)}`)
    assert.equal(shell.value.primary, false)
    assert.equal(Object.hasOwn(shell.value, 'multiPig'), false)
  }
})

function eventTarget() {
  return { addEventListener() {}, removeEventListener() {} }
}

test('pet adapter exposes the window identity only when pigId is valid', () => {
  const shell = {
    platform: 'linux',
    panel: { toggle() {}, on() {}, onFx() {}, raisePet() {} },
    geometry: () => null,
    onGeometry() {},
    onDragSlide() {},
    askGeometry() {},
    setHit() {},
    place() {},
  }
  const doc = { ...eventTarget(), documentElement: eventTarget() }
  const win = { ...eventTarget(), __dshPiggyShell: null, requestAnimationFrame: () => 1 }
  const controller = createPetController({
    shell, documentObject: doc, windowObject: win, getHost: () => null, pigId: 'pig-main', primary: true,
  })
  controller.install()
  assert.equal(win.__dshPiggyShell.pigId, 'pig-main')
  assert.equal(win.__dshPiggyShell.primary, true)
  assert.equal(win.__dshPiggyShell.multiPig, true)

  const singleWin = { ...eventTarget(), __dshPiggyShell: null, requestAnimationFrame: () => 1 }
  const single = createPetController({
    shell, documentObject: doc, windowObject: singleWin, getHost: () => null, pigId: null, primary: false,
  })
  single.install()
  assert.equal(singleWin.__dshPiggyShell.pigId, null)
  assert.equal(singleWin.__dshPiggyShell.primary, false)
  assert.equal(Object.hasOwn(singleWin.__dshPiggyShell, 'multiPig'), false)
})
