/**
 * D1 桌面版接缝：网页版没变，桌面版把位置和面板挑边交给外壳。
 *
 * 假的外壳（window.__dshPiggyShell）模拟「窗口贴着猪、屏幕还有多少地方」，
 * 这里验证：
 * 1. 外壳在时，拖猪把起止交给主进程采样，不写 localStorage 的坐标；
 * 2. 网页版（没有外壳）行为不变：坐标照旧写盘、面板照旧按视口挑边。
 * （单窗口时代「面板按屏幕空间挑边」那几条随单窗口代码一起删了：外壳 0.6.0 起面板在自己的窗口里，
 *   贴哪边由主进程定，见 test/panel-geometry.test.js。）
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { SNAPSHOT, fakeDom, contentOf, findByAttr, findByClass, hostOf, mount, openPanel, sceneOf, settle } from './helpers/bundle.js'

const SHELL_SRC = readFileSync(new URL('../apps/desktop/renderer/shell.js', import.meta.url), 'utf8')

/** 外壳：屏幕 1920x1040，猪停在右下角，上方空间 900、下方 100。 */
function fakeShell(room) {
  const calls = { drag: [], bounds: [], sync: 0 }
  return {
    calls,
    shell: {
      beginDrag: () => calls.drag.push('start'),
      endDrag: () => calls.drag.push('end'),
      syncGeometry: () => { calls.sync += 1 },
      room: () => room,
    },
  }
}

test('桌面版：拖猪由主进程采样，不写页面坐标', async () => {
  const { shell, calls } = fakeShell({ above: 900, below: 100, width: 1920, height: 1040 })
  const { dom, store } = await mount({ windowExtra: { __dshPiggyShell: shell } })
  openPanel(dom, 'status')

  const scene = sceneOf(dom)
  const offsetBefore = hostOf(dom).style.right
  scene.fire('pointerdown', { button: 0, clientX: 100, clientY: 100, screenX: 1000, screenY: 900, pointerId: 1 })
  scene.fire('pointermove', { clientX: 130, clientY: 90, screenX: 1030, screenY: 890, pointerId: 1 })
  scene.fire('pointermove', { clientX: 150, clientY: 60, screenX: 1050, screenY: 860, pointerId: 1 })
  scene.fire('pointerup', { pointerId: 1 })

  assert.deepEqual(calls.drag, ['start', 'end'], '每次拖动只传起止，不累计页面增量')
  assert.equal(store.get('dsh-piggy:position'), undefined, '桌面版不写页面坐标')
  assert.equal(hostOf(dom).style.right, offsetBefore, '拖动不改页面里的位置（位置归窗口）')
})

test('0.2.1 旧外壳只有 moveBy 时仍按屏幕坐标增量拖动', async () => {
  const moves = []
  const shell = { moveBy: (dx, dy) => moves.push([dx, dy]), room: () => null }
  const { dom, store } = await mount({ windowExtra: { __dshPiggyShell: shell } })
  const scene = sceneOf(dom)
  scene.fire('pointerdown', { button: 0, clientX: 100, clientY: 100, screenX: 400, screenY: 300, pointerId: 1 })
  scene.fire('pointermove', { clientX: 110, clientY: 95, screenX: 420, screenY: 290, pointerId: 1 })
  scene.fire('pointermove', { clientX: 110, clientY: 95, screenX: 437, screenY: 285, pointerId: 1 })
  scene.fire('pointerup', { pointerId: 1 })
  assert.deepEqual(moves, [[20, -10], [17, -5]])
  assert.equal(store.get('dsh-piggy:position'), undefined)
})

