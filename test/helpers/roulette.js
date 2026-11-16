// 左轮轮盘面板测试挂具：用仓库里的假 DOM 跑真正的 extensions/roulette/client.js。
// 计时器是可推进的假定时器，随机数固定为 0.5，测试不依赖真实时钟。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import { fakeDom } from './bundle.js'

export const CLIENT_URL = new URL('../../extensions/roulette/client.js', import.meta.url)

export function mountRoulette() {
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

  const app = {
    data: { localDemo: true },
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
    send() {
      throw new Error('左轮轮盘是本地演示，不应该调用 app.send')
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

  render(app)
  return {
    dom,
    app,
    timers,
    render,
    find,
    all,
    byClass,
    click,
    runTimers,
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
