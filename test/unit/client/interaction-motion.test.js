import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SNAPSHOT, contentOf, findByAttr, mount, openPanel, settle } from '../../helpers/bundle.js'

test('opening an App and buying an item give short, interruptible feedback', async () => {
  const status = { ...SNAPSHOT, shop: [{ key: 'apple', label: '苹果', emoji: '🍎', price: 6, kind: 'food', affordable: true }] }
  const { dom } = await mount({ status })
  const animations = []
  dom.FakeElement.prototype.animate = function (frames, options) {
    animations.push({ node: this, frames, options })
    return { cancel() {} }
  }
  window.matchMedia = () => ({ matches: false })
  openPanel(dom)
  findByAttr(contentOf(dom), 'data-app', 'shop').fire('click')
  assert.equal(animations.some(entry => entry.node === contentOf(dom)), true, 'the App content enters once')

  findByAttr(contentOf(dom), 'data-shelf', 'food').fire('click')
  findByAttr(contentOf(dom), 'data-buy', 'apple').fire('click')
  await settle()
  await settle()
  assert.equal(animations.some(entry => entry.node.getAttribute('data-buy') === 'apple'), true, 'the purchased item acknowledges success')
})

test('reduced motion skips interaction animations', async () => {
  const { dom } = await mount()
  let count = 0
  dom.FakeElement.prototype.animate = function () { count += 1; return { cancel() {} } }
  window.matchMedia = () => ({ matches: true })
  openPanel(dom)
  findByAttr(contentOf(dom), 'data-app', 'shop').fire('click')
  assert.equal(count, 0)
})

test('returning from a long App opens the home screen at its top', async () => {
  const { dom } = await mount()
  openPanel(dom, 'shop')
  const content = contentOf(dom)
  content.scrollTop = 400
  findByAttr(content, 'data-home', 'true').fire('click')
  assert.equal(content.scrollTop, 0)
})