test('丢失指针捕获会结束桌面拖动，移动时给主进程发送心跳', async () => {
  const calls = []
  const shell = {
    beginDrag: () => calls.push('start'),
    dragHeartbeat: () => calls.push('beat'),
    endDrag: () => calls.push('end'),
  }
  const { dom } = await mount({ windowExtra: { __dshPiggyShell: shell } })
  const scene = sceneOf(dom)
  scene.fire('pointerdown', { button: 0, clientX: 20, clientY: 20, screenX: 100, screenY: 100, pointerId: 1 })
  scene.fire('pointermove', { clientX: 30, clientY: 20, screenX: 110, screenY: 100, pointerId: 1 })
  scene.fire('lostpointercapture', { pointerId: 1 })
  scene.fire('pointermove', { clientX: 40, clientY: 20, screenX: 120, screenY: 100, pointerId: 1 })
  assert.deepEqual(calls, ['start', 'beat', 'end'])
})

test('按住 1.5 秒不移动后再拖，桌面窗口仍跟着鼠标，松开即停止心跳', async () => {
  let now = 0
  let lastHeartbeat = 0
  let active = false
  let windowX = 100
  let cursorX = 100
  let beats = 0
  const shell = {
    beginDrag: () => { active = true; lastHeartbeat = now },
    dragHeartbeat: () => { if (active) { lastHeartbeat = now; beats += 1 } },
    endDrag: () => { active = false },
  }
  const { dom, intervals } = await mount({ windowExtra: { __dshPiggyShell: shell } })
  const cleared = new Set()
  window.clearInterval = id => cleared.add(id)
  const scene = sceneOf(dom)
  scene.fire('pointerdown', { button: 0, clientX: 20, clientY: 20, screenX: 100, screenY: 100, pointerId: 1 })
  const heartbeats = intervals.map((timer, index) => ({ ...timer, id: index + 1 })).filter(timer => timer.delay === 250)
  assert.equal(heartbeats.length, 1, '拖动期间须每 250ms 发一次心跳')
  for (now = 250; now <= 1500; now += 250) {
    for (const timer of heartbeats) if (!cleared.has(timer.id)) timer.fn()
    if (now - lastHeartbeat > 1000) active = false // 主进程的超时保险
  }
  cursorX = 150
  scene.fire('pointermove', { clientX: 70, clientY: 20, screenX: cursorX, screenY: 100, pointerId: 1 })
  if (active) windowX = cursorX // 主进程下一次 60Hz 采样
  assert.equal(windowX, 150, '停住再移动时窗口仍跟手')
  scene.fire('pointerup', { pointerId: 1 })
  const before = beats
  assert.ok(cleared.has(heartbeats[0].id), '结束拖动时清除心跳定时器')
  now += 250
  for (const timer of heartbeats) if (!cleared.has(timer.id)) timer.fn()
  assert.equal(beats, before)
})

test('F10 panel toggle flushes desktop geometry before the browser paints', async () => {
  const { shell, calls } = fakeShell({ above: 900, below: 100, width: 1920, height: 985 })
  const { dom } = await mount({ windowExtra: { __dshPiggyShell: shell } })
  const before = calls.sync
  openPanel(dom, 'status')
  assert.equal(calls.sync, before + 1)
})

test('桌面版：窗口自己在动时仍把整个拖动交给主进程', async () => {
  const { shell, calls } = fakeShell({ above: 900, below: 100, left: 900, right: 900, width: 1920, height: 1040 })
  const { dom } = await mount({ windowExtra: { __dshPiggyShell: shell } })
  openPanel(dom, 'status')

  const scene = sceneOf(dom)
  scene.fire('pointerdown', { button: 0, clientX: 100, clientY: 100, screenX: 1000, screenY: 800, pointerId: 1 })
  // 窗口跟着挪了 40px：clientX 只涨了 20，屏幕坐标老老实实涨了 40。
  scene.fire('pointermove', { clientX: 120, clientY: 100, screenX: 1040, screenY: 760, pointerId: 1 })
  scene.fire('pointerup', { pointerId: 1 })

  assert.deepEqual(calls.drag, ['start', 'end'])
})

