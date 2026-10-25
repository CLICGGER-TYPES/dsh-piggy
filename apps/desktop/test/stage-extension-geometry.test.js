// @ts-check
/**
 * 舞台扩展大窗几何回归。
 *
 * 复现条件：工作区只有 606x368（1212x736 @ 200%）时，旧公式给扩展窗口固定
 * minWidth=720 / minHeight=480，最小尺寸比工作区还大，窗口一定会超界。
 * split 主进程已经改用 lib/extension-window-geometry.js；这里守住 stage/main.js
 * 必须用同一个 helper，并顺带核对舞台工作区重算与扩展置顶交接的现有行为。
 * 全部是纯逻辑/源码装配检查，不启动 Electron、不渲染页面。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'

import { extensionWindowGeometry } from '../lib/extension-window-geometry.js'
import { stageBounds, workAreasOf } from '../stage/geometry.js'

const stageSource = readFileSync(new URL('../stage/main.js', import.meta.url), 'utf8')
const splitSource = readFileSync(new URL('../main.js', import.meta.url), 'utf8')

/** 取出 stage/main.js 里一个顶层函数（到它自己的收尾行），和 extension-layer.test.js 同一做法。 */
function extract(name) {
  const start = stageSource.indexOf('function ' + name + '(')
  assert.ok(start >= 0, name + ' 必须留在 stage/main.js')
  const end = stageSource.indexOf('\n}', start)
  return stageSource.slice(start, end + 2)
}

/** 修前 stage/main.js 的扩展窗口尺寸公式（原样抄下来作为基准，不要改成 helper）。 */
function legacyExtWindowGeometry(area) {
  const width = Math.min(1200, Math.round(area.width * 0.9))
  const height = Math.min(800, Math.round(area.height * 0.9), Math.round(width * 2 / 3))
  return { width, height, minWidth: 720, minHeight: 480 }
}

test('高缩放小工作区：修前固定最小尺寸超界，helper 留在工作区内', () => {
  const area = { width: 606, height: 368 }
  const before = legacyExtWindowGeometry(area)
  assert.ok(before.minWidth > area.width, '修前 720 最小宽度应超出 606 工作区')
  assert.ok(before.minHeight > area.height, '修前 480 最小高度应超出 368 工作区')

  const after = extensionWindowGeometry(area)
  assert.ok(after.width <= area.width && after.height <= area.height)
  assert.ok(after.minWidth <= area.width && after.minHeight <= area.height)
  assert.ok(after.minWidth <= after.width && after.minHeight <= after.height)
})

test('stage 扩展窗口与 split 主进程共用 extension-window-geometry helper', () => {
  assert.match(stageSource, /import \{ extensionWindowGeometry \} from '\.\.\/lib\/extension-window-geometry\.js'/)
  assert.match(stageSource, /const \{ width, height, minWidth, minHeight \} = extensionWindowGeometry\(area\)/)
  assert.match(stageSource, /width, height, useContentSize: true, minWidth, minHeight/)
  assert.doesNotMatch(stageSource, /minWidth:\s*720/)
  assert.doesNotMatch(stageSource, /minHeight:\s*480/)

  // 对照 split：同一个 helper、同一组解构字段，避免两条启动路径再次分叉。
  assert.match(splitSource, /import \{ extensionWindowGeometry \} from '\.\/lib\/extension-window-geometry\.js'/)
  assert.match(splitSource, /const \{ width, height, minWidth, minHeight \} = extensionWindowGeometry\(area\)/)
})

test('扩展窗口按光标所在屏的真实工作区取尺寸，不用多屏并集外接框', () => {
  assert.match(stageSource, /screen\.getDisplayNearestPoint\(screen\.getCursorScreenPoint\(\)\)\.workArea/)
  const area = { x: -1920, y: -200, width: 1280, height: 720 }
  const result = extensionWindowGeometry(area)
  // helper 只吃宽高；负原点由 Electron center 处理，尺寸不能因为负坐标变大或超界。
  assert.ok(result.width <= area.width && result.height <= area.height)
  const union = stageBounds([{ workArea: area }, { workArea: { x: 0, y: 0, width: 2560, height: 1440 } }])
  assert.ok(union !== null && union.width > area.width, '舞台窗口才是多屏并集，扩展窗口不应使用它')
})

