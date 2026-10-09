import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { contentBoundsForPig, resizedPigScreenPoint } from '../lib/window-geometry.js'

const AREA = { x: 0, y: 0, width: 1920, height: 1040 }
const PIG = { width: 56, height: 56 }

test('F10 one window resize keeps the pig at its original screen pixel', () => {
  const target = { x: 1791, y: 888 }
  const open = { width: 324, height: 628, pigWindow: { x: 248, y: 546, ...PIG }, panelOpen: true }
  const bounds = contentBoundsForPig(open, target, AREA)
  assert.deepEqual(bounds, { x: 1543, y: 342, width: 324, height: 628 })
  assert.deepEqual({ x: bounds.x + open.pigWindow.x, y: bounds.y + open.pigWindow.y }, target)
})

test('F10 opening and closing ten times at four corners and center never moves the pig', () => {
  const points = [{ x: 20, y: 20 }, { x: 1844, y: 20 }, { x: 20, y: 964 },
    { x: 1844, y: 964 }, { x: 932, y: 492 }]
  for (const target of points) {
    const left = target.x < 960
    const above = target.y > 520
    const pigWindow = { x: left ? 18 : 250, y: above ? 362 : 18, ...PIG }
    const open = { width: 324, height: 436, pigWindow, panelOpen: true }
    const closed = { width: 98, height: 98, pigWindow: { x: 22, y: 16, ...PIG }, panelOpen: false }
    for (let i = 0; i < 10; i += 1) {
      const grown = contentBoundsForPig(open, target, AREA)
      assert.deepEqual({ x: grown.x + pigWindow.x, y: grown.y + pigWindow.y }, target)
      const back = contentBoundsForPig(closed, target, AREA)
      assert.deepEqual({ x: back.x + 22, y: back.y + 16 }, target)
    }
  }
})

test('F10 only permits a pig shift when the panel fits on neither side', () => {
  const target = { x: 930, y: 490 }
  const impossible = { width: 1900, height: 1020, pigWindow: { x: 950, y: 510, ...PIG }, panelOpen: true }
  const moved = contentBoundsForPig(impossible, target, AREA)
  assert.ok(moved.x >= 0 && moved.x + moved.width <= AREA.width)
  assert.ok(moved.y >= 0 && moved.y + moved.height <= AREA.height)
  assert.notDeepEqual({ x: moved.x + 950, y: moved.y + 510 }, target)
})

test('F10 synchronous resize updates renderer geometry before another report', () => {
  let shell
  const listeners = {}
  const expected = { window: { x: 1593, y: 32, width: 324, height: 562 },
    workArea: AREA, seq: 2 }
  const source = readFileSync(new URL('../preload.cjs', import.meta.url), 'utf8')
  runInNewContext(source, { require: () => ({
    contextBridge: { exposeInMainWorld: (_name, value) => { shell = value } },
    ipcRenderer: { send() {}, sendSync: () => expected, on: (name, fn) => { listeners[name] = fn }, invoke() {} },
  }) })
  shell.onGeometry(() => {})
  shell.setContent({ width: 324, height: 562 }, true)
  listeners['piggy:geometry']({}, { window: { x: 1819, y: 32, width: 98, height: 98 }, workArea: AREA, seq: 1 })
  assert.deepEqual(JSON.parse(JSON.stringify(shell.geometry())), expected)
})

test('F10 desktop panel height does not depend on the old window viewport', () => {
  const html = readFileSync(new URL('../renderer/index.html', import.meta.url), 'utf8')
  assert.match(html, /\[data-dsh-pig\] \.dp-panel-footer\s*\{max-height:270px!important\}/)
})

test('F12 changing pig size keeps its feet and horizontal center fixed', () => {
  assert.deepEqual(resizedPigScreenPoint({ x: 900, y: 800 }, { width: 56, height: 56 }, { width: 96, height: 96 }),
    { x: 880, y: 760 })
  assert.deepEqual(resizedPigScreenPoint({ x: 880, y: 760 }, { width: 96, height: 96 }, { width: 48, height: 48 }),
    { x: 904, y: 808 })
})