test('桌面版：窗口跟随鼠标时，拖拽松开不能误判成摸猪', async () => {
  const { shell } = fakeShell({ above: 900, below: 100, left: 900, right: 900, width: 1920, height: 1040 })
  const { dom } = await mount({ windowExtra: { __dshPiggyShell: shell } })
  const scene = sceneOf(dom)
  const pig = findByClass(hostOf(dom), 'dp-pig')
  pig.removeAttribute('data-react')
  scene.fire('pointerdown', { button: 0, clientX: 60, clientY: 60, screenX: 1000, screenY: 800, pointerId: 1 })
  scene.fire('pointermove', { clientX: 60, clientY: 60, screenX: 1040, screenY: 800, pointerId: 1 })
  scene.fire('pointerup', { pointerId: 1 })
  assert.equal(pig.getAttribute('data-react'), null)
})

test('网页版：没有外壳时行为不变（坐标写盘、面板按视口挑边）', async () => {
  const { dom, store } = await mount()
  openPanel(dom, 'status')
  const scene = sceneOf(dom)
  scene.fire('pointerdown', { button: 0, clientX: 100, clientY: 100, screenX: 800, screenY: 600, pointerId: 1 })
  scene.fire('pointermove', { clientX: 130, clientY: 90, screenX: 830, screenY: 590, pointerId: 1 })
  scene.fire('pointerup', { pointerId: 1 })
  await settle()
  assert.notEqual(store.get('dsh-piggy:position'), undefined, '网页版照旧记住位置')
  assert.notEqual(hostOf(dom).style.right, undefined, '网页版自己挪位置')
})

// ---------------------------------------------------------------------------
// 真实加载顺序：renderer 先跑 shell.js，再由它加载 client.js
// ---------------------------------------------------------------------------

/** 极简选择器：够 shell.js 用（[data-dsh-pig]、.dp-scene、.dp-pig）。 */
function find(root, selector) {
  const parts = selector.trim().split(/\s+/)
  let nodes = [root]
  for (const part of parts) {
    const next = []
    const match = node => part === '[data-dsh-pig]' ? node.attributes?.['data-dsh-pig'] !== undefined
      : part.startsWith('.') ? String(node.className ?? '').split(/\s+/).includes(part.slice(1))
        : false
    for (const node of nodes) {
      const walk = child => { for (const kid of child.children ?? []) { if (match(kid)) next.push(kid); walk(kid) } }
      walk(node)
    }
    nodes = next
  }
  return nodes[0] ?? null
}

