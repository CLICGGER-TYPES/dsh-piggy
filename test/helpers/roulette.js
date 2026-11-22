// 左轮轮盘面板测试挂具：用仓库里的假 DOM 跑真正的 extensions/roulette/client.js。
// app.send 直接调用扩展服务端 actions，app.data 用 view 回吐，测试的是真实规则。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import roulette from '../../extensions/roulette/server.js'
import { fakeDom } from './bundle.js'

export const CLIENT_URL = new URL('../../extensions/roulette/client.js', import.meta.url)

export function mountRoulette(options = {}) {
  const dom = fakeDom()
  const timers = []
  let nextTimer = 0
  let render = null

  function setTimeoutFake(fn, ms) {
    nextTimer += 1
    timers.push({ id: nextTimer, fn, ms, canceled: false })
    return nextTimer
  }
  function clearTimeoutFake(id) {
    const task = timers.find(entry => entry.id === id)
    if (task) task.canceled = true
  }

  const math = Object.assign(Object.create(Math), { random: () => 0.5 })
  const window = {
    dshPiggyExtensions: {
      register(key, impl) {
        assert.equal(key, 'roulette')
        render = impl.render
      },
    },
  }
  runInNewContext(readFileSync(CLIENT_URL, 'utf8'), {
    window,
    document: dom.document,
    Date,
    Math: math,
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake,
  })
  assert.equal(typeof render, 'function', 'client.js 应该注册 roulette 的 render')

  const data = roulette.init()
  const wallet = { coins: options.coins ?? 12500, spent: {} }
  const random = options.random ?? (() => 0.5)
  const api = {
    now: 0,
    coins: () => wallet.coins,
    spend(n, sink = 'spend') {
      const amount = Math.max(0, Math.floor(Number(n) || 0))
      if (wallet.coins < amount) return false
      wallet.coins -= amount
      wallet.spent[sink] = (wallet.spent[sink] ?? 0) + amount
      return true
    },
    earn(n) {
      const amount = Math.min(Math.max(0, Math.floor(Number(n) || 0)), 1000000)
      wallet.coins += amount
      return amount
    },
    refund(n, sink = 'refund') {
      const have = wallet.spent[sink] ?? 0
      const real = Math.min(Math.max(0, Math.floor(Number(n) || 0)), have)
      if (real <= 0) return 0
      wallet.coins += real
      wallet.spent[sink] = have - real
      return real
    },
  }

  const app = {
    data: roulette.view(data, api),
    content: dom.body,
    el(tag, className, text) {
      const node = dom.document.createElement(tag)
      if (className) node.className = className
      if (text !== undefined) node.textContent = text
      return node
    },
    button(className, attrs, onClick) {
      const node = this.el('button', className)
      for (const [name, value] of Object.entries(attrs ?? {})) node.setAttribute(name, value)
      if (onClick) node.addEventListener('click', onClick)
      return node
    },
    asset(name) {
      return '/dsh-piggy/ext/roulette/assets/' + name
    },
    pigArt() {
      return null
    },
    send(op, payload) {
      const handler = roulette.actions[op]
      assert.ok(handler, '未知动作 ' + op)
      handler(data, payload ?? {}, api, random)
      app.data = roulette.view(data, api)
    },
    rerender() {
      dom.body.children.length = 0
      render(app)
    },
  }

  function walk(visit) {
    dom.body.walk(visit)
  }
  function find(attr, key) {
    let found = null
    walk(node => {
      if (found === null && node.getAttribute(attr) === key) found = node
    })
    return found
  }
  function all(attr) {
    const out = []
    walk(node => {
      if (node.getAttribute(attr) !== null) out.push(node)
    })
    return out
  }
  function byClass(name) {
    let found = null
    walk(node => {
      if (found === null && String(node.className).split(/\s+/).includes(name)) found = node
    })
    return found
  }
  function click(attr, key) {
    const node = find(attr, key)
    assert.ok(node, '找不到 ' + attr + '=' + key)
    node.fire('click')
    return node
  }
  function runTimers(limit = 12) {
    for (let round = 0; round < limit; round += 1) {
      const task = timers.find(entry => !entry.canceled)
      if (!task) return
      task.canceled = true
      task.fn()
    }
  }
  function sync() {
    app.data = roulette.view(data, api)
    app.rerender()
  }

  render(app)
  return {
    dom,
    app,
    data,
    wallet,
    api,
    timers,
    render,
    find,
    all,
    byClass,
    click,
    runTimers,
    sync,
    text: () => dom.body.allText(),
    hasClass(node, name) {
      return String(node.className).split(/\s+/).includes(name)
    },
    images() {
      const out = []
      walk(node => {
        if (node.tagName === 'img') out.push(node)
      })
      return out
    },
  }
}
