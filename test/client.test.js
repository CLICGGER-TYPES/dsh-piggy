/**
 * dsh-piggy client tests — run the browser bundle in a faked DOM.
 *
 * The client half is a plain script that self-registers through
 * `window.__ModuleLoader__`, so it can be loaded and exercised in Node with a
 * minimal DOM stub. This covers what would otherwise only show up in a real
 * browser: the pig not moving, the six icons doing nothing, an empty shop, or a
 * screen full of `undefined` after a host/client version mismatch.
 *
 * Run: node --test test/*.test.js
 */

import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

/**
 * The authored client source, as written.
 *
 * Static assertions (CSS shape, guards) read this; the behaviour tests below
 * load the built bundle instead, so they exercise exactly what DSH ships.
 * Stage 2 of docs/archive/REFACTOR-PLAN.md split the client into modules, so this joins
 * them back into the one text those assertions used to see.
 */
async function readSource() {
  const dir = new URL('../src/client/', import.meta.url)
  const names = readdirSync(dir).filter(name => name.endsWith('.js')).sort()
  const parts = await Promise.all(names.map(name => readFile(new URL(name, dir), 'utf8')))
  return parts.join('\n')
}

/**
 * The stylesheet the browser actually receives.
 *
 * The styles are assembled from many concatenated string literals across the
 * CSS modules, so a regex run against one file can only ever see a fragment — a
 * rule split across two literals looks absent even when it is there. Joining
 * the literals back together first is what makes these static assertions mean
 * something.
 */
/** One authored client module, for assertions about a specific tab. */
const readModule = name => readFile(new URL('../src/client/' + name, import.meta.url), 'utf8')

async function readCss() {
  const dir = new URL('../src/client/', import.meta.url)
  const modules = ['css-base.js', 'css-tabs.js', 'css-tiles.js', 'css-card.js']
  const sources = await Promise.all(modules.map(name => readFile(new URL(name, dir), 'utf8')))
  let css = ''
  for (const source of sources) {
    const start = source.indexOf('export const CSS_')
    const end = source.indexOf("].join('')", start)
    assert.ok(start >= 0 && end > start, 'could not locate the CSS array')
    const body = source.slice(start, end)
    // Two shapes of literal: one that begins a line, and one appended to a
    // previous literal with `+`. The cursor data-URI is split across seven of the
    // latter, so matching only line-anchored literals silently truncated the sheet
    // and made the brace-balance check below meaningless.
    // Anchoring matters: a plain quoted-string scan is fooled by apostrophes
    // inside comments ("the UA sheet's ...").
    css += [...body.matchAll(/(?:^[ \t]*|\+[ \t]*)'((?:[^'\\]|\\.)*)'/gm)]
      .map(match => match[1])
      .join('')
  }
  return css
}

/** The smallest DOM that satisfies the bundle. */
function fakeDom() {
  /** A zero-sized box; tests that care set `element.rect` explicitly. */
  const emptyRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 })

  class FakeElement {
    constructor(tagName) {
      this.tagName = tagName
      this.children = []
      this.style = { setProperty() {}, removeProperty() {} }
      this.attributes = {}
      this.className = ''
      this._text = ''
      // Browsers keep a scroll offset per element and drop it when the element
      // is emptied. The fake DOM has to do the same, or "the panel scrolled back
      // to the top" is invisible to these tests.
      this.scrollTop = 0
      this.disabled = false
      this.hidden = false
      this.type = ''
      this.parentNode = null
      this.listeners = {}
      this.rect = emptyRect()
    }

    // The bundle measures the scene to keep itself on screen, so a DOM without
    // geometry makes mount() throw — and apply() swallows that, which shows up
    // as "the pig is simply not there".
    get textContent() { return this._text }
    set textContent(value) {
      this._text = String(value)
      // A real element replaces its child nodes when textContent is assigned —
      // including the `= ''` every repaint starts with. Without this the fake
      // DOM accumulated every previous render and stale nodes stayed findable.
      for (const child of this.children) child.parentNode = null
      this.children = []
      if (this._text === '') this.scrollTop = 0
    }

    getBoundingClientRect() { return this.rect }

    appendChild(child) {
      child.parentNode = this
      this.children.push(child)
      return child
    }

    setAttribute(name, value) { this.attributes[name] = String(value) }
    getAttribute(name) { return this.attributes[name] ?? null }
    removeAttribute(name) { delete this.attributes[name] }
    insertBefore(child) { return this.appendChild(child) }
    remove() {
      if (this.parentNode !== null) {
        const index = this.parentNode.children.indexOf(this)
        if (index >= 0) this.parentNode.children.splice(index, 1)
        this.parentNode = null
      }
    }

    addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn) }
    setPointerCapture() {}
    querySelector() { return null }

    /** Fire a listener with `this` bound like a real DOM. */
    fire(name, event = {}) {
      for (const fn of this.listeners[name] ?? []) {
        fn.call(this, { stopPropagation() {}, preventDefault() {}, ...event })
      }
    }

    allText() {
      return [this.textContent, ...this.children.map(c => c.allText())].join(' ')
    }

    walk(visit) {
      visit(this)
      for (const child of this.children) child.walk(visit)
    }
  }

  const head = new FakeElement('head')
  const body = new FakeElement('body')
  const document = {
    head,
    body,
    createElement(tag) { return new FakeElement(tag) },
    querySelector() { return null },
    addEventListener() {},
    removeEventListener() {},
  }
  return { document, head, body, FakeElement }
}

function fakeNet(status, actResult, latestRelease) {
  const calls = []
  const fetch = async (url, options) => {
    const method = options?.method ?? 'GET'
    calls.push({ url, method, body: options?.body })
    const payload = String(url).startsWith('https://api.github.com/')
      ? latestRelease
      : method === 'POST' ? (actResult ?? status) : status
    return { ok: true, status: 200, async json() { return payload } }
  }
  return { fetch, calls }
}

async function loadClient(options) {
  const { status = SNAPSHOT, actResult = null, latestRelease = null } = options ?? {}
  const dom = fakeDom()
  const net = fakeNet(status, actResult, latestRelease)
  const store = new Map()

  const windowListeners = {}
  globalThis.window = {
    __ModuleLoader__: { load: () => {} },
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)) },
    },
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    // Geometry, so the on-screen clamp is exercised instead of skipped.
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: (name, fn) => { (windowListeners[name] ??= []).push(fn) },
    removeEventListener: (name, fn) => {
      const list = windowListeners[name]
      if (list) windowListeners[name] = list.filter(entry => entry !== fn)
    },
  }
  // Extra window globals, e.g. the desktop app's bridge.
  Object.assign(globalThis.window, options?.windowExtra ?? {})
  const resize = () => { for (const fn of windowListeners.resize ?? []) fn() }
  globalThis.document = dom.document
  globalThis.fetch = net.fetch
  // Read the real inline style back. A constant stub makes every drag start from
  // the same fictional origin, which quietly invalidates drag assertions.
  globalThis.getComputedStyle = element => ({
    right: element?.style?.right || '18px',
    bottom: element?.style?.bottom || '18px',
  })

  let registration = null
  globalThis.window.__ModuleLoader__ = { load: entry => { registration = entry } }

  const url = new URL('../client.js', import.meta.url)
  url.searchParams.set('t', String(Math.random()))
  await import(url.href)

  return { dom, net, registration, store, resize, windowListeners }
}

const hostOf = dom => {
  const found = []
  dom.body.walk(node => { if (node.attributes?.['data-dsh-pig'] !== undefined) found.push(node) })
  return found[0]
}
// The pig is a sibling of the panel, not a child of it: host = [panel, scene].
const cardOf = dom => hostOf(dom).children[0]
const sceneOf = dom => hostOf(dom).children[1]
// Inside the panel, content sits above the icon bar.
const contentOf = dom => cardOf(dom).children[0]
const barOf = dom => findByClass(cardOf(dom), 'dp-bar')

const findByAttr = (root, attr, value) => {
  const found = []
  root.walk(node => { if (node.attributes?.[attr] === value) found.push(node) })
  return found[0]
}
/** A job is a tile; its 出发 button lives in the fixed footer. */
const sendJob = (dom, key) => {
  tap(dom, 'data-job-tile', key)
  findByAttr(cardOf(dom), 'data-job', key).fire('click')
}

/** Tap a tile (or any element) in the panel body by one of its data attributes. */
const tap = (dom, attr, value) => {
  const node = findByAttr(contentOf(dom), attr, value)
  assert.notEqual(node, undefined, `nothing with ${attr}="${value}" in: ${contentOf(dom).allText()}`)
  node.fire('click')
}
const findByClass = (root, className) => {
  const found = []
  root.walk(node => {
    if (typeof node.className === 'string' && node.className.split(/\s+/).includes(className)) found.push(node)
  })
  return found[0]
}

const settle = () => new Promise(resolve => setImmediate(resolve))

/** Open the panel by tapping the pig. */
function openPanel(dom, app = 'status') {
  // The menu lives on the context menu; a left click only pats the pig.
  sceneOf(dom).fire('contextmenu', { preventDefault() {} })
  // B9: the panel opens on the home screen. Most tests are about one app, so
  // they land in it the way a user would: tap its tile.
  if (app !== 'home' && contentOf(dom) !== undefined) {
    const tile = findByAttr(contentOf(dom), 'data-app', app)
    if (tile !== undefined) tile.fire('click')
  }
}

/** Left-click the pig (a pat, not the menu). */
function patPig(dom) {
  sceneOf(dom).fire('pointerdown', { button: 0, clientX: 0, clientY: 0 })
  sceneOf(dom).fire('pointerup', {})
}

/** Switch to one of the six icons. */
function pickTab(dom, key) {
  findByAttr(barOf(dom), 'data-tab', key).fire('click')
}

const ACTIONS = {
  feed: { ready: true, waitSeconds: 0, blocked: null },
  bathe: { ready: true, waitSeconds: 0, blocked: null },
  play: { ready: false, waitSeconds: 37, blocked: null },
  pet: { ready: true, waitSeconds: 0, blocked: null },
}

const JOBS = [
  { key: 'odd', label: '打零工', emoji: '🧹', minutes: 1, coins: 12, available: true },
  { key: 'site', label: '搬砖', emoji: '🧱', minutes: 3, coins: 42, available: true },
]

const SUBJECTS = [
  { key: 'chinese', label: '语文', emoji: '📖', traitLabel: '智力', level: 3, levels: { primary: 2, college: 1, middle: 1 }, stages: ['primary', 'middle'], available: true },
  { key: 'art', label: '美术', emoji: '🖌', traitLabel: '魅力', level: 1, levels: { primary: 1 }, stages: ['primary'], available: true },
  { key: 'pe', label: '体育', emoji: '🏃', traitLabel: '武力', level: 1, levels: { primary: 1 }, stages: ['primary'], available: true },
  { key: 'philosophy', label: '哲学', emoji: '📜', traitLabel: '智力', level: 0, levels: { college: 0 }, stages: ['college', 'graduate'], available: true },
]

const STAGES = [
  { key: 'preschool', label: '幼儿园', emoji: '🧸', minutes: 15, tuition: 20, gain: 1, subjects: ['sing', 'doodle', 'literacy'], unlocked: true, progress: null },
  { key: 'extracurricular', label: '课外', emoji: '🎨', minutes: 20, tuition: 30, gain: 1, subjects: ['football', 'piano', 'painting', 'go'], unlocked: false,
    progress: { done: 1, need: 3, label: '幼儿园 3 门课各上一次' } },
  { key: 'primary', label: '小学', emoji: '📚', minutes: 40, tuition: 60, gain: 1, subjects: ['chinese', 'mathematics', 'english', 'science', 'pe', 'art'], unlocked: true, progress: null },
  { key: 'college', label: '大学', emoji: '🏛', minutes: 240, tuition: 700, gain: 4, subjects: ['english', 'philosophy', 'engineering'], unlocked: true, progress: null },
]

const TRIPS = [
  { key: 'suburb', label: '郊游', emoji: '🏞', minutes: 3, cost: 15, affordable: true, available: true },
  { key: 'abroad', label: '出国', emoji: '🌍', minutes: 40, cost: 400, affordable: false, available: true },
]

const SHOP = [
  { key: 'apple', label: '苹果', emoji: '🍎', price: 6, kind: 'food', tier: null, affordable: true, needed: false },
  { key: 'med1', label: '普通药', emoji: '💊', price: 12, kind: 'medicine', tier: 1, affordable: true, needed: true },
  { key: 'soul', label: '还魂丹', emoji: '✨', price: 150, kind: 'revive', tier: null, affordable: false, needed: false },
]

