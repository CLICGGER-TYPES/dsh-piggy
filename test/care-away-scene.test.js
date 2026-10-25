// @ts-check
/** 外出时喂食/清洁的即时反馈不能把活动立绘换成在家做照料的反应图。 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { createEffects } from '../src/client/effects.js'

class Node {
  constructor() {
    this.attributes = {}
    this.children = []
    this.hidden = false
    this.style = { setProperty() {} }
    this.offsetWidth = 0
  }
  getAttribute(name) { return this.attributes[name] ?? null }
  setAttribute(name, value) { this.attributes[name] = String(value) }
  removeAttribute(name) { delete this.attributes[name] }
  appendChild(child) { this.children.push(child); return child }
  getBoundingClientRect() { return { left: 0, top: 0, width: 40, height: 40 } }
  remove() {}
}

function effectsWith(isAway) {
  globalThis.window = {
    setTimeout: () => 1,
    clearTimeout: () => {},
  }
  const pig = new Node()
  const pigArt = new Node()
  const pigEmoji = new Node()
  const deps = {
    scene: new Node(), pig, pigArt, pigEmoji, card: new Node(), bubble: new Node(),
    isStopped: () => false, isAway,
  }
  return { pig, effects: createEffects(deps) }
}

test('feeding while away leaves the ongoing activity pose alone', () => {
  const { pig, effects } = effectsWith(() => true)
  pig.setAttribute('data-activity', 'work')
  effects.flash('feed', { item: 'apple' })
  assert.equal(pig.getAttribute('data-react'), null, 'no care reaction may replace the work pose')
  assert.equal(pig.getAttribute('data-activity'), 'work')
})

test('feeding at home still plays its own reaction', () => {
  const { pig, effects } = effectsWith(() => false)
  effects.flash('feed', { item: 'apple' })
  assert.equal(pig.getAttribute('data-react'), 'feed')
})

test('the shell wires the away state into the feedback layer', async () => {
  const source = await readFile(new URL('../src/client/index.js', import.meta.url), 'utf8')
  assert.match(source, /isAway: function \(\) \{ return view\.activity !== null \}/)
})
