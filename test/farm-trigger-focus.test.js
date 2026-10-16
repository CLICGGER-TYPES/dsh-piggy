import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'

import { preserveFarmTriggerFocus } from '../src/client/farm-trigger-focus.js'

const panel = readFileSync(new URL('../src/client/panel.js', import.meta.url), 'utf8')
const renderSource = panel.slice(panel.indexOf('function renderContent()'), panel.indexOf('function paintContent()'))

function fixture(initial, paint, focusedInside = true) {
  const doc = { body: { tagName: 'BODY' }, activeElement: initial }
  const content = {
    ownerDocument: doc, scrollTop: 0, children: focusedInside ? [initial] : [],
    contains(node) { return this.children.includes(node) },
    querySelectorAll(selector) {
      if (selector === '[data-scroll-key]') return []
      return this.children.filter(node => node.matches(selector))
    },
  }
  if (focusedInside) initial.parentNode = content
  const ctx = { content, justBought: 'radish' }
  const render = runInNewContext('(' + renderSource + ')', {
    ctx, paintContent: () => {
      const active = doc.activeElement, losesFocus = content.contains(active)
      for (const node of content.children) node.parentNode = null
      content.children = paint(content, doc)
      content.children.forEach(node => { node.parentNode = content })
      if (losesFocus && doc.activeElement === active) doc.activeElement = doc.body
    },
    renderHold: { defer: () => false }, restoreHover() {}, preserveFarmTriggerFocus,
  })
  return { content, doc, ctx, render }
}

function node(doc, attrs = {}, tagName = 'BUTTON') {
  return {
    tagName, attrs, disabled: false, focusOptions: null,
    getAttribute(name) { return this.attrs[name] ?? null },
    matches(selector) {
      return selector.split(',').some(part => {
        const attr = /^\[([^\]]+)\]$/.exec(part.trim())
        return attr ? this.getAttribute(attr[1]) !== null : this.tagName.toLowerCase() === part.trim()
      })
    },
    focus(options) { this.focusOptions = options; doc.activeElement = this },
  }
}

test('panel polling keeps the returned farm item focused through DOM replacement', () => {
  const oldItem = { getAttribute: () => 'radish' }
  oldItem.attrs = { 'data-farm-item': 'radish' }
  const nextItem = node(null, { 'data-farm-item': 'radish' })
  const ui = fixture(oldItem, () => [nextItem])
  nextItem.focus = options => { nextItem.focusOptions = options; ui.doc.activeElement = nextItem }
  ui.render()
  assert.equal(ui.doc.activeElement, nextItem)
  assert.deepEqual(nextItem.focusOptions, { preventScroll: true })
})

test('panel polling restores farm plot keys, but leaves a newly focused modal control alone', () => {
  const oldPlot = node(null, { 'data-farm-plot': '7' })
  const nextPlot = node(null, { 'data-farm-plot': '7' })
  const plotUi = fixture(oldPlot, () => [nextPlot]); nextPlot.focus = options => { nextPlot.focusOptions = options; plotUi.doc.activeElement = nextPlot }
  plotUi.render()
  assert.equal(plotUi.doc.activeElement, nextPlot)
  assert.deepEqual(nextPlot.focusOptions, { preventScroll: true })

  const oldItem = node(null, { 'data-farm-item': 'radish' })
  const modalInput = node(null, {}, 'INPUT')
  const modalUi = fixture(oldItem, (content, doc) => { doc.activeElement = modalInput; return [node(doc, { 'data-farm-item': 'radish' }), modalInput] })
  modalUi.render()
  assert.equal(modalUi.doc.activeElement, modalInput)
})

test('panel polling does not capture other controls and skips missing or disabled farm triggers', () => {
  const outside = node(null, {}, 'INPUT')
  const outsideUi = fixture(outside, (_content, doc) => { doc.activeElement = outside; return [] }, false)
  outsideUi.render()
  assert.equal(outsideUi.doc.activeElement, outside)

  const oldFarmItem = node(null, { 'data-farm-item': 'radish' }), hostControl = node(null, {}, 'INPUT')
  const transferredUi = fixture(oldFarmItem, (_content, doc) => { doc.activeElement = hostControl; return [node(doc, { 'data-farm-item': 'radish' })] })
  transferredUi.render()
  assert.equal(transferredUi.doc.activeElement, hostControl, 'paint 将焦点交给宿主其他控件时不能抢回农场按钮')

  const oldItem = node(null, { 'data-farm-item': 'radish' })
  const missingUi = fixture(oldItem, () => [])
  missingUi.render()
  assert.equal(missingUi.doc.activeElement, missingUi.doc.body)

  const disabledItem = node(null, { 'data-farm-item': 'radish' }); disabledItem.disabled = true
  const disabledUi = fixture(oldItem, () => [disabledItem])
  disabledUi.render()
  assert.equal(disabledUi.doc.activeElement, disabledUi.doc.body)
  assert.equal(disabledItem.focusOptions, null)

  const nonButton = node(null, { 'data-farm-item': 'radish' }, 'DIV')
  const nonButtonUi = fixture(oldItem, () => [nonButton])
  nonButtonUi.render()
  assert.equal(nonButtonUi.doc.activeElement, nonButtonUi.doc.body)
  assert.equal(nonButton.focusOptions, null)
})