test('F12 lets only transparent panel padding cross the edge during a size change', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 }
  const box = contentBoundsForPig({ width: 324, height: 758,
    pigWindow: { x: 230, y: 660, width: 72, height: 72 }, panelOpen: true,
    allowPanelOverflow: true }, { x: 1834, y: 887 }, area)
  assert.equal(box.x, 1604)
  assert.equal(box.x + 230, 1834)
  assert.ok(box.x + 230 + 72 <= 1920)
})

test('显示器变化要主动告诉游戏包：窗口没挪动也得推几何', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  // applyBounds 有 2px 死区：分辨率/缩放变了但窗口刚好不用挪时，它不会推几何，
  // 页面就会一直用旧的工作区列表。所以显示器事件必须自己再推一次并记一行。
  assert.match(main, /screen\.on\('display-metrics-changed',\s*\(event, display, changedMetrics\)\s*=>/)
  assert.match(main, /reclamp\('metrics-changed',\s*\{[^}]*changed:\s*changedMetrics\s*\}\)/)
  assert.match(main, /screen\.on\('display-added'/)
  assert.match(main, /screen\.on\('display-removed'/)
  const reclamp = main.slice(main.indexOf('const reclamp ='), main.indexOf("screen.on('display-metrics-changed'"))
  assert.match(reclamp, /pushGeometry\(\)/, '无条件推几何')
  assert.match(reclamp, /log\('display'/, '记一行，导出日志里能看见是哪块屏、变了什么')
})

test('窗口位置必须在构造时就给，不能先建再挪（Electron 自己的 DPI 坑）', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  // Electron 源码 shell/browser/native_window_views.cc 里写着：构造时不给 x/y 的话，
  // HWND 会先按主屏 DPI 建在 (0,0)、之后再挪，副屏上会「缩水」（secondary-creation
  // deflation symptom）。所以 start 必须摊进构造参数。
  const ctor = main.slice(main.indexOf('new BrowserWindow({'), main.indexOf('win.setAlwaysOnTop'))
  assert.match(ctor, /\.\.\.start/, '构造时就带上算好的 x/y/width/height')
})

test('显示器对账兜底：漏了 display 事件也能自愈', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  assert.match(main, /displayWatchTimer = setInterval\([\s\S]*?screen\.getAllDisplays\(\)[\s\S]*?reclamp\('reconcile'/, '每 10 秒比一次工作区列表')
})

test('窗口改动容差不贴着 Electron 的 ±1px 噪声（容差 1 会来回纠正）', () => {
  const index = readFileSync(new URL('../../../src/client/desktop/index.js', import.meta.url), 'utf8')
  assert.match(index, /const TOLERANCE = 2/)
  assert.match(index, /~1 ?像素误差|约 1px 误差|1px 误差/)
})

test('量几何稳定性不能量精灵本身：它一直在做待机动画（dp-bob）', () => {
  const css = readFileSync(new URL('../../../src/client/css-base.js', import.meta.url), 'utf8')
  // 这条测试是提醒：F10/I 批次都踩过——拿 .dp-pig 的 getBoundingClientRect() 当「猪的屏幕坐标」，
  // 量到的是动画（±2px 平滑周期），会误判成窗口几何在漂。要量就量 window.screenX/screenY
  // 或 geometry().window。
  assert.match(css, /animation:dp-bob 1\.8s ease-in-out infinite/, '猪有待机上下晃的动画')
  const doc = readFileSync(new URL('../../../docs/archive/tasks/I-round.md', import.meta.url), 'utf8')
  assert.match(doc, /量几何稳定性\*\*不能量精灵自己/, '任务卡里写明正确的测量方法')
})