const PIG = {
  name: '大花',
  stage: { key: 'middle', label: '中年猪', emoji: '🐖', size: 62, line: '很有分量' },
  ageLabel: '4 天大', daysToNextStage: 3, soul: false,
  mood: 'happy', moodEmoji: '❤️', moodLabel: '很开心',
  satiety: 62, happiness: 74, cleanliness: 41,
  health: 4, healthPercent: 80,
  weight: '8.4 kg', xp: 168, xpToNext: 232, coins: 88,
  traits: { intel: 5, charm: 3, strong: 2 },
  courses: { chinese: 2 }, souvenirs: ['贝壳', '松果'],
  illness: null, stageLine: '圆滚滚的，走路会晃',
  memories: ['[16:53] 长成了「圆滚猪」🐖'],
}

const SNAPSHOT = {
  ok: true, hatched: true, dead: false, pig: PIG,
  actions: ACTIONS, jobs: JOBS, subjects: SUBJECTS, stages: STAGES, trips: TRIPS,
  shop: SHOP, inventory: { apple: 2, med1: 0, soul: 0 },
  activity: null, canGoOut: true, awayBlocked: null, pending: [],
  reviveItem: 'soul', maxHealth: 5,
  daily: { canSignIn: false, signInDay: 1, signInTotal: 0, cycle: 12, unclaimed: 0, onlineMinutes: 0 },
  diary: [],
}

// ===========================================================================
// Registration, mounting, the collapsed form
// ===========================================================================

test('client bundle registers itself under the package id', async () => {
  const { registration } = await loadClient()
  assert.equal(registration.id, 'dsh-piggy')
  assert.equal(typeof registration.factory, 'function')
})

test('client exports name and apply in the shape DSH expects', async () => {
  const { registration } = await loadClient()
  const exports = registration.factory(() => {})
  assert.equal(exports.name, 'dsh-piggy')
  assert.equal(typeof exports.apply, 'function')
})

test('apply mounts a floating pig and returns a disposer', async () => {
  const { registration, dom } = await loadClient()
  const dispose = registration.factory(() => {}).apply({})
  assert.equal(typeof dispose, 'function')
  assert.equal(cardOf(dom).className, 'dp-card')
  await settle()
  assert.ok(hostOf(dom).allText().includes('🐖'))
})

test('the pig carries an animation and a mood the CSS keys off', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  assert.notEqual(findByAttr(hostOf(dom), 'data-mood', 'happy'), undefined)
})

test('there is no decorative background on the scene', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  assert.equal(findByClass(hostOf(dom), 'dp-cloud'), undefined)
  assert.equal(findByClass(hostOf(dom), 'dp-grass'), undefined)
})

test('the pig starts collapsed and tapping it opens the panel', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  assert.equal(hostOf(dom).attributes['data-open'], 'false')
  openPanel(dom)
  assert.equal(hostOf(dom).attributes['data-open'], 'true')
  openPanel(dom)
  assert.equal(hostOf(dom).attributes['data-open'], 'false')
})

/**
 * Regression: collapsing used to only strip the card's background, leaving the
 * six icons, the content area and the hud all floating on a transparent card.
 * Collapsed must be the pig and nothing else.
 */
test('collapsing hides the whole panel and leaves only the pig', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()

  const card = cardOf(dom)
  assert.equal(hostOf(dom).attributes['data-open'], 'false')
  assert.equal(card.hidden, true, 'the panel must be hidden while collapsed')

  openPanel(dom)
  assert.equal(card.hidden, false, 'the panel returns when opened')

  openPanel(dom)
  assert.equal(card.hidden, true, 'and goes away again')
})

test('the collapsed widget contains the pig and nothing else', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()

  // Treat `hidden` as display:none so "visible text" means something.
  const visibleText = node => (node.hidden ? '' : [node.textContent, ...node.children.map(visibleText)].join(' '))
  const text = visibleText(hostOf(dom))
  const pigImage = findByClass(hostOf(dom), 'dp-pig-img')
  assert.ok((pigImage && !pigImage.hidden && pigImage.src) || text.includes('🐖'), `the pig should still show: ${text}`)
  assert.ok(!text.includes('状态'), `the icons should be gone: ${text}`)
  assert.ok(!text.includes('大花'), `the hud should be gone: ${text}`)
  assert.ok(!text.includes('🪙'), `no coin readout while collapsed: ${text}`)

  openPanel(dom)
  const openText = visibleText(hostOf(dom))
  assert.ok(openText.includes('状态'), `the icons return when opened: ${openText}`)
  assert.ok(openText.includes('大花'), `the hud returns when opened: ${openText}`)
})

test('the pig is a sibling of the panel, so opening cannot move it', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  const host = hostOf(dom)
  // host = [panel, scene]; the pig is NOT inside the panel.
  assert.equal(host.children.length, 2)
  assert.equal(host.children[0].className, 'dp-card')
  assert.equal(host.children[1].className, 'dp-scene')
  assert.equal(findByClass(host.children[0], 'dp-pig'), undefined, 'the pig must not live inside the panel')
  assert.notEqual(findByClass(host.children[1], 'dp-pig'), undefined, 'the pig lives in the scene')
})

/**
 * Regression, and a lesson about what a test can prove.
 *
 * A fake DOM has no CSS engine, so `bar.hidden = true` looked correct in every
 * assertion above while the real browser kept painting the icon bar: `.dp-bar`
 * sets `display:grid`, which ties on specificity with the UA sheet's
 * `[hidden]{display:none}` and wins by source order. `hidden` is therefore only
 * as good as the CSS behind it, and that has to be checked statically.
 */
test('the composed stylesheet is balanced and complete', async () => {
  const css = await readCss()
  let depth = 0
  for (const ch of css) {
    if (ch === '{') depth += 1
    else if (ch === '}') depth -= 1
    assert.ok(depth >= 0, 'the sheet closes a block it never opened')
  }
  assert.equal(depth, 0, `the sheet is unbalanced by ${depth} — a rule is swallowing the rest`)

  // A truncated data-URI is exactly how the sheet went unbalanced before.
  const cursor = css.slice(css.indexOf('.dp-pig{cursor:var(--pat-cursor, url('))
  const uri = cursor.slice(0, cursor.indexOf("')"))
  assert.ok(uri.includes('</svg>'), 'the petting-hand fallback cursor data-URI must be complete')
  assert.ok(css.indexOf('.dp-pig{cursor:var(--pat-cursor, url(') >= 0, 'the 👋 cursor drawn at runtime overrides the fallback')
  assert.ok(css.includes('.dp-pig-img{'), 'the sprite sizing rule survived')
})

test('classes the bundle hides carry a CSS rule that beats their own display', async () => {
  const css = await readCss()
  const source = await readSource()

  // Derived from the source, NOT a hand-kept list. The previous version spelled
  // the class names out, so when .dp-work started being hidden the array was
  // never updated and the test stayed green while the work prop hung beside an
  // idle pig.
  const classes = new Map()
  for (const m of source.matchAll(/var (\w+) = el\('[a-z]+', '([A-Za-z0-9_-]+)/g)) classes.set(m[1], m[2])
  for (const m of source.matchAll(/var (\w+) = document\.createElement\('[a-z]+'\)\s*\n\s*\1\.className = '([A-Za-z0-9_-]+)'/g)) {
    classes.set(m[1], m[2])
  }

  const hiddenVars = [...new Set([...source.matchAll(/(\w+)\.hidden\s*=/g)].map(m => m[1]))]
  const resolved = hiddenVars.map(name => classes.get(name)).filter(Boolean)
  assert.ok(resolved.length >= 5, `expected to resolve several hidden elements, got ${resolved.join(', ')}`)

  for (const cls of resolved) {
    assert.ok(
      css.includes(`.${cls}[hidden]`),
      `.${cls} is hidden by JS but no CSS rule hides it — the element will keep rendering`,
    )
  }
})

test('the open panel shows the live host state', async () => {
  const { registration, dom, net } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  assert.equal(net.calls[0].url, '/dsh-piggy/state')
  openPanel(dom)
  const text = hostOf(dom).allText()
  assert.ok(text.includes('大花'), text)
  assert.ok(text.includes('圆滚猪'), text)
  assert.ok(text.includes('88'), `expected coins, got: ${text}`)
  assert.ok(text.includes('4/5'), `expected health, got: ${text}`)
})

// ===========================================================================
// THE regression: a legacy host must not paint `undefined`
// ===========================================================================

test('a legacy host payload renders defaults, never "undefined"', async () => {
  // Exactly what the old host returned before coins/health/jobs/shop existed.
  const legacy = {
    ok: true,
    pig: {
      name: '猪猪',
      stage: { key: 'middle', label: '中年猪', emoji: '🐖', size: 62 },
      ageLabel: '4 天大',
      mood: 'happy', moodEmoji: '❤️', moodLabel: '很开心',
      satiety: 100, happiness: 76, weight: '2.2 kg', xp: 295, xpToNext: 105,
      canFeed: true, feedWaitSeconds: 0, stageLine: '圆滚滚的，走路会晃',
      memories: ['[17:59] 从蛋壳里钻出来了 🐣'],
    },
  }
  const { registration, dom } = await loadClient({ status: legacy })
  registration.factory(() => {}).apply({})
  await settle()

  const collapsed = hostOf(dom).allText()
  assert.ok(!collapsed.includes('undefined'), `collapsed shows undefined: ${collapsed}`)
  assert.ok(!collapsed.includes('NaN'), `collapsed shows NaN: ${collapsed}`)
  assert.ok(collapsed.includes('🪙 0'), `coins should default to 0, got: ${collapsed}`)

  openPanel(dom)
  for (const tab of ['status', 'study', 'work', 'shop', 'travel', 'bag']) {
    pickTab(dom, tab)
    const text = hostOf(dom).allText()
    assert.ok(!text.includes('undefined'), `tab ${tab} shows undefined: ${text}`)
    assert.ok(!text.includes('NaN'), `tab ${tab} shows NaN: ${text}`)
  }
})

test('a legacy host is called out instead of silently showing gaps', async () => {
  const { registration, dom } = await loadClient({
    status: { ok: true, pig: { name: '猪猪', stage: { key: 'piglet', label: '小猪', emoji: '🐖', size: 40 }, ageLabel: '今天刚出生', mood: 'fine', satiety: 50, happiness: 50, weight: '1.5 kg', xp: 40 } },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  const text = hostOf(dom).allText()
  assert.ok(text.includes('宿主是旧版本'), text)
  assert.ok(text.includes('重启 dsh'), text)
})

test('a truncated payload still renders without throwing', async () => {
  const { registration, dom } = await loadClient({
    status: { ok: true, pig: { name: '猪猪' }, actions: null, jobs: 'nope', shop: 42, inventory: null, pending: null },
  })
  assert.doesNotThrow(() => registration.factory(() => {}).apply({}))
  await settle()
  openPanel(dom)
  for (const tab of ['status', 'study', 'work', 'shop', 'travel', 'bag']) {
    pickTab(dom, tab)
    assert.ok(!hostOf(dom).allText().includes('undefined'), `tab ${tab} broke`)
  }
})

// ===========================================================================
// The six-icon bar
// ===========================================================================

test('the panel opens on a home screen of app tiles, and the icon bar is gone (B9)', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom, 'home')

  const labelOf = key => {
    const appTile = findByAttr(contentOf(dom), 'data-app', key)
    return findByClass(appTile, 'dp-tile-e').allText() + ' ' + findByClass(appTile, 'dp-tile-n').allText()
  }
  assert.deepEqual(
    ['status', 'card', 'dex', 'study', 'work', 'shop', 'travel', 'bag'].map(labelOf),
    ['📋 状态', '🪪 居民卡', '📖 图鉴', '📚 学习', '💼 打工', '🛒 商店', '🧳 旅行', '🎒 背包'],
  )
  const css = await readCss()
  assert.match(css, /\.dp-card \.dp-bar\{display:none\}/, 'the old icon bar is not shown')

  // An app has a 「‹」 back to the home screen.
  tap(dom, 'data-app', 'shop')
  assert.equal(findByAttr(contentOf(dom), 'data-app', 'shop'), undefined, 'inside the shop now')
  tap(dom, 'data-home', 'true')
  assert.notEqual(findByAttr(contentOf(dom), 'data-app', 'shop'), undefined, 'and back home')
})

test('clicking an icon marks it active and switches the content', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)

  pickTab(dom, 'work')
  assert.equal(findByAttr(barOf(dom), 'data-tab', 'work').attributes['data-active'], 'true')
  assert.equal(findByAttr(barOf(dom), 'data-tab', 'status').attributes['data-active'], 'false')
  assert.ok(contentOf(dom).allText().includes('打零工'), contentOf(dom).allText())
})

test('the shop icon flags itself when the pig is sick', async () => {
  const { registration, dom } = await loadClient({
    status: { ...SNAPSHOT, pig: { ...PIG, illness: { name: '感冒', cure: '板蓝根', stage: 1 } } },
  })
  registration.factory(() => {}).apply({})
  await settle()
  assert.equal(findByAttr(barOf(dom), 'data-tab', 'shop').attributes['data-alert'], 'true')
})

test('disposing takes the dev console handle with it', async () => {
  // #11: dispose() removed the pig but left the console handle behind, so a
  // reload could toggle a pig that no longer exists. C1 dropped the Ctrl+Shift+D
  // shortcut entirely — dev mode is unlocked by tapping the version line.
  const { registration, windowListeners } = await loadClient()
  const dispose = registration.factory(() => {}).apply({})
  await settle()
  assert.deepEqual(windowListeners.keydown ?? [], [], 'there is no dev shortcut any more')
  assert.equal(typeof window.dshPigDev?.off, 'function', 'the console keeps only the off switch')
  assert.equal(window.dshPigDev.on, undefined)

  dispose()
  assert.equal(window.dshPigDev, undefined, 'and the console handle must go')
})

test('a slow poll cannot overwrite the result of an action', async () => {
  // The panel polls every 4s. A poll that left before an action but landed
  // after it used to paint stale state back over the action's result.
  const acted = { ...SNAPSHOT, pig: { ...PIG, name: '动作后' } }
  const { registration, dom } = await loadClient({ actResult: acted })

  let poll = null
  const realSetInterval = globalThis.window.setInterval
  globalThis.window.setInterval = fn => { poll = fn; return 1 }
  try {
    registration.factory(() => {}).apply({})
    await settle()
    openPanel(dom)
    assert.ok(hostOf(dom).allText().includes('大花'), 'the first render is the polled state')

    // A poll starts and hangs; an action lands meanwhile.
    let release
    const gate = new Promise(resolve => { release = resolve })
    const realFetch = globalThis.fetch
    globalThis.fetch = async (url, options) => {
      if ((options?.method ?? 'GET') === 'GET') { await gate; return realFetch(url, { method: 'GET' }) }
      return realFetch(url, options)
    }
    const stale = poll()
    findByAttr(contentOf(dom), 'data-action', 'pet').fire('click')
    await settle()
    assert.ok(hostOf(dom).allText().includes('动作后'), 'the action repainted the panel')

    release()
    await stale
    await settle()
    assert.ok(hostOf(dom).allText().includes('动作后'), 'the stale poll must be dropped')
    assert.ok(!hostOf(dom).allText().includes('大花'), 'and must not paint the old name back')
  } finally {
    globalThis.window.setInterval = realSetInterval
  }
})

test('a repaint keeps the reader where they were', async () => {
  // The panel rebuilds its body from scratch, so a 4s poll scrolled a long
  // shelf back to the top while the user was reading it (B1).
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'shop')
  const content = contentOf(dom)
  content.scrollTop = 140
  pickTab(dom, 'shop')
  assert.equal(contentOf(dom).scrollTop, 140, 'the scroll offset survived the repaint')
})

