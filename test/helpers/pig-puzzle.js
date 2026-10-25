// 藏猪方块测试挂具：独立穷举求解器（不复用 server 的 solve/提示）和假 DOM 客户端。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import puzzle from '../../extensions/pig-puzzle/server.js'
import { fakeDom } from './bundle.js'

export const ROOT = new URL('../../extensions/pig-puzzle/', import.meta.url)
export const api = (now = Date.UTC(2026, 9, 22, 12)) => ({ now, coins: () => 0 })
export const fresh = () => puzzle.init()
export const plain = value => JSON.parse(JSON.stringify(value))

/** 独立穷举：固定猪必须用上、排除格不能用；返回所有完整解（每行一只的排列）。 */
export function bruteSolutions(level, fixed = [], excluded = []) {
  const size = level.size
  const fixedCol = new Map(fixed.map(cell => [Math.floor(cell / size), cell % size]))
  const blocked = new Set(excluded)
  const solutions = []
  const cols = Array(size).fill(-1)
  const usedCol = new Set()
  const usedRegion = new Set()
  function walk(row) {
    if (row === size) { solutions.push(cols.map((col, index) => index * size + col)); return }
    const options = fixedCol.has(row) ? [fixedCol.get(row)] : Array.from({ length: size }, (_, col) => col)
    for (const col of options) {
      const cell = row * size + col
      if (blocked.has(cell) || usedCol.has(col) || usedRegion.has(level.region[cell])) continue
      if (row > 0 && Math.abs(cols[row - 1] - col) < 2) continue
      usedCol.add(col)
      usedRegion.add(level.region[cell])
      cols[row] = col
      walk(row + 1)
      usedCol.delete(col)
      usedRegion.delete(level.region[cell])
      cols[row] = -1
    }
  }
  walk(0)
  return solutions
}

/** 颜色区正交连通。 */
export function regionConnected(level, color) {
  const cells = level.region.map((value, cell) => value === color ? cell : -1).filter(cell => cell >= 0)
  if (cells.length === 0) return false
  const set = new Set(cells)
  const seen = new Set([cells[0]])
  const queue = [cells[0]]
  while (queue.length > 0) {
    const at = queue.shift()
    const row = Math.floor(at / level.size)
    const col = at % level.size
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const rr = row + dr
      const cc = col + dc
      if (rr < 0 || cc < 0 || rr >= level.size || cc >= level.size) continue
      const next = rr * level.size + cc
      if (set.has(next) && !seen.has(next)) { seen.add(next); queue.push(next) }
    }
  }
  return seen.size === set.size
}

export function boardOf(data) {
  return data.board ?? { pigs: [], excluded: [] }
}

export function pigsOf(data) {
  return [...(data.board?.pigs ?? [])].sort((a, b) => a - b)
}

/** 假 DOM：按真实路径发 pointerdown/pointerup/click，动作交给真 server。 */
export function mount(data, account = api(), options = {}) {
  const dom = fakeDom()
  const create = dom.document.createElement
  dom.document.createElement = tag => {
    const node = create(tag)
    node.focus = () => { dom.document.activeElement = node }
    return node
  }
  let render = null
  const windowListeners = {}
  const window = {
    dshPiggyExtensions: { register(key, impl) { assert.equal(key, 'pig-puzzle'); render = impl.render } },
    addEventListener(name, fn) { (windowListeners[name] ??= []).push(fn) },
    removeEventListener(name, fn) { windowListeners[name] = (windowListeners[name] ?? []).filter(entry => entry !== fn) },
  }
  runInNewContext(readFileSync(new URL('client.js', ROOT), 'utf8'), { window, document: dom.document, Date, setTimeout, clearTimeout })
  const sent = []
  const app = {
    data: puzzle.view(data, account),
    content: dom.body,
    el(tag, className, label) {
      const node = dom.document.createElement(tag)
      node.className = className ?? ''
      if (label !== undefined) node.textContent = label
      return node
    },
    button(className, attrs, onClick) {
      const node = this.el('button', className)
      for (const [name, value] of Object.entries(attrs ?? {})) node.setAttribute(name, value)
      if (onClick) node.addEventListener('click', onClick)
      return node
    },
    asset(name) { return '/dsh-piggy/ext/pig-puzzle/assets/' + name },
    send(op, payload) { sent.push({ op, payload: payload ?? {} }) },
    rerender() { dom.body.children.length = 0; options.beforeRender?.(dom, app); render(app) },
  }
  options.beforeRender?.(dom, app)
  render(app)
  const find = (attr, key) => {
    let found
    dom.body.walk(node => { if (node.getAttribute(attr) === key) found = node })
    return found
  }
  const all = attr => {
    const out = []
    dom.body.walk(node => { if (node.getAttribute(attr) !== null && node.getAttribute(attr) !== undefined) out.push(node) })
    return out
  }
  const mount = {
    dom, app, sent, find, all, windowListeners,
    text: () => dom.body.allText(),
    fireDocument(name, event = {}) {
      for (const fn of dom.documentListeners[name] ?? []) fn({ preventDefault() {}, ...event })
    },
    fireWindow(name, event = {}) {
      for (const fn of windowListeners[name] ?? []) fn({ preventDefault() {}, ...event })
    },
    refresh() { app.data = puzzle.view(data, account); app.rerender() },
    act(op, payload) { const result = puzzle.actions[op](data, payload ?? {}, account); this.refresh(); return result },
    applyLast() { const last = sent.at(-1); return this.act(last.op, last.payload) },
    leftClick(cell) {
      const node = this.find('data-cell', String(cell))
      node.fire('pointerdown', { button: 0, pointerType: 'mouse' })
      node.fire('pointerup')
      node.fire('click', { detail: 1 })
      const last = sent.at(-1)
      assert.equal(last.op, 'tap')
      assert.deepEqual(plain(last.payload), { cell, mode: 'pig' })
      return this.applyLast()
    },
    rightClick(cell) {
      const node = this.find('data-cell', String(cell))
      node.fire('pointerdown', { button: 2, pointerType: 'mouse' })
      node.fire('pointerup')
      const last = sent.at(-1)
      assert.equal(last.op, 'tap')
      assert.deepEqual(plain(last.payload), { cell, mode: 'exclude' })
      return this.applyLast()
    },
    touchClick(cell) {
      const node = this.find('data-cell', String(cell))
      node.fire('pointerdown', { button: 0, pointerType: 'touch' })
      node.fire('pointerup')
      node.fire('click', { detail: 1 })
      const last = sent.at(-1)
      assert.equal(last.op, 'tap')
      return this.applyLast()
    },
  }
  return mount
}

export const pending = (m, cell) => m.find('data-cell', String(cell)).getAttribute('data-pending')
