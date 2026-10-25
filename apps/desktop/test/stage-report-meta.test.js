// @ts-check
/**
 * 舞台报告的元数据回归：页面报 dpr/CSS 视口，preload 只转发清洗过的数字，
 * 去重键必须带上 dpr+viewport（否则缩放/改窗口大小但猪矩形不变时会被吞掉）。
 * 不启 Electron：preload 用假 require 跑，bootstrap 用假 window/document/时钟跑。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'

const HERE = resolve(import.meta.dirname, '..')

/** @param {{platform?:string, argv?:string[]}} [options] */
function loadPreload(options = {}) {
  const sent = []
  const exposed = {}
  const context = {
    require: spec => {
      if (spec !== 'electron') throw new Error('unexpected require: ' + spec)
      return {
        contextBridge: { exposeInMainWorld: (name, api) => { exposed[name] = api } },
        ipcRenderer: {
          send: (channel, payload) => { sent.push({ channel, payload }) },
          sendSync: () => null,
          on: () => {},
          removeListener: () => {},
          invoke: async () => null,
        },
      }
    },
    process: { argv: options.argv ?? ['electron', 'stage'], platform: options.platform ?? 'win32' },
    Uint8Array, ArrayBuffer, String, Number, Array, Object, Math, JSON, Promise, Error,
  }
  vm.createContext(context)
  vm.runInContext(readFileSync(join(HERE, 'stage', 'preload.cjs'), 'utf8'), context, { filename: 'preload.cjs' })
  return { exposed, sent }
}

const rect = { x: 10, y: 20, width: 70, height: 80 }
/** vm 里的对象来自另一个 realm，deepStrictEqual 会拒绝不同原型；只比较数据。 */
const plain = value => JSON.parse(JSON.stringify(value))

test('preload forwards the page dpr and viewport, sanitized to finite rounded numbers', () => {
  const { exposed, sent } = loadPreload()
  exposed.stageShell.report({
    shape: [rect],
    visible: { pig: rect },
    dpr: 1.25,
    viewport: { width: 2559.6, height: 752.4 },
    interacting: true,
  })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].channel, 'stage:report')
  assert.equal(sent[0].payload.dpr, 1.25)
  assert.deepEqual(plain(sent[0].payload.viewport), { width: 2560, height: 752 })
  assert.deepEqual(plain(sent[0].payload.shape), [rect])
  assert.deepEqual(plain(sent[0].payload.visible), { pig: rect })
  assert.equal(sent[0].payload.interacting, true)
})

test('preload forwards bad/missing metadata as null instead of inventing a dpr', () => {
  const { exposed, sent } = loadPreload()
  for (const dpr of [Number.NaN, 0, 9, '1.25', null, undefined]) {
    exposed.stageShell.report({ shape: [], visible: null, dpr, viewport: { width: 1280, height: 800 } })
  }
  for (const viewport of [null, undefined, { width: '1280', height: 800 }, { width: 0, height: 800 }, { width: 1280, height: -1 }]) {
    exposed.stageShell.report({ shape: [], visible: null, dpr: 1, viewport })
  }
  assert.equal(sent.length, 11)
  for (let index = 0; index < 6; index += 1) {
    assert.equal(sent[index].payload.dpr, null, 'bad dpr is dropped')
    assert.deepEqual(plain(sent[index].payload.viewport), { width: 1280, height: 800 })
  }
  for (let index = 6; index < 11; index += 1) {
    assert.equal(sent[index].payload.dpr, 1)
    assert.equal(sent[index].payload.viewport, null, 'bad viewport is dropped')
  }
})

test('preload keeps the shape cap and ignores non-object reports', () => {
  const { exposed, sent } = loadPreload()
  exposed.stageShell.report({ shape: Array.from({ length: 100 }, () => rect), visible: null, dpr: 1, viewport: { width: 100, height: 100 } })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].payload.shape.length, 64)
  exposed.stageShell.report(null)
  exposed.stageShell.report(undefined)
  exposed.stageShell.report(42)
  assert.equal(sent.length, 1, 'only object reports reach the main process')
})

test('preload role/extKey stays as before and the existing shell API is still exposed', () => {
  const { exposed } = loadPreload({ argv: ['electron', '--piggy-role=ext', '--piggy-ext=farm'] })
  assert.equal(exposed.stageShell.role, 'ext')
  assert.equal(exposed.piggyShell.role, 'ext')
  assert.equal(exposed.piggyShell.extKey, 'farm')
  assert.equal(typeof exposed.stageShell.geometry, 'function')
  assert.equal(typeof exposed.stageShell.onGeometry, 'function')
})

/** 假时钟：bootstrap 的 rAF/定时器都走它，测试里不真等。 */
function fakeClock() {
  let time = 0
  let seq = 0
  /** @type {Map<number, {at:number,fn:Function,every:number}>} */
  const timers = new Map()
  const add = (fn, ms, every) => {
    const id = ++seq
    const delay = Math.max(0, Number(ms) || 0)
    timers.set(id, { at: time + delay, fn, every: every ? Math.max(1, delay) : 0 })
    return id
  }
  return {
    now: () => time,
    setTimeout: (fn, ms) => add(fn, ms, false),
    setInterval: (fn, ms) => add(fn, ms, true),
    clearTimeout: id => { timers.delete(id) },
    clearInterval: id => { timers.delete(id) },
    advance(ms) {
      const end = time + ms
      for (;;) {
        let next = null
        for (const [id, timer] of timers) {
          if (timer.at > end) continue
          if (next === null || timer.at < next.timer.at || (timer.at === next.timer.at && id < next.id)) next = { id, timer }
        }
        if (next === null) break
        time = next.timer.at
        if (next.timer.every) next.timer.at = time + next.timer.every
        else timers.delete(next.id)
        next.timer.fn()
      }
      time = end
    },
  }
}