test('the sign-in bubble floats above the pig instead of on top of it', async () => {
  // `top:-6px` anchors to the scene's top edge; collapsed, the scene *is* the
  // pig, so the bubble sat 24px inside the pig's head (user report #6).
  const css = await readCss()
  const rule = /\.dp-daily\{([^}]*)\}/.exec(css)
  assert.notEqual(rule, null)
  assert.ok(!/(^|;)top:/.test(rule[1]), 'anchor it above the scene, not to its top edge')
  const gap = /bottom:calc\(100% \+ (\d+)px\)/.exec(rule[1])
  assert.notEqual(gap, null, 'it must float above the scene')
  assert.ok(Number(gap[1]) >= 4, `the gap must be visible, got ${gap[1]}px`)

  // Collapsed, the scene is just the pig (and it bobs ±7px), so it needs more.
  const collapsed = /\[data-dsh-pig\]\[data-open="false"\] \.dp-daily\{([^}]*)\}/.exec(css)
  assert.notEqual(collapsed, null, 'the collapsed bubble needs its own offset')
  const collapsedGap = /bottom:calc\(100% \+ (\d+)px\)/.exec(collapsed[1])
  assert.notEqual(collapsedGap, null)
  assert.ok(Number(collapsedGap[1]) >= 12, `collapsed gap too tight: ${collapsedGap[1]}px`)
})

test('the panel pins its own base font size instead of inheriting the page', async () => {
  // The job detail box left font-size to inheritance and picked up the host
  // page's 16px: one block of text twice the size of everything around it.
  const css = await readCss()
  const card = /\.dp-card\{([^}]*)\}/.exec(css)
  assert.notEqual(card, null)
  assert.match(card[1], /font-size:\s*1[01](\.\d+)?px/, 'the panel needs a small base size of its own')
  const pick = /\.dp-pick\{([^}]*)\}/.exec(css)
  assert.notEqual(pick, null)
  assert.match(pick[1], /font-size:/, 'boxes inside the panel set their size explicitly too')
})

test('each @keyframes is defined once, and the pig idles in place', async () => {
  // The sign-in bubble introduced a second `@keyframes dp-bob`, which silently
  // overrode the pig's idle bob (it centres with translateX(-50%)). Every
  // reaction animation then replaced that transform, so a pat snapped the pig
  // half its width sideways and back — the "clicking moves it" bug.
  const css = await readCss()
  const names = [...css.matchAll(/@keyframes ([\w-]+)/g)].map(m => m[1])
  const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))]
  assert.deepEqual(duplicates, [], 'a duplicate @keyframes silently overrides the first one')

  const idle = /@keyframes dp-bob\{([^}]*)\}/.exec(css)
  assert.notEqual(idle, null, 'the pig needs its idle bob')
  assert.ok(!/translateX/.test(idle[1]), 'the idle bob must not shift the pig sideways')
})

test('a stage the user opened survives the next poll', async () => {
  // The panel used to yank the selection back to the first unlocked stage on
  // every render, so picking a locked stage and scrolling down bounced you to
  // 小学 four seconds later (user report).
  const stages = STAGES.map(entry => (entry.key === 'college' ? { ...entry, unlocked: false } : entry))
  const { registration, dom } = await loadClient({ status: { ...SNAPSHOT, stages } })

  let poll = null
  const realSetInterval = globalThis.window.setInterval
  globalThis.window.setInterval = fn => { poll = fn; return 1 }
  try {
    registration.factory(() => {}).apply({})
    await settle()
    openPanel(dom)
    pickTab(dom, 'study')
    // B8: a locked stage is greyed but can still be opened to look inside.
    tap(dom, 'data-stage', 'college')
    assert.notEqual(findByAttr(contentOf(dom), 'data-back', 'study'), undefined, 'inside 大学')

    await poll()
    await settle()
    assert.notEqual(findByAttr(contentOf(dom), 'data-back', 'study'), undefined, 'a poll must not take the user back out')
    assert.ok(contentOf(dom).allText().includes('大学'), contentOf(dom).allText())
  } finally {
    globalThis.window.setInterval = realSetInterval
  }
})

test('the pig and the owner are renamed from the villager card', async () => {
  // G 批次：从状态页挪到居民卡，沿用居民卡的铅笔就地改。
  const { registration, dom, net } = await loadClient({ status: { ...SNAPSHOT, profile: PROFILE } })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'card')
  findByAttr(contentOf(dom), 'data-card-edit', 'name').fire('click')
  const input = /** @type {any} */ (findByAttr(contentOf(dom), 'data-card-input', 'name'))
  assert.notEqual(input, undefined, 'the pig-name input is open')
  assert.equal(input.value, PIG.name, 'prefilled with the current name')
  input.value = ' 大爹的猪 '
  input.fire('input')
  findByAttr(contentOf(dom), 'data-card-save', 'name').fire('click')
  await settle()
  const post = JSON.parse(String(net.calls.filter(call => call.method === 'POST').at(-1).body))
  assert.deepEqual(post, { action: 'name', name: '大爹的猪' })

  findByAttr(contentOf(dom), 'data-card-edit', 'owner').fire('click')
  const ownerInput = /** @type {any} */ (findByAttr(contentOf(dom), 'data-card-input', 'owner'))
  ownerInput.value = '大爹'
  ownerInput.fire('input')
  findByAttr(contentOf(dom), 'data-card-save', 'owner').fire('click')
  await settle()
  const owner = JSON.parse(String(net.calls.filter(call => call.method === 'POST').at(-1).body))
  assert.deepEqual(owner, { action: 'owner', name: '大爹' })
})

test('the panel explains less and shows more', async () => {
  // 用户 #4：能靠界面说清的就别堆字。
  const { registration, dom } = await loadClient({ status: { ...SNAPSHOT, hatched: false, pig: null } })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  const text = contentOf(dom).allText()
  assert.ok(!text.includes('不用敲命令'), `the tutorial line is gone: ${text}`)
  assert.ok(text.includes('拆开纸盒'), 'the button is the explanation')
})

// ===========================================================================
// B5 日常
// ===========================================================================

test('the pig wears a 📅 when there is a sign-in waiting, and it pays', async () => {
  const { registration, dom, net } = await loadClient({
    status: { ...SNAPSHOT, daily: { ...SNAPSHOT.daily, canSignIn: true, signInDay: 5 } },
  })
  registration.factory(() => {}).apply({})
  await settle()
  const hint = findByClass(hostOf(dom), 'dp-daily')
  assert.notEqual(hint, undefined)
  assert.equal(hint.hidden, false)
  assert.equal(hint.allText(), '📅')

  hint.fire('click')
  await settle()
  const posted = net.calls.filter(call => call.method === 'POST')
  assert.equal(posted.length, 1)
  assert.ok(posted[0].body.includes('signIn'), posted[0].body)
})

test('sign-in wins over the gift, and the gift shows when nobody can sign', async () => {
  const both = await loadClient({
    status: { ...SNAPSHOT, daily: { canSignIn: true, signInDay: 3, signInTotal: 2, cycle: 12, unclaimed: 2, onlineMinutes: 30 } },
  })
  both.registration.factory(() => {}).apply({})
  await settle()
  assert.equal(findByClass(hostOf(both.dom), 'dp-daily').allText(), '📅')

  const gift = await loadClient({
    status: { ...SNAPSHOT, daily: { canSignIn: false, signInDay: 3, signInTotal: 3, cycle: 12, unclaimed: 2, onlineMinutes: 30 } },
  })
  gift.registration.factory(() => {}).apply({})
  await settle()
  const hint = findByClass(hostOf(gift.dom), 'dp-daily')
  assert.equal(hint.allText(), '🎁')
  hint.fire('click')
  await settle()
  assert.ok(gift.net.calls.some(call => call.method === 'POST' && call.body.includes('openGift')))
})

