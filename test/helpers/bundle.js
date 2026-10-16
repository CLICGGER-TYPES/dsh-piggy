/**
 * 挂载 DSH 客户端的公共测试挂具（C1 起）：假 DOM + 假 window/fetch，
 * 把构建出来的 client.js 当浏览器那样跑起来。
 *
 * 从 test/dev-coverage.test.js 里抽出来，番茄钟等界面测试共用。
 */

import assert from 'node:assert/strict'

import { FORMS } from '../../packages/pet-core/src/data/evolution.js'
import { lifeStageByKey } from '../../packages/pet-core/src/data/life.js'

export function fakeDom() {
  const documentListeners = {}
  class FakeElement {
    constructor(tag) {
      this.tagName = tag
      this.children = []
      this.attributes = {}
      this.listeners = {}
      this.className = ''
      this.hidden = false
      this.disabled = false
      this.style = {
        setProperty(name, value) { this[name] = String(value) },
        getPropertyValue(name) { return this[name] ?? '' },
        removeProperty(name) { delete this[name] },
      }
      this.parentNode = null
      this.scrollTop = 0
      this.rect = { width: 70, height: 62, top: 0, left: 0, right: 0, bottom: 0 }
    }

    get textContent() { return this._text ?? '' }
    set textContent(value) {
      this._text = String(value)
      // A real element drops its children when textContent is assigned; a repaint
      // starts with exactly that, so keeping stale nodes would make "find the
      // first match" read a dropped element.
      for (const child of this.children) child.parentNode = null
      this.children = []
    }

    appendChild(child) { child.parentNode = this; this.children.push(child); return child }
    contains(other) {
      for (let node = other; node; node = node.parentNode) if (node === this) return true
      return false
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
    removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] ?? []).filter(entry => entry !== fn) }
    setPointerCapture() {}
    get src() { return this.getAttribute('src') || '' }
    set src(value) { this.setAttribute('src', value) }
    matches(selector) {
      return selector.split(',').some(part => part.startsWith('.')
        ? this.className.split(/\s+/).includes(part.slice(1)) : this.tagName === part)
    }
    querySelectorAll(selector) {
      const found = []
      for (const child of this.children) child.walk(node => { if (node.matches(selector)) found.push(node) })
      return found
    }
    querySelector() { return null }
    getBoundingClientRect() { return this.rect }

    fire(name, event = {}) {
      for (const fn of this.listeners[name] ?? []) {
        fn.call(this, { stopPropagation() {}, preventDefault() {}, ...event })
      }
    }

    /** 真元素上就有 click()；下载兜底会用 <a>.click()。 */
    click() { this.fire('click') }

    allText() { return [this.textContent, ...this.children.map(c => c.allText())].join(' ') }
    walk(visit) { visit(this); for (const child of this.children) child.walk(visit) }
  }

  const head = new FakeElement('head')
  const body = new FakeElement('body')
  const document = {
    head,
    body,
    createElement: tag => new FakeElement(tag),
    createElementNS: (ns, tag) => new FakeElement(tag),
    querySelector: () => null,
    addEventListener: (name, fn) => { (documentListeners[name] ??= []).push(fn) },
    removeEventListener: (name, fn) => {
      if (documentListeners[name]) documentListeners[name] = documentListeners[name].filter(entry => entry !== fn)
    },
  }
  return { document, head, body, FakeElement, documentListeners }
}

/** 形态所在阶段的起始等级，测试里从数据表取（和宿主同源，不写死数字）。 */
const LIFE_FROM_LEVEL = Object.fromEntries(FORMS.map(form => [form.stage, lifeStageByKey(form.stage).fromLevel]))

export const PIG = {
  name: '大花',
  stage: { key: 'middle', label: '中年猪', emoji: '🐖', size: 62, line: '很有分量' },
  ageLabel: '4 天大', daysToNextStage: 3, soul: false,
  mood: 'happy', moodEmoji: '❤️', moodLabel: '很开心',
  satiety: 62, happiness: 74, cleanliness: 41,
  health: 4, healthPercent: 80,
  weight: '8.4 kg', xp: 168, xpToNext: 232, coins: 88,
  levelInfo: { level: 2, percent: 12, toNext: 30, maxed: false, title: { label: '新来的', emoji: '🌱' } },
  traits: { intel: 5, charm: 3, strong: 2 },
  courses: { chinese: 2 }, souvenirs: ['贝壳', '松果'],
  illness: null, stageLine: '圆滚滚的，走路会晃',
  memories: [],
}

