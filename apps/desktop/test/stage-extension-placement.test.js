// @ts-check
/**
 * 舞台扩展大窗口的显式位置回归。
 *
 * 复现条件：扩展窗口只给 width/height 和 center: true。Electron 的 center 会把
 * 窗口放到主显示器上，而尺寸是按光标所在显示器的工作区算的；光标在副屏或负坐标
 * 屏幕时，窗口就跑到另一块屏。这里守住新的 placement：x/y 明确落在目标 workArea
 * 里，坐标已经是 DIP，不再乘 scaleFactor。
 *
 * 外框厚度由平台主题决定，代码里不再写死 16x39；构造后用真实 getBounds()
 * 再居中一次，测试用一个「动态边框」的假窗口验证它只改位置、不改尺寸。
 * 全部是纯函数和源码装配检查，不启动 Electron、不打开窗口。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { extensionWindowGeometry } from '../lib/extension-window-geometry.js'
import { centerExtensionWindow, extensionWindowPlacement } from '../stage/extension-placement.js'

const stageSource = readFileSync(new URL('../stage/main.js', import.meta.url), 'utf8')

/** 矩形中心相对工作区中心的偏移。 */
function centerOffset(rect, area) {
  return {
    x: rect.x + rect.width / 2 - (area.x + area.width / 2),
    y: rect.y + rect.height / 2 - (area.y + area.height / 2),
  }
}

test('负原点副屏：按目标工作区算，不落回主屏中心', () => {
  const primary = { x: 0, y: 0, width: 1920, height: 1080 }
  const left = { x: -1920, y: -200, width: 1280, height: 720 }
  const size = extensionWindowGeometry(left)
  assert.deepEqual(size, { width: 1152, height: 648, minWidth: 720, minHeight: 480 })

  const at = extensionWindowPlacement(left, size)
  assert.deepEqual(at, { x: -1856, y: -164 })
  assert.ok(at.x >= left.x && at.y >= left.y)

  const primaryAt = extensionWindowPlacement(primary, extensionWindowGeometry(primary))
  assert.notDeepEqual(at, primaryAt, '负原点副屏不能复用主屏的居中位置')
  assert.ok(at.x < 0 && primaryAt.x > 0)
})

test('混合 DPI：workArea 已是 DIP，不再乘 scaleFactor', () => {
  const area = { x: -1536, y: -216, width: 1536, height: 864, scaleFactor: 1.25 }
  const size = extensionWindowGeometry(area)
  const at = extensionWindowPlacement(area, size)
  assert.deepEqual(at, { x: -1368, y: -173 })
  assert.deepEqual(extensionWindowPlacement({ ...area }, size), at,
    '同样的 DIP 工作区不能因为 scaleFactor 字段改变位置')

  const scaled = { x: Math.round(area.x * 1.25), y: Math.round(area.y * 1.25), width: area.width, height: area.height }
  assert.notDeepEqual(extensionWindowPlacement(scaled, size), at,
    '额外乘一次缩放会把窗口移到别处')
})

test('原点不在主屏的右侧屏：x/y 留在该屏工作区里', () => {
  const primary = { x: 0, y: 0, width: 1920, height: 1080 }
  const right = { x: 1920, y: 0, width: 1600, height: 900 }
  const size = extensionWindowGeometry(right)
  const at = extensionWindowPlacement(right, size)
  const outer = { x: at.x, y: at.y, width: size.width, height: size.height }
  assert.ok(at.x >= right.x, '右侧屏窗口不能回到主屏')
  assert.ok(at.x + outer.width <= right.x + right.width)
  assert.ok(at.y >= right.y && at.y + outer.height <= right.y + right.height)
  assert.notEqual(at.x, extensionWindowPlacement(primary, extensionWindowGeometry(primary)).x)
})