test('the status tab shows the sign-in progress', async () => {
  const { registration, dom } = await loadClient({
    status: { ...SNAPSHOT, daily: { canSignIn: true, signInDay: 5, signInTotal: 4, cycle: 12, unclaimed: 1, onlineMinutes: 0 } },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  const text = contentOf(dom).allText()
  assert.ok(text.includes('第 5/12 天'), text)
  assert.ok(text.includes('今天还没签'), text)
  assert.ok(text.includes('🎁 1'), text)
})

test('the bag tab lists the diary newest-first, folded until tapped', async () => {
  const { registration, dom } = await loadClient({
    status: {
      ...SNAPSHOT,
      diary: [
        { day: '2026-10-02', text: '今天吃了 2 顿，主人喂的，好饱。洗完澡香香的。' },
        { day: '2026-10-01', text: '今天主人没来，我睡了一整天。' },
      ],
    },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'bag')
  tap(dom, 'data-bag', 'diary')

  const tiles = []
  contentOf(dom).walk(node => { if (node.attributes?.['data-diary'] !== undefined) tiles.push(node) })
  assert.equal(tiles.length, 2)
  assert.equal(tiles[0].attributes['data-diary'], '2026-10-02', 'newest first')
  assert.ok(tiles[0].allText().includes('10-02'))
  assert.equal(findByClass(contentOf(dom), 'dp-diary-page'), undefined, 'pages start closed')

  tap(dom, 'data-diary', '2026-10-02')
  const page = findByClass(contentOf(dom), 'dp-diary-page')
  assert.notEqual(page, undefined, 'a tap opens the page')
  assert.ok(page.allText().includes('今天吃了 2 顿，主人喂的，好饱。洗完澡香香的。'), page.allText())
  tap(dom, 'data-diary', '2026-10-02')
  assert.equal(findByClass(contentOf(dom), 'dp-diary-page'), undefined, 'and a second tap closes it')
})

// ===========================================================================
// #10 — fields the panel silently dropped
// ===========================================================================

test('装扮 is temporarily absent from the shop and bag, while worn items stay on the pig', async () => {
  const scarf = {
    key: 'scarf', label: '围巾', emoji: '🧣', price: 30, kind: 'dress', tier: null, level: 1,
    owned: true, unlocked: true, worn: true, slot: 'neck', blurb: '', affordable: false, needed: false,
  }
  const { registration, dom } = await loadClient({ status: { ...SNAPSHOT, shop: [...SNAPSHOT.shop, scarf], dress: [scarf] } })
  registration.factory(() => {}).apply({})
  await settle()
  assert.notEqual(findByAttr(hostOf(dom), 'data-slot', 'neck'), undefined, 'worn item survives')
  openPanel(dom)
  pickTab(dom, 'shop')
  assert.equal(findByAttr(contentOf(dom), 'data-shelf', 'dress'), undefined)
  pickTab(dom, 'bag')
  assert.equal(findByAttr(contentOf(dom), 'data-bag', 'dress'), undefined)
})

test('the shop shows how many of a consumable the pig already has', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'shop')
  tap(dom, 'data-shelf', 'food')
  // The snapshot has no per-shelf count: the inventory map is the real source.
  assert.ok(contentOf(dom).allText().includes('×2'), contentOf(dom).allText())
})

test('a render does not wipe the developer-mode highlight', async () => {
  // C1: dev mode is unlocked with seven taps on the version line and lives in
  // memory only, so the test unlocks it the way a user does.
  const realNow = Date.now
  let now = 7_000_000
  Date.now = () => now
  const { registration, dom } = await loadClient()
  try {
    registration.factory(() => {}).apply({})
    await settle()
    // 版本号在主屏上，所以打开面板后要停在主屏（默认会点进状态页）。
    openPanel(dom, 'home')
    for (let i = 0; i < 7; i += 1) {
      now += 100
      findByAttr(contentOf(dom), 'data-version', 'true').fire('click')
    }
    assert.equal(hostOf(dom).attributes['data-dev'], 'true')
    // 解锁后停在调试页，回主屏再点一次猪（任何动作都会走一遍 render）。
    findByAttr(contentOf(dom), 'data-home', 'true').fire('click')
    findByAttr(contentOf(dom), 'data-app', 'status').fire('click')
    // Any action ends in render(); it used to hard-code data-dev back to "false".
    findByAttr(contentOf(dom), 'data-action', 'pet').fire('click')
    await settle()
    assert.equal(hostOf(dom).attributes['data-dev'], 'true', 'dev mode survived a render')
  } finally {
    Date.now = realNow
  }
})

test('the study icon lights up when there is a course to take', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  assert.equal(findByAttr(barOf(dom), 'data-tab', 'study').attributes['data-alert'], 'true')
})

test('the sick pig is told the medicine it actually needs, not the cheapest one', async () => {
  const shop = [
    { key: 'med1', label: '普通药', emoji: '💊', price: 12, kind: 'medicine', tier: 1, affordable: true, needed: false },
    { key: 'med2', label: '特效药', emoji: '💊', price: 26, kind: 'medicine', tier: 2, affordable: true, needed: true },
  ]
  const { registration, dom } = await loadClient({
    status: {
      ...SNAPSHOT,
      shop,
      pig: { ...PIG, coins: 5, illness: { name: '发烧', cure: '退烧药', stage: 2 } },
    },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  const text = contentOf(dom).allText()
  assert.ok(text.includes('特效药'), `expected the tier-2 medicine in: ${text}`)
  assert.ok(!text.includes('普通药'), `the cheapest medicine is the wrong one: ${text}`)
})

// ===========================================================================
// Per-tab content
// ===========================================================================

test('the status tab shows labelled bars, traits and the care buttons', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)

  const text = contentOf(dom).allText()
  for (const label of ['饱食', '心情', '清洁', '健康', '智力', '魅力', '武力', '体重']) {
    assert.ok(text.includes(label), `expected "${label}" in: ${text}`)
  }
  assert.ok(!text.includes('陪伴'), '陪伴 lives in the villager card now')
  for (const key of ['feed', 'bathe', 'play', 'pet']) {
    assert.notEqual(findByAttr(contentOf(dom), 'data-action', key), undefined, `care button ${key}`)
  }
  const play = findByAttr(contentOf(dom), 'data-action', 'play')
  assert.equal(play.disabled, true, 'cooling-down action is disabled')
  assert.ok(play.allText().includes('37'), play.allText())
})

test('a worn 装扮 is drawn on the pig at its slot, not printed on the name plate', async () => {
  const { registration, dom } = await loadClient({
    status: {
      ...SNAPSHOT,
      dress: [
        { key: 'scarf', label: '红围巾', emoji: '🧣', price: 80, level: 1, slot: 'neck', slotLabel: '脖子', blurb: '', owned: true, worn: true, unlocked: true },
        { key: 'strawhat', label: '草帽', emoji: '👒', price: 150, level: 2, slot: 'head', slotLabel: '头', blurb: '', owned: true, worn: false, unlocked: true },
      ],
    },
  })
  registration.factory(() => {}).apply({})
  await settle()

  const worn = findByAttr(hostOf(dom), 'data-slot', 'neck')
  assert.notEqual(worn, undefined, 'the scarf hangs on the neck anchor')
  assert.equal(worn.allText(), '🧣')
  assert.equal(findByAttr(hostOf(dom), 'data-slot', 'head'), undefined, 'an unworn hat is not drawn')
  assert.ok(!findByClass(hostOf(dom), 'dp-hud').allText().includes('🧣'), 'and the name plate stays clean')
})

test('the work tab lists jobs and sending the pig out POSTs the job', async () => {
  const { registration, dom, net } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'work')

  const text = contentOf(dom).allText()
  assert.ok(text.includes('打零工'), text)
  assert.ok(text.includes('12'), text)

  sendJob(dom, 'odd')
  await settle()
  await settle()
  const post = net.calls.find(call => call.method === 'POST')
  assert.deepEqual(JSON.parse(post.body), { action: 'work', job: 'odd' })
})

test('selected job stays in a fixed panel footer, separate from the scrolling list', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'work')
  tap(dom, 'data-job-tile', 'odd')
  const card = cardOf(dom)
  const footer = findByClass(card, 'dp-panel-footer')
  assert.notEqual(footer, undefined)
  assert.equal(footer.parentNode, card)
  assert.equal(footer.hidden, false)
  assert.notEqual(findByClass(footer, 'dp-job-detail'), undefined)
  assert.equal(findByClass(contentOf(dom), 'dp-job-detail'), undefined)
})

test('a job behind a trait gate says what it needs instead of just greying out', async () => {
  const { registration, dom } = await loadClient({
    status: {
      ...SNAPSHOT,
      jobs: [
        { key: 'odd', label: '打零工', emoji: '🧹', minutes: 15, coins: 30, available: true, qualified: true, lockText: '', traitLabel: '魅力', traitEmoji: '✨', traitPoints: 0, baseMinutes: 15, baseCoins: 30, payPercent: 0, speedPercent: 0 },
        { key: 'tutor', label: '家教', emoji: '📚', minutes: 120, coins: 480, available: true, qualified: false, lockText: '🧠 智力 10', traitLabel: '智力', traitEmoji: '🧠', traitPoints: 0, baseMinutes: 120, baseCoins: 480, payPercent: 0, speedPercent: 0 },
      ],
    },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'work')

  // The row stays short (owner, 2026-10-01): a padlock, time and pay. What
  // the gate wants lives behind 详情, not in a pile of text on the row.
  // B9: a job is a tile — a padlock, time and pay. What the gate wants lives
  // in the details under the grid, not in a pile of text on the tile.
  let text = contentOf(dom).allText()
  assert.ok(text.includes('120分·480🪙'), text)
  assert.ok(findByAttr(contentOf(dom), 'data-job-tile', 'tutor').allText().includes('🔒'))
  assert.ok(!text.includes('智力 10'), 'the gate is not spelled out on the tile')
  tap(dom, 'data-job-tile', 'tutor')
  text = cardOf(dom).allText()
  assert.ok(text.includes('✗ 🧠 智力 10'), `an older host's gate still shows in the details: ${text}`)
  assert.equal(findByAttr(cardOf(dom), 'data-job', 'tutor').disabled, true)
  tap(dom, 'data-job-tile', 'odd')
  assert.equal(findByAttr(cardOf(dom), 'data-job', 'odd').disabled, false)
})

test('the panel states facts, not game-design lectures', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)

  for (const tab of ['status', 'study', 'work', 'shop', 'travel', 'bag']) {
    pickTab(dom, tab)
    const text = contentOf(dom).allText()
    assert.ok(!text.includes('等级不会因为猪走了而清零'), `${tab}: level-inheritance lecture is back`)
    assert.ok(!text.includes('再过'), `${tab}: "再过 N 天" hint is back`)
    assert.ok(!text.includes('不用解锁，想学就学'), `${tab}: interest lecture is back`)
  }
})

