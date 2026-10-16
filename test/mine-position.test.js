import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

import mine, { generateMap, hitsNeeded } from '../extensions/mine/server.js'
import { fakeDom } from './helpers/bundle.js'

const T0 = new Date(2026, 9, 16, 12).getTime()

function mineViewWithCrackedCell() {
  const data = mine.init()
  const target = (() => {
    for (let run = 0; run < 100; run += 1) {
      const map = generateMap(1, run, data.pickaxe)
      const index = map.findIndex((cell, at) => at >= 12 && hitsNeeded(cell.kind, data.pickaxe) > 1)
      if (index >= 0) return { run, index }
    }
    throw new Error('no multi-hit mine cell found')
  })()
  data.run = target.run
  data.maps[1] = { open: [0, 1, 2, 3, 4, 5, target.index - 6], hits: {} }
  const api = { now: T0, coins: () => 0, wallet: { currency: { label: '矿石币', emoji: '⛏️' }, balance: () => 0 }, exert() {}, emit() {} }
  assert.equal(mine.actions.dig(data, { cell: target.index }, api).ok, true)
  assert.equal(data.last.kind, 'crack')
  return { view: mine.view(data, api), index: target.index }
}

function renderMine(view) {
  const dom = fakeDom()
  dom.document.getElementById = () => null
  let render
  const window = { dshPiggyExtensions: { register(_key, implementation) { render = implementation.render } } }
  runInNewContext(readFileSync(new URL('../extensions/mine/client.js', import.meta.url), 'utf8'), { window, document: dom.document, Date })
  const app = {
    data: view,
    content: dom.body,
    el(tag, className, label) {
      const node = dom.document.createElement(tag)
      node.className = className ?? ''
      if (label !== undefined) node.textContent = label
      return node
    },
    button(className, attrs, onClick) {
      const node = this.el('button', className)
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
      node.addEventListener('click', onClick)
      return node
    },
    send() {},
  }
  render(app)
  const pigCells = []
  dom.body.walk(node => {
    if (node.children.some(child => child.className === 'mn-pig')) pigCells.push(Number(node.getAttribute('data-mine-cell')))
  })
  return pigCells
}

test('多次敲击期间，小猪站在正在敲的裂纹石块上', () => {
  const { view, index } = mineViewWithCrackedCell()
  assert.deepEqual(renderMine(view), [index])
})