test('尺寸保持不变：默认尺寸、显式尺寸和构造参数口径一致', () => {
  const area = { x: -1280, y: -80, width: 1024, height: 768 }
  const size = extensionWindowGeometry(area)
  const snapshot = { ...size }
  assert.deepEqual(extensionWindowPlacement(area), extensionWindowPlacement(area, size))
  assert.deepEqual(size, snapshot, 'placement 不能改动传入的尺寸')
  assert.deepEqual(extensionWindowGeometry(area), snapshot)

  const at = extensionWindowPlacement(area, size)
  const outer = { x: at.x, y: at.y, width: size.width, height: size.height }
  assert.ok(outer.width <= area.width && outer.height <= area.height)
})

/** 模拟 BrowserWindow：内容尺寸固定，外框比内容多出平台主题的动态幅度。 */
function fakeBrowserWindow(content, frame) {
  const actual = { width: content.width + frame.width, height: content.height + frame.height }
  const calls = { setPosition: [], setBounds: [] }
  const win = {
    getBounds: () => ({ x: 0, y: 0, width: actual.width, height: actual.height }),
    setPosition(x, y) { calls.setPosition.push({ x, y }); win.position = { x, y } },
    setBounds(next) { calls.setBounds.push({ ...next }) },
    position: null,
  }
  return { win, content, frame, actual, calls }
}

test('动态外框：构造后按真实 getBounds 居中，只改位置不改尺寸', () => {
  const area = { x: 100, y: 50, width: 1000, height: 800 }
  const content = { width: 900, height: 700 }
  for (const frame of [{ width: 16, height: 39 }, { width: 4, height: 28 }, { width: 0, height: 0 }]) {
    const { win, actual, calls } = fakeBrowserWindow(content, frame)
    const nominal = extensionWindowPlacement(area, content)
    const at = centerExtensionWindow(win, area)
    assert.notEqual(at, null)
    assert.deepEqual(calls.setPosition, [at], '构造后只定位一次')
    assert.deepEqual(calls.setBounds, [], '不能为了居中改 width/height')
    assert.deepEqual(win.getBounds(), { x: 0, y: 0, ...actual }, '外框尺寸保持构造后的实际值')
    const outer = { x: at.x, y: at.y, ...actual }
    const offset = centerOffset(outer, area)
    assert.ok(Math.abs(offset.x) <= 0.5 && Math.abs(offset.y) <= 0.5, '按真实外框居中，误差不超过取整的半个 DIP')
    if (frame.height > 0) assert.notDeepEqual(at, nominal, '有真实外框时不能停在名义内容居中位置')
  }
})

test('centerExtensionWindow 对不可用的假窗口安全返回 null', () => {
  assert.equal(centerExtensionWindow(/** @type {any} */ (null), { x: 0, y: 0, width: 100, height: 100 }), null)
  assert.equal(centerExtensionWindow(/** @type {any} */ ({ getBounds: () => null, setPosition() {} }), { x: 0, y: 0, width: 100, height: 100 }), null)
})

test('stage/main.js 构造后用真实外框定位，并在 loadURL 前隔离扩展页 zoom', () => {
  assert.match(stageSource, /import \{ centerExtensionWindow, extensionWindowPlacement \} from '\.\/extension-placement\.js'/)
  assert.match(stageSource, /\.\.\.extensionWindowPlacement\(area, \{ width, height \}\)/)
  assert.match(stageSource, /width, height, useContentSize: true, minWidth, minHeight/)
  assert.doesNotMatch(stageSource, /center:\s*true|EXTENSION_FRAME/)
  const construct = stageSource.indexOf('extWin = new BrowserWindow')
  const center = stageSource.indexOf('centerExtensionWindow(extWin, area)')
  const isolate = stageSource.indexOf('enableIsolatedZoom(extWin.webContents)')
  const load = stageSource.indexOf("extWin.loadURL('piggy://app/stage/index.html')")
  assert.ok(construct >= 0 && construct < center && center < isolate && isolate < load,
    '外框居中、isolated zoom 都要在扩展页导航前完成')
  assert.ok(stageSource.trimEnd().split('\n').length <= 400, 'stage/main.js 保持 400 行以内')
})
