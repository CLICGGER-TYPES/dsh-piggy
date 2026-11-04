import assert from 'node:assert/strict'
import { test } from 'node:test'

globalThis.window = globalThis.window ?? { matchMedia: () => ({ matches: false }) }
const { animatePanelClose, animatePanelOpen } = await import('../../../src/client/interaction-motion.js')

function fakeNode(extra = {}) {
  const attrs = new Map()
  const node = {
    hidden: false, style: {}, offsetTop: 10, offsetLeft: 20, offsetWidth: 292, offsetHeight: 400, animations: [],
    setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: k => (attrs.has(k) ? attrs.get(k) : null),
    animate(frames, options) { const a = { frames, options, onfinish: null }; node.animations.push(a); return a },
    remove() { node.removed = true },
    ...extra,
  }
  return node
}

test('打开面板：面板和名牌从猪那一角淡入（朝上开从下角长出来）', () => {
  const card = fakeNode({ style: { top: 'auto' } })
  const hud = fakeNode()
  const host = fakeNode({ style: { right: '16px', bottom: '16px' } })
  animatePanelOpen({ card, hud, host })
  assert.equal(card.animations.length, 1)
  assert.equal(card.animations[0].frames[0].opacity, 0)
  assert.equal(card.style.transformOrigin, 'bottom right')
  assert.equal(hud.animations.length, 1)
})

test('收起面板：原位放一个不可点的残影淡出，按宿主钉住的边定位', () => {
  const inserted = []
  const parent = { insertBefore: (node) => inserted.push(node) }
  const ghostOf = () => fakeNode()
  const card = fakeNode({ parentNode: parent, nextSibling: null, cloneNode: ghostOf })
  const hud = fakeNode({ parentNode: parent, nextSibling: null, cloneNode: ghostOf })
  const host = fakeNode({ style: { right: '16px', bottom: '16px', top: 'auto', left: 'auto' }, offsetWidth: 292, offsetHeight: 600 })
  animatePanelClose({ card, hud, host })
  assert.equal(inserted.length, 2)
  const ghost = inserted[0]
  assert.equal(ghost.getAttribute('data-ghost'), 'true')
  assert.equal(ghost.style.pointerEvents, 'none')
  assert.equal(ghost.style.top, 'auto')
  assert.equal(ghost.style.bottom, (600 - 10 - 400) + 'px')
  assert.equal(ghost.animations[0].frames[1].opacity, 0)
})

test('系统开了「减少动态效果」就不播', () => {
  const before = globalThis.window.matchMedia
  globalThis.window.matchMedia = () => ({ matches: true })
  const card = fakeNode()
  animatePanelOpen({ card, hud: null, host: fakeNode({ style: {} }) })
  assert.equal(card.animations.length, 0)
  globalThis.window.matchMedia = before
})