test('interest courses live in the study tab, not in a new stat panel', async () => {
  const { registration, dom, net } = await loadClient({
    status: {
      ...SNAPSHOT,
      interests: [
        { key: 'photography', label: '摄影', emoji: '📷', traitLabel: '魅力', traitEmoji: '✨', minutes: 30, cost: 40, gain: 2, blurb: '会拍照的猪', times: 0, available: true, affordable: true },
        { key: 'coding', label: '编程', emoji: '💻', traitLabel: '智力', traitEmoji: '🧠', minutes: 60, cost: 80, gain: 2, blurb: '学会让别的猪干活', times: 0, available: true, affordable: false },
        { key: 'fitness', label: '健身', emoji: '🏋', traitLabel: '武力', traitEmoji: '💪', minutes: 30, cost: 35, gain: 2, blurb: '举得动更重的东西', times: 3, available: true, affordable: true },
      ],
    },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'study')
  assert.ok(contentOf(dom).allText().includes('兴趣'), 'the interest tile sits with the stage tiles')
  // 兴趣 is a tile beside the stages; its courses are tiles inside it.
  tap(dom, 'data-stage', 'interest')

  const text = contentOf(dom).allText()
  assert.ok(text.includes('摄影'), text)
  assert.ok(text.includes('健身'), text)
  assert.ok(text.includes('35 🪙'), 'an interest without a certificate shows its price')
  // 兴趣 pays into the three existing traits — no new bars, no percentages.
  pickTab(dom, 'status')
  const status = contentOf(dom).allText()
  assert.ok(!status.includes('本事'), status)
  assert.ok(!status.includes('Lv.0'), status)
  assert.ok(!status.includes('undefined'), status)

  pickTab(dom, 'study')
  tap(dom, 'data-stage', 'interest')
  tap(dom, 'data-interest', 'fitness')
  await settle()
  await settle()
  const post = net.calls.find(call => call.method === 'POST')
  assert.deepEqual(JSON.parse(post.body), { action: 'interest', interest: 'fitness' })
})

test('the time-scale switch lives in the debug tab, not in the panel', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'status')
  assert.equal(findByAttr(contentOf(dom), 'data-scale', '12'), undefined, 'a normal user must not see it')

  // Static guard: the ×1/×12/×30/×60 buttons are one of the 调试-tab groups.
  // The fake DOM cannot dispatch the Ctrl+Shift+D listener, so read the source.
  const dev = await readModule('tabs/dev.js')
  const status = await readModule('tabs/status.js')
  assert.match(dev, /time\('时间', \[[\s\S]{0,400}timeScale/, 'the time switch must be a debug-tab group')
  assert.ok(!/data-scale/.test(status), 'and must not be built in the status tab')
})

test('an older host with no job gates does not lock the whole board', async () => {
  // Same family as the `undefined` bug: an absent field must default to
  // "allowed". Defaulting the other way would brick every job the moment the
  // host and the client bundle drift apart.
  const { registration, dom } = await loadClient({
    status: {
      ...SNAPSHOT,
      jobs: [{ key: 'odd', label: '打零工', emoji: '🧹', minutes: 15, coins: 30, available: true }],
    },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'work')

  const text = contentOf(dom).allText()
  assert.ok(!text.includes('🔒'), text)
  assert.ok(!text.includes('undefined'), text)
  tap(dom, 'data-job-tile', 'odd')
  assert.equal(findByAttr(cardOf(dom), 'data-job', 'odd').disabled, false)
})

test('the shop tab is a grid that fades what the pig cannot afford and flags the needed medicine', async () => {
  const { registration, dom, net } = await loadClient({
    status: {
      ...SNAPSHOT,
      // A shelf wide enough to prove the grid, with one affordable and one not.
      shop: [
        { key: 'apple', label: '苹果', emoji: '🍎', price: 6, kind: 'food', affordable: true, needed: false, count: 2 },
        { key: 'med1', label: '普通药', emoji: '💊', price: 12, kind: 'medicine', affordable: true, needed: true, count: 0 },
        { key: 'soul', label: '还魂丹', emoji: '✨', price: 150, kind: 'revive', affordable: false, needed: false, count: 0 },
      ],
      pig: { ...PIG, illness: { name: '感冒', cure: '板蓝根', stage: 1 } },
    },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'shop')
  // The top layer is shelf tiles; the one holding the needed medicine says so.
  assert.notEqual(findByClass(contentOf(dom), 'dp-tiles'), undefined, 'the shop renders as tiles')
  assert.ok(findByAttr(contentOf(dom), 'data-shelf', 'medicine').allText().includes('需要'))

  // Tiles are never disabled: a tap on one it cannot afford should explain how
  // much is missing rather than doing nothing. Unaffordable is faded.
  // 还魂丹放在药品货架里（G 批次反馈）。
  tap(dom, 'data-shelf', 'medicine')
  assert.equal(findByAttr(contentOf(dom), 'data-buy', 'soul').disabled, false)
  assert.equal(findByAttr(contentOf(dom), 'data-buy', 'soul').attributes['data-dim'], 'true')
  tap(dom, 'data-back', 'shop')
  tap(dom, 'data-shelf', 'medicine')
  assert.equal(findByAttr(contentOf(dom), 'data-buy', 'med1').allText().includes('需要'), true)
  tap(dom, 'data-back', 'shop')
  tap(dom, 'data-shelf', 'food')
  assert.equal(findByAttr(contentOf(dom), 'data-buy', 'apple').attributes['data-dim'], undefined)

  tap(dom, 'data-buy', 'apple')
  await settle()
  await settle()
  const post = net.calls.find(call => call.method === 'POST')
  assert.deepEqual(JSON.parse(post.body), { action: 'buy', item: 'apple' })
})

test('the travel tab lists destinations without the souvenir collection', async () => {
  const { registration, dom, net } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'travel')

  const text = contentOf(dom).allText()
  assert.ok(text.includes('郊游'), text)
  assert.ok(!text.includes('纪念品'), text)
  assert.ok(!text.includes('贝壳'), text)
  assert.equal(findByAttr(contentOf(dom), 'data-trip', 'abroad').disabled, true, 'unaffordable trip is disabled')

  findByAttr(contentOf(dom), 'data-trip', 'suburb').fire('click')
  await settle()
  await settle()
  const post = net.calls.find(call => call.method === 'POST')
  assert.deepEqual(JSON.parse(post.body), { action: 'trip', trip: 'suburb' })
})

test('a souvenir opens its story card in the bag and can be sold from there', async () => {
  const { registration, dom, net } = await loadClient({
    status: {
      ...SNAPSHOT,
      pig: {
        ...PIG,
        souvenirs: [
          { key: 'shell', emoji: '🐚', label: '一枚海螺', rarityLabel: '稀有', rarityEmoji: '🔵', price: 320, story: '在海边捡到一枚海螺，贴在耳朵上能听见浪声。', fromLabel: '看海' },
        ],
      },
    },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'bag')
  tap(dom, 'data-bag', 'souvenir')

  const listed = contentOf(dom).allText()
  assert.ok(listed.includes('🔵稀有'), `expected the rarity on the chip, got: ${listed}`)
  assert.ok(listed.includes('一枚海螺'), listed)

  findByAttr(contentOf(dom), 'data-souvenir', 'shell#0').fire('click')
  const opened = contentOf(dom).allText()
  assert.ok(opened.includes('贴在耳朵上能听见浪声'), opened)
  assert.ok(opened.includes('看海'), opened)

  findByAttr(contentOf(dom), 'data-sell', 'shell').fire('click')
  await settle()
  await settle()
  const post = net.calls.find(call => call.method === 'POST')
  assert.deepEqual(JSON.parse(post.body), { action: 'sell', souvenir: 'shell' })
})

test('a legacy string souvenir still lists in the bag without a sell button', async () => {
  // The old host sent strings; the client must not print [object Object] or
  // invent a price for something the host never priced.
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'bag')
  tap(dom, 'data-bag', 'souvenir')
  findByAttr(contentOf(dom), 'data-souvenir', '贝壳#0').fire('click')
  const text = contentOf(dom).allText()
  assert.ok(text.includes('贝壳'), text)
  assert.ok(text.includes('旧版本带来的') || text.includes('旧版本带回来的'), text)
  assert.equal(findByAttr(contentOf(dom), 'data-sell', '贝壳'), undefined)
  assert.ok(!text.includes('undefined'), text)
})

test('the bag tab lists owned items with a use button', async () => {
  const { registration, dom, net } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'bag')
  tap(dom, 'data-bag', 'food')

  const text = contentOf(dom).allText()
  assert.ok(text.includes('苹果'), text)
  assert.ok(text.includes('×2'), text)
  tap(dom, 'data-back', 'bag')
  tap(dom, 'data-bag', 'medicine')
  assert.equal(findByAttr(contentOf(dom), 'data-use', 'med1'), undefined, 'zero-count items are hidden')
  tap(dom, 'data-back', 'bag')
  tap(dom, 'data-bag', 'food')

  tap(dom, 'data-use', 'apple')
  await settle()
  await settle()
  const post = net.calls.find(call => call.method === 'POST')
  // G 批次：背包里吃东西就是一次喂食（长体重、会胀气、猪会说话），发的是 feed。
  assert.deepEqual(JSON.parse(post.body), { action: 'feed', item: 'apple' })
})

test('an empty bag says so instead of showing nothing', async () => {
  const { registration, dom } = await loadClient({
    status: { ...SNAPSHOT, inventory: { apple: 0, med1: 0, soul: 0 } },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'bag')
  // Every category is still a tile, faded when empty, and says so inside.
  assert.equal(findByAttr(contentOf(dom), 'data-bag', 'food').attributes['data-dim'], 'true')
  tap(dom, 'data-bag', 'food')
  assert.ok(contentOf(dom).allText().includes('空的'), contentOf(dom).allText())
})

// ===========================================================================
// Banners: away, sick, dead, unhatched
// ===========================================================================

test('an active trip shows a countdown banner and a recall button', async () => {
  const { registration, dom } = await loadClient({
    status: { ...SNAPSHOT, canGoOut: false, activity: { kind: 'trip', key: 'sea', label: '看海', emoji: '🌊', secondsLeft: 42 } },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)

  const text = contentOf(dom).allText()
  assert.ok(text.includes('42'), text)
  assert.ok(text.includes('看海'), text)
  assert.notEqual(findByAttr(contentOf(dom), 'data-action', 'calloff'), undefined)
})

test('a sick pig shows its illness and what it needs', async () => {
  const { registration, dom } = await loadClient({
    status: { ...SNAPSHOT, pig: { ...PIG, illness: { name: '肺炎', cure: '金色消炎药水', stage: 4 } } },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  const text = contentOf(dom).allText()
  assert.ok(text.includes('肺炎'), text)
  assert.ok(text.includes('金色消炎药水'), text)
})

test('a box that already has a save is still pokeable', async () => {
  // `reset` and `adopt` write a real save with hatched:false, so `pig` is an
  // object rather than null. Gating the poke on `pig === null` meant clicking
  // such a box fell through to petting and the pig said 好舒服…
  const { registration, dom, net } = await loadClient({
    status: {
      ...SNAPSHOT,
      hatched: false,
      dead: false,
      pig: { ...PIG, stage: { key: 'box', label: '纸盒', emoji: '📦', size: 58 }, ageLabel: '还没拆开' },
    },
  })
  registration.factory(() => {}).apply({})
  await settle()

  const host = hostOf(dom)
  const scene = sceneOf(dom)
  const poke = () => { scene.fire('pointerdown', { button: 0, clientX: 0, clientY: 0 }); scene.fire('pointerup', {}) }

  assert.equal(host.attributes['data-unhatched'], 'true', 'an existing-but-unhatched save shows the box')
  assert.equal(findByClass(host, 'dp-poke-hint').hidden, false, 'with its hint')

  poke()
  assert.equal(host.attributes['data-poke'], '1', 'the first poke registers')
  assert.equal(
    findByClass(host, 'dp-bubble').allText().includes('好舒服'),
    false,
    'and it must NOT be treated as a pat on the head',
  )

  poke()
  poke()
  const hatches = net.calls.filter(c => c.method === 'POST' && String(c.body).includes('hatch'))
  assert.equal(hatches.length, 1, 'the third poke hatches it')
})

test('a new box takes three pokes to open, not one', async () => {
  const { registration, dom, net } = await loadClient({
    status: { ok: true, pig: null, hatched: false, dead: false, pending: [] },
  })
  registration.factory(() => {}).apply({})
  await settle()

  const host = hostOf(dom)
  const scene = sceneOf(dom)
  const poke = () => { scene.fire('pointerdown', { button: 0, clientX: 0, clientY: 0 }); scene.fire('pointerup', {}) }

  assert.equal(host.attributes['data-unhatched'], 'true', 'the box announces itself')
  assert.equal(findByClass(host, 'dp-poke-hint').hidden, false, 'and shows a hint')

  poke()
  assert.equal(findByClass(host, 'dp-bubble').allText().includes('里面好像有东西'), true, 'first poke hints')
  assert.equal(host.attributes['data-poke'], '1')

  poke()
  assert.equal(findByClass(host, 'dp-bubble').allText().includes('再戳一下'), true, 'second poke teases')
  assert.equal(host.attributes['data-poke'], '2')

  poke()
  // The third one opens it, which means the host is asked to hatch.
  const posts = net.calls.filter(c => c.method === 'POST' && String(c.body).includes('hatch'))
  assert.equal(posts.length, 1, 'the third poke is the one that hatches')
  assert.equal(host.attributes['data-poke'], undefined, 'and the poke counter is cleared')
})

test('a graveside pig can be replaced at once, soul or no soul', async () => {
  for (const soul of [false, true]) {
    const { registration, dom } = await loadClient({
      status: {
        ...SNAPSHOT,
        dead: true,
        pig: { ...PIG, stage: { key: 'grave', label: '墓碑', emoji: '🪦', size: 52 }, soul, health: 0 },
      },
    })
    registration.factory(() => {}).apply({})
    await settle()
    openPanel(dom)
    const adopt = findByAttr(contentOf(dom), 'data-action', 'adopt')
    assert.notEqual(adopt, undefined, `adopt must be offered (soul=${soul})`)
    assert.ok(adopt.allText().includes('领养新猪'))
  }
})

test('a sick pig with no money is told it can still go out and earn', async () => {
  const broke = await loadClient({
    status: {
      ...SNAPSHOT,
      canGoOut: true,
      shop: [{ key: 'med1', label: '普通药', emoji: '💊', price: 12, kind: 'medicine', tier: 1, affordable: true }],
      pig: { ...PIG, coins: 3, illness: { name: '感冒', cure: '板蓝根', stage: 1 } },
    },
  })
  broke.registration.factory(() => {}).apply({})
  await settle()
  openPanel(broke.dom)
  const text = contentOf(broke.dom).allText()
  assert.ok(text.includes('带病出门'), `the way out must be spelled out: ${text}`)
  assert.ok(text.includes('12'), `and how much it needs: ${text}`)

  // With enough money there is no need for the hint.
  const rich = await loadClient({
    status: {
      ...SNAPSHOT,
      canGoOut: true,
      shop: [{ key: 'med1', label: '普通药', emoji: '💊', price: 12, kind: 'medicine', affordable: true }],
      pig: { ...PIG, coins: 900, illness: { name: '感冒', cure: '板蓝根', stage: 1 } },
    },
  })
  rich.registration.factory(() => {}).apply({})
  await settle()
  openPanel(rich.dom)
  assert.ok(!contentOf(rich.dom).allText().includes('先去打工'))
})

test('a dead pig shows the revive banner and greys out', async () => {
  const { registration, dom } = await loadClient({
    status: { ...SNAPSHOT, dead: true, pig: { ...PIG, health: 0, healthPercent: 0, mood: 'dead' } },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  const text = contentOf(dom).allText()
  assert.ok(text.includes('走了'), text)
  assert.ok(text.includes('还魂丹'), text)
  assert.equal(hostOf(dom).attributes['data-dead'], 'true')
  for (const key of ['feed', 'bathe', 'play']) {
    assert.equal(findByAttr(contentOf(dom), 'data-action', key).disabled, true)
  }
})

test('an unhatched pig offers a hatch button instead of a command', async () => {
  const { registration, dom, net } = await loadClient({
    status: { ok: true, hatched: false, dead: false, pig: null, actions: ACTIONS, jobs: [], subjects: [], stages: STAGES, trips: [], shop: [], inventory: {}, activity: null, canGoOut: false, awayBlocked: 'absent', pending: [], maxHealth: 5 },
    actResult: { ...SNAPSHOT, ok: true },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)

  const hatch = findByAttr(contentOf(dom), 'data-action', 'hatch')
  assert.notEqual(hatch, undefined, 'the empty panel must offer hatching without typing')
  assert.ok(hatch.allText().includes('拆开纸盒'), hatch.allText())

  hatch.fire('click')
  await settle()
  await settle()
  const post = net.calls.find(call => call.method === 'POST')
  assert.deepEqual(JSON.parse(post.body), { action: 'hatch' })
})

// ===========================================================================
// Announcements and failures
// ===========================================================================

test('queued host announcements surface as toasts', async () => {
  const { registration, dom } = await loadClient({
    status: { ...SNAPSHOT, pending: [{ kind: 'trip', text: '大花 从看海回来了，带回「贝壳」🧳', at: 111 }] },
  })
  registration.factory(() => {}).apply({})
  await settle()
  const toast = findByClass(hostOf(dom), 'dp-toast')
  assert.notEqual(toast, undefined, 'a toast should be mounted')
  assert.ok(toast.allText().includes('看海'), toast.allText())
})

test('a refused operation explains itself in the bubble', async () => {
  const { registration, dom } = await loadClient({
    actResult: { ...SNAPSHOT, ok: false, reason: 'poor', price: 400 },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'work')
  sendJob(dom, 'odd')
  await settle()
  await settle()
  const bubble = findByClass(hostOf(dom), 'dp-bubble')
  assert.notEqual(bubble, undefined)
  assert.ok(bubble.allText().includes('钱不够'), bubble.allText())
})

test('a stale reply is dropped silently instead of scolding the user', async () => {
  // Answering a line that has already been superseded is normal (two windows,
  // a slow poll) — it must not pop a refusal bubble (B1 小缺口).
  const { registration, dom } = await loadClient({
    actResult: { ...SNAPSHOT, ok: false, reason: 'stale-line' },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  findByAttr(contentOf(dom), 'data-action', 'pet').fire('click')
  await settle()
  await settle()
  const bubble = findByClass(hostOf(dom), 'dp-bubble')
  const text = bubble === undefined ? '' : bubble.allText()
  assert.ok(!text.includes('没成') && !text.includes('这个操作'), `nothing should be said: ${text}`)
})

test('a drawn stage shows a sprite, the others show the emoji', async () => {
  const drawn = await loadClient({
    status: {
      ...SNAPSHOT,
      pig: { ...PIG, mood: 'fine', stage: { key: 'piglet', label: '小猪', emoji: '🐖', size: 40, art: 'piglet' } },
    },
  })
  drawn.registration.factory(() => {}).apply({})
  await settle()
  const img = findByClass(hostOf(drawn.dom), 'dp-pig-img')
  const emoji = findByClass(hostOf(drawn.dom), 'dp-pig-emoji')
  assert.notEqual(img, undefined, 'the sprite element must exist')
  assert.equal(img.hidden, false, 'the sprite is shown')
  assert.equal(img.src, '/dsh-piggy/art/piglet.svg', 'the sprite points at the plugin art route')
  assert.equal(emoji.hidden, true, 'and the emoji is hidden')

  const plain = await loadClient({ status: { ...SNAPSHOT, pig: { ...PIG, mood: 'fine' } } })
  plain.registration.factory(() => {}).apply({})
  await settle()
  const img2 = findByClass(hostOf(plain.dom), 'dp-pig-img')
  const emoji2 = findByClass(hostOf(plain.dom), 'dp-pig-emoji')
  assert.equal(img2.hidden, true, 'a stage with no art keeps the emoji')
  assert.equal(img2.getAttribute('src'), null, 'and no sprite is requested at all')
  assert.equal(emoji2.hidden, false)
})

test('being away shows what the pig is doing and how far along it is', async () => {
  const cases = [
    ['work', 'working', '💻'],
    ['study', 'studying', '📖'],
    ['trip', 'traveling', '🌊'],
  ]
  for (const [kind, mood, emoji] of cases) {
    const { registration, dom } = await loadClient({
      status: {
        ...SNAPSHOT,
        pig: { ...PIG, mood },
        canGoOut: false,
        activity: { kind, key: 'x', label: '出门', emoji, secondsLeft: 900, progress: 42 },
      },
    })
    registration.factory(() => {}).apply({})
    await settle()

    const host = hostOf(dom)
    assert.equal(host.attributes['data-away'], kind, `${kind}: the host must announce the activity`)
    const work = findByClass(host, 'dp-work')
    assert.notEqual(work, undefined, `${kind}: a work block must exist`)
    assert.equal(work.hidden, false, `${kind}: it must be visible while away`)
    assert.equal(findByClass(host, 'dp-prop').textContent, emoji, `${kind}: the prop emoji`)
    assert.equal(findByClass(host, 'dp-progress').children[0].style.width, '42%', `${kind}: progress`)
    // The pig carries the pose the stylesheet keys its animation off.
    assert.notEqual(findByAttr(host, 'data-mood', mood), undefined, `${kind}: the pig needs the ${mood} pose`)
  }
})

test('coming home hides the work block again', async () => {
  const { registration, dom } = await loadClient({
    status: { ...SNAPSHOT, canGoOut: false, activity: { kind: 'work', key: 'x', label: '上班', emoji: '💻', secondsLeft: 60, progress: 10 } },
  })
  registration.factory(() => {}).apply({})
  await settle()
  assert.equal(hostOf(dom).attributes['data-away'], 'work')
  assert.equal(findByClass(hostOf(dom), 'dp-work').hidden, false)
})

test('the care buttons open the matching bag shelf; an empty one offers the shop', async () => {
  // G 批次：喂食 / 洗澡 / 玩耍跳到背包对应货架，不在状态页维护物品列表。
  for (const [action, kind] of [['feed', 'food'], ['bathe', 'bath'], ['play', 'toy']]) {
    const { registration, dom } = await loadClient({ status: { ...SNAPSHOT, care: { feed: [], bathe: [], play: [] }, inventory: {} } })
    registration.factory(() => {}).apply({})
    await settle()
    openPanel(dom)
    findByAttr(contentOf(dom), 'data-action', action).fire('click')
    assert.notEqual(findByAttr(contentOf(dom), 'data-back', 'bag'), undefined, `${action}: lands in the bag`)
    assert.notEqual(findByAttr(contentOf(dom), 'data-bag-shop', kind), undefined, `${action}: empty ${kind} shelf links to the shop`)
  }
})

test('a failing host route degrades instead of throwing', async () => {
  const { registration, dom } = await loadClient()
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED') }
  registration.factory(() => {}).apply({})
  await settle()
  await settle()
  assert.ok(findByClass(hostOf(dom), 'dp-bubble').allText().includes('连接不上宿主'))
})

test('apply survives a shell with no body yet', async () => {
  const { registration, dom } = await loadClient()
  let deferred = null
  dom.document.body = null
  dom.document.addEventListener = (name, fn) => { if (name === 'DOMContentLoaded') deferred = fn }
  let dispose
  assert.doesNotThrow(() => { dispose = registration.factory(() => {}).apply({}) })
  assert.equal(typeof dispose, 'function')
  assert.equal(typeof deferred, 'function')
  assert.doesNotThrow(() => deferred())
})

test('apply never throws, even against a hostile DOM', async () => {
  const { registration } = await loadClient()
  globalThis.document = {
    head: { appendChild() {} },
    body: { appendChild() {} },
    createElement() { throw new Error('CSP says no') },
    querySelector() { return null },
    addEventListener() {},
    removeEventListener() {},
  }
  let dispose
  assert.doesNotThrow(() => { dispose = registration.factory(() => {}).apply({}) })
  assert.equal(typeof dispose, 'function')
  assert.doesNotThrow(() => dispose())
})

test('dispose removes the floating pig', async () => {
  const { registration, dom } = await loadClient()
  const dispose = registration.factory(() => {}).apply({})
  assert.equal(dom.body.children.length, 1)
  dispose()
  assert.equal(dom.body.children.length, 0)
})

/**
 * Regression: the widget is anchored at right:18px/bottom:18px, which is exactly
 * where the harness parks its composer and its send button. With `pointer-events`
 * left at its default the wrapper swallowed those clicks — the message never left
 * the browser while the model, the server and the network were all healthy, and
 * the only visible symptom was "sending a message does nothing". A fake DOM has
 * no layout and no hit-testing, so both guarantees are checked statically.
 */
test('the widget lets clicks through without steering the user', async () => {
  const source = await readSource()
  const css = await readCss()
  assert.match(css, /\[data-dsh-pig\]\{[^}]*pointer-events:none/, 'the wrapper must not take clicks')
  assert.match(css, /\[data-dsh-pig\]>\*\{pointer-events:auto\}/, 'the pig and the panel must still take clicks')

  // A composer-avoidance floor used to force the widget above the input box,
  // because the wrapper was swallowing clicks aimed at the send button.
  // `pointer-events` fixes that properly, and the floor only ever stopped the
  // user from parking their pet where they wanted it — including beside the
  // composer, which is where a desktop pet belongs.
  assert.doesNotMatch(source, /contenteditable="true"/, 'the composer floor must be gone')
  assert.doesNotMatch(source, /Math\.max\(userBottom, floor\)/, 'placement is the user\'s choice')

  // What remains is only "keep the widget on screen".
  assert.match(source, /function clampPig\(\)/, 'the pig is still kept on screen')
  assert.match(source, /function fitPanel\(\)/, 'the panel is fitted to the window')
  assert.match(source, /addEventListener\?\.\('resize', onResize\)/, 'both follow viewport changes')
  assert.match(source, /removeEventListener\?\.\('resize', onResize\)/, 'and both are released on dispose')
})

test('the pig is clamped to the window but never pushed around', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()

  const host = hostOf(dom)
  const scene = sceneOf(dom)
  const pigEl = findByClass(scene, 'dp-pig')
  scene.rect = { x: 0, y: 0, top: 700, left: 1200, right: 1260, bottom: 768, width: 60, height: 68 }
  // The horizontal bound is the pig itself, not the scene: the scene widens to
  // the panel when open, and clamping against that would shove the pig sideways
  // on any window resize.
  pigEl.rect = { x: 0, y: 0, top: 712, left: 1200, right: 1260, bottom: 768, width: 60, height: 56 }

  const dragBy = (dx, dy) => {
    scene.fire('pointerdown', { button: 0, clientX: 0, clientY: 0 })
    scene.fire('pointermove', { clientX: dx, clientY: dy })
    scene.fire('pointerup', {})
  }

  // Dragged far past the top-left: pulled back just far enough to stay visible.
  // The horizontal footprint is the glyph plus the scene's 6px side padding.
  dragBy(-1200, -1200)
  assert.equal(parseFloat(host.style.right), 1280 - (60 + 12) - 4, 'right is clamped to leave the pig on screen')
  // The vertical reserve is the OPEN scene (132), not the collapsed box (68):
  // clamping by the collapsed height let the pig be parked so high that opening
  // its own panel pushed the hud off the top of the window.
  assert.equal(parseFloat(host.style.bottom), 800 - 132 - 4, 'bottom reserves the open scene')

  // Anywhere inside the window is the user's business — including the corner
  // beside the composer, which is the whole point of dropping the old floor.
  const before = parseFloat(host.style.right)
  dragBy(400, 400)
  const parked = { right: parseFloat(host.style.right), bottom: parseFloat(host.style.bottom) }
  assert.equal(parked.right, before - 400, 'a legal horizontal move is kept exactly')
  assert.equal(parked.bottom, 800 - 132 - 4 - 400, 'and so is a legal vertical one')
  assert.ok(parked.bottom < 800 - 132 - 4, 'it really did move lower')

  // Coming back to rest changes nothing.
  dragBy(0, 0)
  assert.equal(parseFloat(host.style.right), parked.right)
  assert.equal(parseFloat(host.style.bottom), parked.bottom)
})

test('the panel uses one anchor at a time, never top and bottom together', async () => {
  const { registration, dom, resize } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()
  const card = cardOf(dom)
  const scene = sceneOf(dom)

  // Plenty of room above: the panel hangs upward off the pig.
  scene.rect = { x: 0, y: 0, top: 500, left: 1100, right: 1180, bottom: 632, width: 80, height: 132 }
  openPanel(dom)
  assert.equal(card.style.top, 'auto', 'the top anchor must be released')
  assert.match(card.style.bottom, /100%/, 'and the bottom anchor used')

  // Parked near the top: it must flip rather than open off the screen.
  scene.rect = { x: 0, y: 0, top: 8, left: 1100, right: 1180, bottom: 140, width: 80, height: 132 }
  resize()
  assert.equal(card.style.bottom, 'auto', 'the bottom anchor must be released')
  assert.match(card.style.top, /100%/, 'and the panel flipped below the pig')

  // Regression: clearing an anchor with '' falls back to the stylesheet, so both
  // edges end up pinned and an absolutely positioned box collapses to nothing.
  assert.notEqual(card.style.top, '', 'the top anchor is always explicit')
  assert.notEqual(card.style.bottom, '', 'the bottom anchor is always explicit')
})

test('the JS scene reserve tracks the CSS token it stands in for', async () => {
  const source = await readSource()
  const css = await readCss()
  const fromCss = /--scene-open:\s*(\d+)px/.exec(css)
  const fromJs = /(?:var|export const) SCENE_RESERVE = (\d+)/.exec(source)
  assert.ok(fromCss !== null, 'the CSS must declare --scene-open')
  assert.ok(fromJs !== null, 'the bundle must declare SCENE_RESERVE')
  assert.equal(fromJs[1], fromCss[1], 'SCENE_RESERVE must match --scene-open')
})

test('right-click opens the menu and left-click only pats the pig', async () => {
  const { registration, dom } = await loadClient()
  registration.factory(() => {}).apply({})
  await settle()

  const host = hostOf(dom)
  assert.equal(host.attributes['data-open'], 'false')

  // A left click is a pat: the panel stays shut.
  patPig(dom)
  assert.equal(host.attributes['data-open'], 'false', 'left click must not open the panel')
  assert.equal(findByClass(sceneOf(dom), 'dp-pig').attributes['data-react'], 'pet', 'but the pig reacts')

  // The menu is on the context menu.
  let prevented = false
  sceneOf(dom).fire('contextmenu', { preventDefault() { prevented = true } })
  assert.equal(prevented, true, 'the native context menu must be suppressed')
  assert.equal(host.attributes['data-open'], 'true')

  sceneOf(dom).fire('contextmenu', { preventDefault() {} })
  assert.equal(host.attributes['data-open'], 'false', 'and it toggles back')

  // The tooltip is the only discoverability right-click gets.
  assert.match(sceneOf(dom).title, /右键/, 'the pig must say how to open the menu')
})

test('the study tab is stage tiles; inside one, each subject shows where it stands (B4, B8)', async () => {
  const subject = (key, label, emoji, lessons, stageKey, stageLabel) => ({
    key, label, emoji, traitLabel: '智力', traitEmoji: '🧠', lessons,
    stage: { key: stageKey, label: stageLabel, emoji: '📚' }, nextGraduation: null,
    minutes: 20, tuition: 10, gain: 1, secondaryGain: 0, available: true, affordable: true,
  })
  const stage = (key, label, from, upTo, unlocked) => ({
    key, label, emoji: '📚', minutes: 20, tuition: 10, gain: 1, from, upTo, unlocked,
    subjects: ['chinese', 'mathematics'], progress: unlocked ? null : { done: 12, need: from, label: `任意一门课念完第 ${from} 节` },
  })
  const { registration, dom, net } = await loadClient({
    status: {
      ...SNAPSHOT,
      stages: [stage('primary', '小学', 0, 9, true), stage('middle', '中学', 9, 20, true), stage('college', '大学', 20, 40, false)],
      subjects: [
        subject('chinese', '语文', '📖', 12, 'middle', '中学'),
        subject('mathematics', '数学', '🔢', 0, 'primary', '小学'),
      ],
    },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'study')
  let text = contentOf(dom).allText()
  assert.ok(text.includes('小学') && text.includes('中学') && text.includes('大学'), 'one tile per stage')
  assert.equal(findByAttr(contentOf(dom), 'data-stage', 'college').attributes['data-locked'], 'true', 'a locked stage is greyed')
  assert.equal(findByAttr(contentOf(dom), 'data-subject', 'chinese'), undefined, 'subjects live inside a stage')

  tap(dom, 'data-stage', 'primary')
  text = contentOf(dom).allText()
  assert.ok(text.includes('✓ 毕业'), `语文 has finished 小学: ${text}`)
  assert.ok(text.includes('0/9 节'), `数学 is in 小学: ${text}`)

  tap(dom, 'data-back', 'study')
  tap(dom, 'data-stage', 'middle')
  text = contentOf(dom).allText()
  assert.ok(text.includes('3/11 节'), `语文 is 3 lessons into 中学: ${text}`)
  assert.ok(text.includes('🔒 小学'), `数学 has not reached 中学: ${text}`)
  assert.equal(findByAttr(contentOf(dom), 'data-subject', 'mathematics').disabled, true, 'a subject that has not reached 中学 cannot be taken there')

  tap(dom, 'data-subject', 'chinese')
  await settle()
  const post = JSON.parse(String(net.calls.filter(c => c.method === 'POST').at(-1).body))
  assert.equal(post.action, 'study')
  assert.equal(post.subject, 'chinese')
})

test('免打扰 keeps routine news quiet but lets illness through; the switch lives in settings, names in the card', async () => {
  const { registration, dom } = await loadClient({
    status: {
      ...SNAPSHOT,
      profile: PROFILE,
      dialogue: { ownerName: '小明', quiet: true },
      pending: [
        { id: 1, kind: 'work', text: '猪猪 打工回来了！赚到 40 金币 💰', at: 111 },
        { id: 2, kind: 'sick', text: '猪猪 得了感冒，需要🌿板蓝根 🤒', at: 112 },
      ],
    },
  })
  registration.factory(() => {}).apply({})
  await settle()
  const toasts = []
  hostOf(dom).walk(node => { if (typeof node.className === 'string' && node.className.split(/\s+/).includes('dp-toast')) toasts.push(node.allText()) })
  assert.equal(toasts.some(text => text.includes('打工回来')), false, 'routine news is held back')
  assert.equal(toasts.some(text => text.includes('感冒')), true, 'illness still gets through')

  // G 批次：免打扰挪到设置，名字和称呼挪到居民卡；称呼仍不印在面板上（user report #4）。
  openPanel(dom)
  pickTab(dom, 'settings')
  assert.notEqual(findByAttr(contentOf(dom), 'data-quiet', 'on'), undefined, '免打扰 switch is on in settings')
  pickTab(dom, 'card')
  const text = contentOf(dom).allText()
  assert.ok(!text.includes('小明'), 'the card does not print the nickname')
  assert.notEqual(findByAttr(contentOf(dom), 'data-card-edit', 'owner'), undefined, '改称呼 stays available')
  assert.notEqual(findByAttr(contentOf(dom), 'data-card-edit', 'name'), undefined, 'and the pig can be renamed too')
})

test('tile tabs: coloured top layer, back returns, a poll keeps you inside, a new visit starts at the top (B8)', async () => {
  const { registration, dom } = await loadClient()
  let poll = null
  const realSetInterval = globalThis.window.setInterval
  globalThis.window.setInterval = fn => { poll = fn; return 1 }
  try {
    registration.factory(() => {}).apply({})
    await settle()
    openPanel(dom)
    for (const [tab, attr] of [['shop', 'data-shelf'], ['bag', 'data-bag'], ['study', 'data-stage']]) {
      pickTab(dom, tab)
      const tiles = []
      contentOf(dom).walk(node => { if (node.attributes?.[attr] !== undefined) tiles.push(node) })
      // 商店只摆有货的货架，测试快照里只有食物和药品两排。
      const least = tab === 'shop' ? 2 : 3
      assert.ok(tiles.length >= least, `${tab}: a grid of category tiles`)
      const colours = new Set(tiles.map(node => node.attributes['data-color']))
      assert.equal(colours.has(undefined), false, `${tab}: every tile has a colour`)
      assert.ok(colours.size >= least, `${tab}: the categories are told apart by colour`)
    }

    pickTab(dom, 'shop')
    tap(dom, 'data-shelf', 'food')
    await poll()
    await settle()
    assert.notEqual(findByAttr(contentOf(dom), 'data-buy', 'apple'), undefined, 'a poll keeps the shelf open')
    tap(dom, 'data-back', 'shop')
    assert.notEqual(findByAttr(contentOf(dom), 'data-shelf', 'food'), undefined, 'back to the shelves')

    tap(dom, 'data-shelf', 'food')
    pickTab(dom, 'bag')
    pickTab(dom, 'shop')
    assert.notEqual(findByAttr(contentOf(dom), 'data-shelf', 'food'), undefined, 'coming back to the tab starts at its top layer')
  } finally {
    globalThis.window.setInterval = realSetInterval
  }
})

test('banners live on the status tab only; the home screen flags the status tile instead (B9)', async () => {
  const away = { kind: 'work', key: 'odd', label: '打零工', emoji: '🧹', secondsLeft: 60 }
  const { registration, dom } = await loadClient({ status: { ...SNAPSHOT, canGoOut: false, activity: away } })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom, 'home')
  assert.equal(findByClass(findByAttr(contentOf(dom), 'data-app', 'status'), 'dp-tile-tag').allText(), '在外面')
  for (const app of ['shop', 'bag', 'study', 'card']) {
    tap(dom, 'data-app', app)
    assert.ok(!contentOf(dom).allText().includes('在外面'), `${app} has no away banner`)
    tap(dom, 'data-home', 'true')
  }
  tap(dom, 'data-app', 'status')
  assert.ok(contentOf(dom).allText().includes('在外面：打零工'), 'the status tab has it')
})

// ===========================================================================
// C4 图鉴替代原加冕 App
// ===========================================================================

const PROFILE = {
  personality: { label: '悠闲', emoji: '😌' }, catchphrase: '噜噜', motto: '吃饱饱',
  birthday: '9 月 30 日', zodiac: { label: '天秤座', emoji: '♎' },
  counts: { days: 1, certificates: 0, souvenirs: 0, graduations: 0 },
}
const kingForm = (patch = {}) => ({
  key: 'king', via: 'item', item: 'crown', hasItem: false, label: '猪猪王', emoji: '👑', art: 'pig-king', current: false, ready: false,
  requirements: [
    { key: 'level', label: '等级', have: 41, need: 40, met: true },
    { key: 'charm', label: '魅力', have: 12, need: 20, met: false },
  ],
  ...patch,
})
/** 恶魔猪 comes from a contract item and stays out of the 加冕 app. */
const devilForm = (patch = {}) => ({
  key: 'devil', via: 'item', item: 'contract', hasItem: false, label: '恶魔猪', emoji: '😈', art: 'pig-devil', current: false, ready: false,
  requirements: [
    { key: 'level', label: '等级', have: 40, need: 40, met: true },
    { key: 'plays', label: '本代玩耍', have: 20, need: 20, met: true },
  ],
  ...patch,
})

test('once crowned the card still says which form', async () => {
  const status = { ...SNAPSHOT, profile: PROFILE, forms: { current: 'king', forms: [kingForm({ current: true })] } }
  const { registration, dom } = await loadClient({ status })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom, 'card')
  assert.match(contentOf(dom).allText(), /形态：\s*👑 猪猪王/)
  assert.equal(findByAttr(contentOf(dom), 'data-form', 'king'), undefined, 'the card itself has no 加冕 block')
})

test('the 图鉴 tile sits next to 居民卡 and replaces the crown tile', async () => {
  const { registration, dom } = await loadClient({
    status: { ...SNAPSHOT, profile: PROFILE, forms: { current: null, forms: [kingForm({ ready: true, hasItem: true })] } },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom, 'home')
  const tile = findByAttr(contentOf(dom), 'data-app', 'dex')
  assert.notEqual(tile, undefined)
  assert.match(tile.allText(), /图鉴/)
  assert.equal(findByAttr(contentOf(dom), 'data-app', 'crown'), undefined)
})

// ===========================================================================
// 更新 App（桌面版）
// ===========================================================================

/** A fake desktop bridge: two versions on GitHub, the newer one installable. */
function fakeDesktop() {
  const calls = []
  const releases = [
    { version: '0.26.0', date: '2026-10-02', notes: '要新安装包', current: false, blocked: 'shell', minShell: '0.2.0', latestShell: '0.2.0', shellUpdate: true, page: 'https://github.com/CLICGGER-TYPES/dsh-piggy/releases/tag/v0.26.0', prerelease: false },
    { version: '0.25.0', date: '2026-10-01', notes: '加了更新', current: false, blocked: null, minShell: '0.1.0', page: 'p', prerelease: false },
    { version: '0.24.0', date: '2026-09-30', notes: '', current: true, blocked: null, minShell: '0.1.0', page: 'p', prerelease: false },
  ]
  const piggyShell = {
    setShape: () => {},
    openPage: url => { calls.push(['open', url]); return Promise.resolve() },
    updates: {
      current: () => Promise.resolve({ version: '0.24.0', bundled: true, bundledVersion: '0.24.0', shell: '0.1.0', previous: null }),
      list: () => Promise.resolve({ ok: true, releases }),
      install: version => { calls.push(['install', version]); return Promise.resolve({ ok: true, version }) },
      rollback: () => Promise.resolve({ ok: true }),
      onProgress: () => {},
    },
  }
  return { piggyShell, calls }
}

/** 更新入口收进了设置（G 批次）：设置 → 🔄 更新。 */
function openUpdate(dom) {
  openPanel(dom, 'settings')
  tap(dom, 'data-open-update', 'true')
}

test('DSH gets a notification-only 更新 app, while desktop keeps the updater', async () => {
  const plain = await loadClient({ latestRelease: {
    tag_name: 'v0.27.0', html_url: 'https://github.com/CLICGGER-TYPES/dsh-piggy/releases/tag/v0.27.0',
    body: '更新说明', draft: false, prerelease: false,
  } })
  plain.registration.factory(() => {}).apply({})
  await settle()
  openPanel(plain.dom, 'home')
  assert.equal(findByAttr(contentOf(plain.dom), 'data-app', 'update'), undefined, '主菜单不再有更新格子')
  tap(plain.dom, 'data-app', 'settings')
  tap(plain.dom, 'data-open-update', 'true')
  await settle()
  await settle()
  assert.match(contentOf(plain.dom).allText(), /只提醒新版本/)
  assert.match(contentOf(plain.dom).allText(), /v0\.27\.0/)
  assert.notEqual(findByAttr(contentOf(plain.dom), 'data-update-page', '0.27.0'), undefined)

  const { piggyShell } = fakeDesktop()
  const desk = await loadClient({ windowExtra: { piggyShell } })
  desk.registration.factory(() => {}).apply({})
  await settle()
  openPanel(desk.dom, 'settings')
  assert.notEqual(findByAttr(contentOf(desk.dom), 'data-open-update', 'true'), undefined)
})

test('the 更新 app offers the newest version it can install, and a newer installer opens its page', async () => {
  const { piggyShell, calls } = fakeDesktop()
  const { registration, dom } = await loadClient({ windowExtra: { piggyShell } })
  registration.factory(() => {}).apply({})
  await settle()
  openUpdate(dom)
  await settle()
  await settle()
  const latest = findByAttr(contentOf(dom), 'data-update-latest', '0.25.0')
  assert.notEqual(latest, undefined, contentOf(dom).allText())
  latest.fire('click')
  assert.deepEqual(calls.at(-1), ['install', '0.25.0'])
  await settle()
  tap(dom, 'data-release', '0.26.0')
  assert.match(contentOf(dom).allText(), /要求桌面外壳至少 v0\.2\.0/)
  tap(dom, 'data-update-install', '0.26.0')
  assert.equal(calls.at(-1)[0], 'open')
})

test('installed desktop downloads a newer shell, then offers a restart; game update stays separate', async () => {
  const { piggyShell, calls } = fakeDesktop()
  piggyShell.shellUpdates = {
    status: () => Promise.resolve({ mode: 'automatic', currentVersion: '0.1.0', readyVersion: null }),
    download: version => { calls.push(['shell-download', version]); return Promise.resolve({ ok: true, version }) },
    install: () => { calls.push(['shell-install']); return Promise.resolve({ ok: true }) },
    onProgress: () => {},
  }
  const { registration, dom } = await loadClient({ windowExtra: { piggyShell } })
  registration.factory(() => {}).apply({})
  await settle()
  openUpdate(dom)
  await settle()
  await settle()
  assert.match(contentOf(dom).allText(), /游戏 v0\.24\.0/)
  assert.match(contentOf(dom).allText(), /桌面外壳 v0\.1\.0 → v0\.2\.0/)
  tap(dom, 'data-update-shell', '0.26.0')
  assert.deepEqual(calls.at(-1), ['shell-download', '0.2.0'])
  await settle()
  assert.match(contentOf(dom).allText(), /重启并安装桌面外壳/)
  tap(dom, 'data-update-shell', '0.26.0')
  assert.deepEqual(calls.at(-1), ['shell-install'])
})

test('unsigned macOS desktop explains why its shell update opens the download page', async () => {
  const { piggyShell, calls } = fakeDesktop()
  piggyShell.shellUpdates = { status: () => Promise.resolve({ mode: 'unsigned-mac' }), onProgress: () => {} }
  const { registration, dom } = await loadClient({ windowExtra: { piggyShell } })
  registration.factory(() => {}).apply({})
  await settle()
  openUpdate(dom)
  await settle()
  await settle()
  assert.match(contentOf(dom).allText(), /macOS 包暂未签名/)
  tap(dom, 'data-update-shell', '0.26.0')
  assert.equal(calls.at(-1)[0], 'open')
})

test('the desktop app gets a 退出 tile that asks the shell to close, and DSH does not', async () => {
  const { piggyShell } = fakeDesktop()
  let quits = 0
  piggyShell.quit = () => { quits += 1; return Promise.resolve() }
  const { registration, dom } = await loadClient({ windowExtra: { piggyShell } })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom, 'home')
  tap(dom, 'data-app', 'quit')
  assert.equal(quits, 1)

  const plain = await loadClient()
  plain.registration.factory(() => {}).apply({})
  await settle()
  openPanel(plain.dom, 'home')
  assert.equal(findByAttr(contentOf(plain.dom), 'data-app', 'quit'), undefined)
})

test('both item-based forms are represented in the form data used by the dex', async () => {
  const { formsView, hatchEgg } = await import('../core.js')
  const { xpForLevel } = await import('../data.js')
  const state = hatchEgg(1_800_000_000_000)
  Object.assign(state, { xp: xpForLevel(40), traits: { intel: 0, strong: 20, charm: 20 }, happiness: 10 })
  state.stats.plays = 20
  const forms = formsView(state)
  assert.equal(forms.forms.find(form => form.key === 'devil').via, 'item')
  assert.equal(forms.forms.find(form => form.key === 'devil').item, 'contract')

  assert.equal(forms.forms.find(form => form.key === 'king').item, 'crown')
})

test('the 晋升 shelf in the bag shows 签约 and sends use', async () => {
  const contract = {
    key: 'contract', label: '恶魔契约', emoji: '😈', price: 6666, kind: 'promotion', tier: null, level: null,
    owned: false, worn: false, unlocked: true, useLabel: '签约', blurb: '签下变成恶魔猪', affordable: true, needed: false,
  }
  const { registration, dom, net } = await loadClient({
    status: { ...SNAPSHOT, profile: PROFILE, shop: [...SNAPSHOT.shop, contract], inventory: { ...SNAPSHOT.inventory, contract: 1 } },
  })
  registration.factory(() => {}).apply({})
  await settle()
  openPanel(dom)
  pickTab(dom, 'bag')
  const shelf = findByAttr(contentOf(dom), 'data-bag', 'promotion')
  assert.notEqual(shelf, undefined, 'the new shelf shows up in the bag')
  assert.match(shelf.allText(), /晋升/)

  tap(dom, 'data-bag', 'promotion')
  const tile = findByAttr(contentOf(dom), 'data-use', 'contract')
  assert.notEqual(tile, undefined)
  assert.match(tile.allText(), /恶魔契约.*签约/, 'the tile uses the item action label')
  tile.fire('click')
  await settle()
  await settle()
  const post = net.calls.find(call => call.method === 'POST' && JSON.parse(call.body).action === 'use')
  assert.deepEqual(JSON.parse(post.body), { action: 'use', item: 'contract' })
})

test('C3 promotion tiles keep their item action labels after the crown app is replaced', async () => {
  const crownItem = { key: 'crown', label: '王冠', emoji: '👑', price: 3000, kind: 'promotion', useLabel: '加冕', affordable: true }
  const contractItem = { key: 'contract', label: '恶魔契约', emoji: '😈', price: 6666, kind: 'promotion', useLabel: '签约', affordable: true }
  const forms = { current: null, forms: [kingForm({ via: 'item', item: 'crown', hasItem: false }), devilForm({ via: 'item', item: 'contract' })] }
  const status = { ...SNAPSHOT, forms, shop: [...SNAPSHOT.shop, crownItem, contractItem], inventory: { ...SNAPSHOT.inventory, crown: 0, contract: 1 } }
  const { registration, dom } = await loadClient({ status })
  registration.factory(() => {}).apply({})
  await settle()
  pickTab(dom, 'bag')
  tap(dom, 'data-bag', 'promotion')
  assert.match(findByAttr(contentOf(dom), 'data-use', 'contract').allText(), /签约/)
})

test('C3 transformation announcement creates one full-screen emoji effect and clears on dispose', async () => {
  const pending = [{ id: 1, kind: 'coronation', text: '加冕', at: Date.now() }]
  const { registration, dom } = await loadClient({ status: { ...SNAPSHOT, pending } })
  const dispose = registration.factory(() => {}).apply({})
  await settle()
  const overlay = findByClass(dom.body, 'dp-transform')
  assert.notEqual(overlay, undefined)
  assert.match(overlay.allText(), /👑/)
  assert.match(overlay.allText(), /✨/)
  dispose()
  assert.equal(findByClass(dom.body, 'dp-transform'), undefined)
})

test('更新面板按正式版分组：测试版折叠在对应正式版下，只能手动装，「更新到最新」不推测试版', async () => {
  const { piggyShell, calls } = fakeDesktop()
  const releases = [
    { version: '0.25.1-rc.1', date: '2026-10-03', notes: '', current: false, blocked: null, minShell: '0.1.0', page: 'p', prerelease: true },
    { version: '0.25.0-rc.2', date: '2026-09-30', notes: '', current: false, blocked: null, minShell: '0.1.0', page: 'p', prerelease: true },
    { version: '0.25.0', date: '2026-10-01', notes: '加了更新', current: false, blocked: null, minShell: '0.1.0', page: 'p', prerelease: false },
    { version: '0.24.0', date: '2026-09-30', notes: '', current: true, blocked: null, minShell: '0.1.0', page: 'p', prerelease: false },
  ]
  piggyShell.updates.list = () => Promise.resolve({ ok: true, releases })
  const { registration, dom } = await loadClient({ windowExtra: { piggyShell } })
  registration.factory(() => {}).apply({})
  await settle()
  openUpdate(dom)
  await settle()
  await settle()
  assert.equal(findByAttr(contentOf(dom), 'data-update-latest', '0.25.1-rc.1'), undefined, '不推荐测试版')
  assert.notEqual(findByAttr(contentOf(dom), 'data-update-latest', '0.25.0'), undefined)
  assert.notEqual(findByAttr(contentOf(dom), 'data-release-group', '0.25.0'), undefined)
  assert.notEqual(findByAttr(contentOf(dom), 'data-release-group', '0.25.1'), undefined, '还没发正式版的测试版自成一组')
  assert.equal(findByAttr(contentOf(dom), 'data-update-install', '0.25.0-rc.2'), undefined, '测试版默认折叠')
  tap(dom, 'data-release', '0.25.0')
  tap(dom, 'data-previews', '0.25.0')
  findByAttr(contentOf(dom), 'data-update-install', '0.25.0-rc.2').fire('click')
  assert.deepEqual(calls.at(-1), ['install', '0.25.0-rc.2'])
})