test('显示器移除或缩放变化后，舞台工作区每次都从清单重算且可重复', () => {
  const left = { x: -1920, y: 0, width: 1920, height: 1080 }
  const right = { x: 0, y: -200, width: 2560, height: 1440 }
  const both = [{ id: 1, workArea: left, scaleFactor: 1 }, { id: 2, workArea: right, scaleFactor: 1.5 }]
  assert.deepEqual(stageBounds(both), { x: -1920, y: -200, width: 4480, height: 1440 })

  // 拔掉右侧屏：只由剩下的工作区决定，不会带着旧并集的一部分。
  const leftOnly = stageBounds([both[0]])
  assert.deepEqual(leftOnly, { x: -1920, y: 0, width: 1920, height: 1080 })
  assert.deepEqual(stageBounds([both[0]]), leftOnly)

  // 缩放变化后工作区变小（DIP），重复对账结果稳定。
  const scaled = [{ id: 1, workArea: { x: -1920, y: 0, width: 960, height: 540 }, scaleFactor: 2 }]
  const smallBounds = stageBounds(scaled)
  assert.deepEqual(smallBounds, { x: -1920, y: 0, width: 960, height: 540 })
  assert.deepEqual(stageBounds(scaled), smallBounds)
  const smallArea = workAreasOf(scaled)[0]
  const ext = extensionWindowGeometry(smallArea)
  assert.ok(ext.width <= smallArea.width && ext.height <= smallArea.height)
})

function focusHarness({ focused = true, top = true } = {}) {
  const stageCalls = []
  const queued = []
  let clock = 100
  let onTop = null
  const stage = {
    visible: true, raised: 0, top,
    isDestroyed: () => false,
    isVisible() { return this.visible },
    isAlwaysOnTop() { return this.top },
    setAlwaysOnTop(value, level) { this.top = value; stageCalls.push([value, level]); onTop?.({}, value) },
    on(event, fn) { if (event === 'always-on-top-changed') onTop = fn },
    moveTop() { this.raised += 1 },
  }
  const ext = {
    visible: true, minimized: false, focused, destroyed: false, raised: 0,
    isDestroyed() { return this.destroyed }, isVisible() { return this.visible },
    isMinimized() { return this.minimized }, isFocused() { return this.focused },
    moveTop() { this.raised += 1 },
  }
  const context = { stageWin: stage, extWin: ext, quitting: false, reassertingUntil: 0,
    Date: { now: () => clock }, setTimeout: fn => queued.push(fn), log() {} }
  runInNewContext(
    extract('extFocused') + '\n' + extract('syncExtensionLayer') + '\n' + extract('reassertTop')
      + '\nglobalThis.syncExtensionLayer = syncExtensionLayer; globalThis.reassertTop = reassertTop',
    context,
  )
  const registration = stageSource.split('\n').find(line => line.includes("stageWin.on('always-on-top-changed'"))
  assert.ok(registration)
  runInNewContext(registration, context)
  return { stage, ext, stageCalls, queued, setClock: next => { clock = next },
    sync: () => context.syncExtensionLayer(), reassert: why => context.reassertTop(why) }
}

test('置顶恢复产生的自身事件不会每200ms再次排队，真正的后续失顶仍恢复', () => {
  const h = focusHarness({ focused: false })
  h.stage.setAlwaysOnTop(false, 'floating')
  assert.equal(h.queued.length, 1, '外部失顶触发一次恢复')
  h.queued.shift()()
  assert.equal(h.stage.top, true)
  assert.equal(h.queued.length, 0, '恢复中的自身 false 事件不能产生永久重置循环')
  h.setClock(1200)
  h.stage.setAlwaysOnTop(false, 'floating')
  assert.equal(h.queued.length, 1, '抑制期间结束后的真实失顶仍能恢复')
})

test('扩展获得焦点时舞台让出置顶层，置顶守卫不能把它抬回去', () => {
  const harness = focusHarness({ focused: true })
  harness.sync()
  assert.deepEqual(harness.stageCalls, [[false, 'floating']])
  assert.equal(harness.ext.raised, 1, 'Linux 取消置顶后要把正在操作的大窗口抬上来')
  harness.stageCalls.length = 0
  harness.reassert('check')
  assert.deepEqual(harness.stageCalls, [], '扩展有焦点时 3 秒守卫不能重新置顶舞台')
})

test('扩展失焦、最小化、隐藏或关闭后舞台恢复置顶', () => {
  const harness = focusHarness({ focused: true })
  harness.sync()
  assert.equal(harness.stage.top, false)
  harness.stageCalls.length = 0
  harness.ext.raised = 0
  harness.ext.focused = false
  harness.sync()
  assert.deepEqual(harness.stageCalls, [[true, 'floating']])
  assert.equal(harness.ext.raised, 0)
  // 剩下的三种“扩展不再持有焦点”的形态，都从舞台已让出置顶的状态验证会恢复。
  harness.stage.top = false
  harness.ext.focused = true
  harness.ext.minimized = true
  harness.sync()
  assert.deepEqual(harness.stageCalls.at(-1), [true, 'floating'])
  harness.stage.top = false
  harness.ext.minimized = false
  harness.ext.visible = false
  harness.sync()
  assert.deepEqual(harness.stageCalls.at(-1), [true, 'floating'])
  harness.stage.top = false
  harness.ext.visible = true
  harness.ext.destroyed = true
  harness.sync()
  assert.deepEqual(harness.stageCalls.at(-1), [true, 'floating'])
})