test('真实顺序（shell.js → client.js）：按住猪拖，窗口跟着走，页面里猪不动', async () => {
  const dom = fakeDom()
  const calls = { drag: [], content: [], shape: [] }
  const store = new Map()
  const winListeners = {}
  const timers = []

  globalThis.window = {
    __ModuleLoader__: { load: () => {} },
    piggyShell: {
      setContent: box => calls.content.push(box),
      setShape: rects => calls.shape.push(rects),
      beginDrag: () => calls.drag.push('start'),
      endDrag: () => calls.drag.push('end'),
      geometry: () => ({ window: { x: 1500, y: 700, width: 240, height: 220 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } }),
      onGeometry: () => {},
    },
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)) },
    },
    setInterval: fn => { timers.push(fn); return timers.length },
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    innerWidth: 240,
    innerHeight: 220,
    addEventListener: (name, fn) => { (winListeners[name] ??= []).push(fn) },
    removeEventListener: () => {},
  }
  // 元素补上 shell 要用的 closest（假 DOM 里没实现）。
  const makeElement = tag => {
    const node = dom.document.createElement(tag)
    // 假 DOM 只记了 tagName，shell.js 按 nodeName 认脚本。
    node.nodeName = tag
    node.closest = () => null
    // 假 DOM 缺的两个接口（真浏览器里永远有）。
    node.querySelectorAll = () => []
    node.offsetParent = null
    node.offsetLeft = 0
    node.offsetTop = 0
    node.offsetWidth = 0
    node.offsetHeight = 0
    return node
  }
  globalThis.document = {
    ...dom.document,
    createElement: makeElement,
    createElementNS: (ns, tag) => makeElement(tag),
    querySelector: selector => find(dom.body, selector),
  }
  globalThis.window.document = globalThis.document
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1' })
  globalThis.fetch = async () => ({ ok: true, status: 200, async json() { return SNAPSHOT } })

  // 真实的加载顺序：先 shell.js（它挂 __dshPiggyShell，再把 client.js 塞进 head）。
  const head = dom.document.head
  let loading = Promise.resolve()
  head.appendChild = child => {
    child.parentNode = head
    head.children.push(child)
    if (child.nodeName === 'script' && typeof child.onload === 'function') {
      const url = new URL('../client.js', import.meta.url)
      url.searchParams.set('t', 'shell-order')
      loading = import(url.href).then(() => { child.onload(); return child })
      return child
    }
    return child
  }
  const runShell = new Function('window', 'document', 'getComputedStyle', 'setInterval', SHELL_SRC)
  runShell(globalThis.window, globalThis.document, globalThis.getComputedStyle, globalThis.window.setInterval)
  await loading
  await settle()

  const host = hostOf(dom)
  assert.notEqual(host, undefined, 'client 要挂上猪')
  const scene = find(dom.body, '[data-dsh-pig] .dp-scene')
  assert.notEqual(scene, null, '要能找到场景')
  const before = { right: host.style.right, bottom: host.style.bottom, top: host.style.top, left: host.style.left }

  scene.fire('pointerdown', { button: 0, clientX: 60, clientY: 60, screenX: 1560, screenY: 760, pointerId: 1 })
  scene.fire('pointermove', { clientX: 70, clientY: 60, screenX: 1570, screenY: 760, pointerId: 1 })
  scene.fire('pointermove', { clientX: 110, clientY: 40, screenX: 1610, screenY: 740, pointerId: 1 })
  scene.fire('pointerup', { clientX: 110, clientY: 40, screenX: 1610, screenY: 740, pointerId: 1 })

  assert.deepEqual(calls.drag, ['start', 'end'], '真实加载顺序下要开启和结束主进程采样')
  assert.deepEqual(
    { right: host.style.right, bottom: host.style.bottom, top: host.style.top, left: host.style.left },
    before,
    '页面里猪的位置不能在拖动时变',
  )
  assert.equal(store.get('dsh-piggy:position'), undefined, '桌面版不写网页版的 POSITION_KEY')
})

test('CSS：朝右开时场景改左对齐，气泡/道具跟着镜像（网页版不受影响）', async () => {
  const { dom } = await mount()
  const css = String(dom.document.head.children.map(node => node.textContent ?? '').join('\n'))
  assert.match(css, /\[data-dsh-pig\]\[data-panel-side="right"\] \.dp-scene\{[^}]*justify-content:flex-start/,
    '朝右开时猪要待在场景左端（不然面板一开猪从右端跑到左端，位移 207px）')
  assert.match(css, /\[data-dsh-pig\]\[data-panel-side="right"\] \.dp-bubble\{[^}]*left:6px/,
    '气泡要跟着猪挪到左边')
  assert.match(css, /\[data-dsh-pig\]\[data-panel-side="right"\] \.dp-work\{margin:0 0 6px 2px\}/,
    '打工道具的间距也要镜像')
  // 网页版没有这个属性，规则不会命中
  assert.ok(!/\[data-panel-side/.test(css.replace(/\[data-dsh-pig\]\[data-panel-side/g, '')), '规则都要挂在 data-dsh-pig 上')
})

test('桌面版启动时面板总是收起（不按上次记住的「开着」恢复）', () => {
  const src = readFileSync(new URL('../src/client/index.js', import.meta.url), 'utf8')
  assert.match(src, /var isOpen = desktopShell\(\) === null && readStore\(OPEN_KEY\) === 'true'/)
})