const GLOBALS = ['window', 'document', 'getComputedStyle', 'MutationObserver', 'ResizeObserver',
  'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']

/** 装真实的 bootstrap.js，用假页面驱动一次 flush。 */
async function mountPage(label) {
  const clock = fakeClock()
  const reports = []
  const onWindow = new Map()
  const onDocument = new Map()
  const listen = map => ({
    add: (type, handler) => { const list = map.get(type) ?? []; list.push(handler); map.set(type, list) },
    remove: (type, handler) => { const list = map.get(type); if (list) { const i = list.indexOf(handler); if (i >= 0) list.splice(i, 1) } },
    fire: (type, event) => { for (const handler of [...(map.get(type) ?? [])]) handler({ type, ...event }) },
  })
  const windowEvents = listen(onWindow)
  const documentEvents = listen(onDocument)
  const body = { tagName: 'body' }
  const pig = {
    offsetLeft: 10, offsetTop: 20, offsetWidth: 54, offsetHeight: 54, offsetParent: null, closest: () => null,
    getBoundingClientRect: () => ({ left: 110, top: 70, right: 164, bottom: 124, width: 54, height: 54 }),
  }
  const host = {
    offsetLeft: 100, offsetTop: 50, offsetParent: body, closest: () => null, getAttribute: () => null,
    querySelector: selector => (selector === '.dp-pig' ? pig : null),
  }
  pig.offsetParent = host
  const doc = {
    body,
    head: { appendChild() {} },
    documentElement: { setAttribute() {} },
    hasFocus: () => true,
    addEventListener: documentEvents.add,
    removeEventListener: documentEvents.remove,
    createElement: () => ({ setAttribute() {}, textContent: '' }),
    querySelector: selector => (selector === '[data-dsh-pig]' ? host : null),
    querySelectorAll: () => [],
    visibilityState: 'visible',
  }
  const geometry = { window: { x: 0, y: 0, width: 1280, height: 800 }, workAreas: [], displays: [], interacting: false, seq: 1 }
  const win = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    stageShell: {
      role: 'stage',
      report: payload => { reports.push(payload) },
      setInteracting() {},
      geometry: () => geometry,
      askGeometry: () => geometry,
      onGeometry: () => () => {},
      onInteractionOff: () => () => {},
    },
    piggyShell: {},
    piggyGame: { mount: () => () => {} },
    piggyStage: { isFlying: () => false },
    addEventListener: windowEvents.add,
    removeEventListener: windowEvents.remove,
  }
  const saved = new Map(GLOBALS.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const savedNow = Object.getOwnPropertyDescriptor(Date, 'now')
  for (const [key, value] of Object.entries({
    window: win,
    document: doc,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', translate: '' }),
    MutationObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: fn => clock.setTimeout(() => fn(clock.now()), 16),
    cancelAnimationFrame: id => clock.clearTimeout(id),
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
  })) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  Object.defineProperty(Date, 'now', { value: () => clock.now(), configurable: true, writable: true })
  try {
    await import(pathToFileURL(join(HERE, 'stage', 'bootstrap.js')).href + '?case=' + encodeURIComponent(label))
    clock.advance(32)
  } catch (error) {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete (/** @type {any} */ (globalThis))[key]
    }
    Object.defineProperty(Date, 'now', savedNow)
    throw error
  }
  return {
    reports,
    win,
    advance: ms => clock.advance(ms),
    resize: () => windowEvents.fire('resize', {}),
    restore() {
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete (/** @type {any} */ (globalThis))[key]
      }
      Object.defineProperty(Date, 'now', savedNow)
    },
  }
}

test('bootstrap reports dpr + CSS viewport and dedups on dpr/viewport as well as the shape', async () => {
  const page = await mountPage('report-meta')
  try {
    assert.equal(page.reports.length, 1)
    const first = page.reports[0]
    assert.equal(first.dpr, 1)
    assert.deepEqual(first.viewport, { width: 1280, height: 800 })
    assert.ok(Array.isArray(first.shape) && first.shape.length > 0)
    assert.equal(first.interacting, false)

    // 猪的矩形不变，只改 dpr + 视口：必须再报一次。
    page.win.devicePixelRatio = 1.25
    page.win.innerWidth = 1024
    page.win.innerHeight = 640
    page.resize()
    page.advance(32)
    assert.equal(page.reports.length, 2, 'a dpr/viewport change is not suppressed by an unchanged pig rect')
    assert.equal(page.reports[1].dpr, 1.25)
    assert.deepEqual(page.reports[1].viewport, { width: 1024, height: 640 })
    assert.deepEqual(page.reports[1].shape, page.reports[0].shape)

    // 什么都没变：不重复报。
    page.resize()
    page.advance(32)
    assert.equal(page.reports.length, 2)

    // 只改视口宽度也要报（窗口/缩放会改 innerWidth）。
    page.win.innerWidth = 1000
    page.resize()
    page.advance(32)
    assert.equal(page.reports.length, 3)
    assert.deepEqual(page.reports[2].viewport, { width: 1000, height: 640 })
  } finally {
    page.restore()
  }
})
