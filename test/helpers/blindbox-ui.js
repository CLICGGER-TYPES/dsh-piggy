import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { fakeDom } from './bundle.js'

const SOURCE = readFileSync(new URL('../../extensions/blindbox/client.js', import.meta.url), 'utf8')

/** 用 fakeDom 跑扩展的 client.js；clock 控制 Date.now()，便于验证「轮询不重播」。 */
export function harness(view, options = {}) {
  const dom = fakeDom()
  dom.document.getElementById = id => dom.head.children.find(node => node.id === id) || null
  const clock = { t: options.startAt ?? 0 }
  const pending = new Map()
  const observers = []
  let render = null
  let timerId = 0
  const window = {
    dshPiggyExtensions: { register(_key, impl) { render = impl.render } },
    matchMedia: query => ({ matches: options.reducedMotion === true && /prefers-reduced-motion/.test(String(query)) }),
    getComputedStyle: node => ({
      marginTop: node?.style?.marginTop || '0px',
      marginBottom: node?.style?.marginBottom || '0px',
    }),
  }
  if (options.panelHeight !== undefined) dom.body.style.setProperty('--ext-panel-height', options.panelHeight + 'px')
  if (options.walletHeight !== undefined) {
    const wallet = dom.document.createElement('div')
    wallet.className = 'dp-wallet'
    wallet.setAttribute('data-test-fixture', '1')
    wallet.offsetHeight = options.walletHeight
    wallet.style.marginBottom = (options.walletMargin ?? 0) + 'px'
    dom.body.appendChild(wallet)
  }
  if (options.observe === true) {
    window.MutationObserver = class {
      constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this) }
      observe() {}
      disconnect() { this.disconnected = true }
      ping() { this.callback() }
    }
  }
  runInNewContext(SOURCE, {
    window,
    document: dom.document,
    Date: { now: () => clock.t },
    setTimeout: (fn, ms) => { timerId += 1; pending.set(timerId, { fn, ms }); return timerId },
    clearTimeout: id => { pending.delete(id) },
  })
  const sent = []
  let dex = 0
  const app = {
    data: view,
    content: dom.body,
    mode: options.mode ?? 'panel',
    el(tag, className, text) {
      const node = dom.document.createElement(tag)
      node.querySelector = selector => node.querySelectorAll(selector)[0] || null
      if (className) node.className = className
      if (text !== undefined) node.textContent = text
      return node
    },
    button(className, attrs, onClick) {
      const node = this.el('button', className)
      node.type = 'button'
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
      node.addEventListener('click', event => onClick(event))
      return node
    },
    send(op, payload) { sent.push({ op, payload }); return options.sendResult?.() },
    rerender() { for (const child of [...dom.body.children]) if (child.getAttribute('data-test-fixture') !== '1') child.remove(); render(app) },
    openDex() { dex += 1 },
    ...(options.openBig === false ? {} : { openBig() { options.onBig?.() } }),
    ...(options.mode === 'big' ? { closeBig() { options.onClose?.() } } : {}),
  }
  render(app)
  const find = (attr, value) => { let found; dom.body.walk(node => { if (node.getAttribute(attr) === value) found = node }); return found }
  const all = attr => { const out = []; dom.body.walk(node => { if (node.getAttribute(attr) !== null) out.push(node) }); return out }
  return {
    dom, app, sent, pending, clock, observers, find, all,
    settled: () => { const draw = all('data-settled')[0]; return draw ? draw.getAttribute('data-settled') : null },
    show: next => { app.data = next; app.rerender() },
    text: () => dom.body.allText(),
    rerender: () => app.rerender(),
    click: (attr, value) => { const node = find(attr, value); assert.ok(node, '找不到 ' + attr + '=' + value); node.fire('click'); return node },
    dex: () => dex,
  }
}

/** 打开一次（直接走 server 事务，不经过按钮），返回渲染用的 view。 */