export const SNAPSHOT = {
  ok: true, hatched: true, dead: false, pig: PIG, version: '0.25.0',
  actions: {
    feed: { ready: true, waitSeconds: 0, blocked: null },
    bathe: { ready: true, waitSeconds: 0, blocked: null },
    play: { ready: true, waitSeconds: 0, blocked: null },
    pet: { ready: true, waitSeconds: 0, blocked: null },
  },
  jobs: [], subjects: [], stages: [], trips: [], shop: [], inventory: {},
  activity: null, canGoOut: true, awayBlocked: null, pending: [],
  reviveItem: 'soul', maxHealth: 5,
  daily: { canSignIn: false, signInDay: 1, signInTotal: 0, cycle: 12, unclaimed: 0, onlineMinutes: 0 },
  diary: [],
  forms: {
    current: null,
    forms: FORMS.map(form => ({
      key: form.key, label: form.label, emoji: form.emoji, art: form.art,
      stage: form.stage,
      fromLevel: lifeStageByKey(form.stage).fromLevel,
      current: false, ready: false, requirements: [],
    })),
  },
}

let loadCount = 0

/** Mount the shipped bundle in the fake DOM. */
export async function mount(options = {}) {
  const dom = fakeDom()
  const store = new Map(Object.entries(options.store ?? {}))
  const calls = []
  const intervals = []
  const windowListeners = {}

  globalThis.window = {
    __ModuleLoader__: { load: () => {} },
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)) },
      removeItem: key => { store.delete(key) },
    },
    setInterval: (fn, delay) => { intervals.push({ fn, delay }); return intervals.length },
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: (name, fn) => { (windowListeners[name] ??= []).push(fn) },
    dispatchEvent: event => { for (const fn of windowListeners[event.type] ?? []) fn(event) },
    removeEventListener: (name, fn) => {
      const list = windowListeners[name]
      if (list) windowListeners[name] = list.filter(entry => entry !== fn)
    },
  }
  // Extra window globals, e.g. the desktop shell seam (apps/desktop).
  Object.assign(globalThis.window, options?.windowExtra ?? {})
  globalThis.MutationObserver = class { observe() {} disconnect() {} }
  globalThis.document = dom.document
  // 字体：自带 emoji 的开关按 document.fonts 里有没有 'Piggy Emoji' 决定。
  if (options?.fonts !== undefined) {
    dom.document.fonts = { forEach: fn => options.fonts.forEach(face => fn(typeof face === 'string' ? { family: face } : face)) }
  }
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, method: opts?.method ?? 'GET', body: opts?.body })
    if (String(url).includes('/extensions/online') && options.onlineResponse) return { ok: true, status: 200, async json() { return options.onlineResponse } }
    // 日志导出：返回纯文本那一份（设置 → 日志 → 导出）。
    if (String(url).includes('/dsh-piggy/logs/export') && options.exportText !== undefined) {
      return { ok: true, status: 200, async text() { return options.exportText } }
    }
    const payload = (opts?.method ?? 'GET') === 'POST' ? (options.actResult ?? options.status ?? SNAPSHOT) : (options.status ?? SNAPSHOT)
    return { ok: true, status: 200, async json() { return payload } }
  }
  globalThis.getComputedStyle = element => ({
    right: element?.style?.right || '18px',
    bottom: element?.style?.bottom || '18px',
  })

  let registration = null
  globalThis.window.__ModuleLoader__ = { load: entry => { registration = entry } }
  const url = new URL('../../client.js', import.meta.url)
  loadCount += 1
  url.searchParams.set('t', String(loadCount))
  await import(url.href)
  registration.factory(() => {}).apply({})
  await settle()
  return { dom, store, calls, intervals, windowListeners, documentListeners: dom.documentListeners, registration }
}

export const settle = () => new Promise(resolve => setImmediate(resolve))

export const hostOf = dom => {
  const found = []
  dom.body.walk(node => { if (node.attributes?.['data-dsh-pig'] !== undefined) found.push(node) })
  return found[0]
}
export const sceneOf = dom => hostOf(dom).children[1]
export const contentOf = dom => hostOf(dom).children[0].children[0]

export const findByAttr = (root, attr, value) => {
  const found = []
  root.walk(node => { if (node.attributes?.[attr] === value) found.push(node) })
  return found[0]
}
export const findByClass = (root, className) => {
  const found = []
  root.walk(node => {
    if (typeof node.className === 'string' && node.className.split(/\s+/).includes(className)) found.push(node)
  })
  return found[0]
}

/** 打开面板（右键＝菜单），主屏就是第一屏。 */
export function openPanel(dom, app = 'home') {
  // 右键＝菜单，打开面板先落在主屏；指定 App 就再点一下它的方块。
  sceneOf(dom).fire('contextmenu', { preventDefault() {} })
  if (app === 'home') return
  findByAttr(contentOf(dom), 'data-app', app).fire('click')
}

/** 点一次版本号。 */
export function tapVersion(dom) {
  const line = findByAttr(contentOf(dom), 'data-version', 'true')
  assert.notEqual(line, undefined, `主屏上没有版本号：${contentOf(dom).allText().slice(0, 120)}`)
  line.fire('click')
}
