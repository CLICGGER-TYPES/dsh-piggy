// @ts-check
/**
 * 全屏探测的「猪在哪块屏」回归（不启动 Electron）。
 *
 * Windows 的关键：窗口跨两块屏时 getDisplayMatching 会选交集最大的那块，
 * 但全屏探测要跟猪走；而且副屏 DIP 原点乘 scaleFactor 不等于物理原点。
 * 所以用窗口内容的物理矩形 C + CSS 猪中心 × dpr 选屏。
 * Linux/macOS 仍走原来的 DIP + bounds × scaleFactor，不调用 Windows 的换算。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { pigDisplayBounds } from '../stage/pig-display.js'
import { createPresenter } from '../stage/present.js'
import { watchFullscreen } from '../stage/system.js'
import { displayEntry, electronDisplays, fakeWindow, hmonitorEntry, mockScreen } from './helpers/physical-screen.js'

const PRIMARY = { x: 0, y: 0, width: 1280, height: 800 }
const SECONDARY_DIP = { x: 1280, y: 0, width: 820, height: 615 }
const SECONDARY_PHYSICAL = { x: 1280, y: 0, width: 1025, height: 769 }
const PIG = { x: 1396, y: 292, width: 56, height: 56 }
const VIEWPORT = { width: 2304, height: 752 }

/** root 实机 100% + 125%：副屏物理 1024x768，Electron 报 DIP 820x615。 */
function vmEntries() {
  return [
    displayEntry({ id: 1, scale: 1, physical: { x: 0, y: 0, width: 1280, height: 800 }, dip: PRIMARY }),
    displayEntry({ id: 2, scale: 1.25, physical: { x: 1280, y: 0, width: 1024, height: 768 }, dip: SECONDARY_DIP }),
  ]
}

/**
 * @param {ReturnType<typeof displayEntry>[]} entries
 * @param {{physical?:{x:number,y:number,width:number,height:number}, platform?:string, screen?:any}} [options]
 */
function fixture(entries, options = {}) {
  const mock = mockScreen(entries)
  const screen = options.screen ?? mock.screen
  const displays = electronDisplays(entries)
  screen.getAllDisplays = () => displays
  screen.getDisplayMatching = () => displays[0]
  const win = fakeWindow({
    entries, screen,
    physical: options.physical ?? { x: 0, y: 0, width: 2304, height: 752 },
  })
  win.isVisible = () => false
  const presenter = createPresenter({
    getWindow: () => win,
    platform: options.platform ?? 'win32',
    screen,
    log: () => {},
  })
  return { presenter, win, screen, displays, entries }
}

test('Windows: pig on the secondary wins over the window largest-intersection primary', () => {
  const entries = vmEntries()
  const { presenter, win, screen } = fixture(entries)
  // 前提：窗口物理矩形横跨两屏，HMONITOR（交集最大）在主屏，不是猪所在屏。
  assert.equal(hmonitorEntry(win.physicalRect(), entries).id, 1)
  assert.deepEqual(presenter.getPigDisplayBounds(), PRIMARY, 'before any report: old window-intersection fallback')

  presenter.applyReport({ shape: [PIG], visible: { pig: PIG }, dpr: 1.25, viewport: VIEWPORT, interacting: false })
  assert.deepEqual(presenter.getPigDisplayBounds(), SECONDARY_PHYSICAL,
    'pig centre physical = C.x + CSS centre 1424 * 1.25 = 1780, inside secondary physical 1280..2305')
  assert.deepEqual(screen.dipToScreenRect(null, SECONDARY_DIP), SECONDARY_PHYSICAL)
  presenter.dispose()
})

test('Windows: negative origins use the real physical display origin, not DIP origin * scale', () => {
  const entries = [
    displayEntry({ id: 11, scale: 1, physical: { x: 0, y: 0, width: 1920, height: 1080 },
      dip: { x: 0, y: 0, width: 1920, height: 1080 } }),
    displayEntry({ id: 12, scale: 1.25, physical: { x: -2400, y: 0, width: 1024, height: 768 },
      dip: { x: -2048, y: 0, width: 820, height: 615 } }),
  ]
  const { presenter, screen } = fixture(entries, { physical: { x: -2400, y: 0, width: 4320, height: 1080 } })
  const pig = { x: 372, y: 292, width: 56, height: 56 }
  presenter.applyReport({ shape: [pig], visible: { pig }, dpr: 1.25, viewport: { width: 4320, height: 1080 }, interacting: false })

  const bounds = presenter.getPigDisplayBounds()
  assert.deepEqual(bounds, { x: -2400, y: 0, width: 1025, height: 769 })
  assert.notEqual(bounds?.x, -2048 * 1.25, 'DIP origin -2048 × 1.25 would invent -2560')
  assert.deepEqual(screen.dipToScreenRect(null, entries[1].dip), bounds)
  presenter.dispose()
})

test('Windows: moving the pig back to the primary updates the getter', () => {
  const { presenter } = fixture(vmEntries())
  presenter.applyReport({ shape: [PIG], visible: { pig: PIG }, dpr: 1.25, viewport: VIEWPORT, interacting: false })
  assert.deepEqual(presenter.getPigDisplayBounds(), SECONDARY_PHYSICAL)

  const onPrimary = { x: 292, y: 292, width: 56, height: 56 }
  presenter.applyReport({ shape: [onPrimary], visible: { pig: onPrimary }, dpr: 1.25, viewport: VIEWPORT, interacting: false })
  assert.deepEqual(presenter.getPigDisplayBounds(), PRIMARY)
  presenter.dispose()
})

test('Windows: hot-unplug drops the removed display instead of reusing a dead monitor', () => {
  const fixtureValue = fixture(vmEntries())
  const { presenter, displays } = fixtureValue
  presenter.applyReport({ shape: [PIG], visible: { pig: PIG }, dpr: 1.25, viewport: VIEWPORT, interacting: false })
  assert.deepEqual(presenter.getPigDisplayBounds(), SECONDARY_PHYSICAL)

  displays.splice(0, displays.length, ...displays.slice(0, 1))
  assert.deepEqual(presenter.getPigDisplayBounds(), PRIMARY,
    'the getter reads the current display list; the unplugged 1280,0 physical rect cannot come back')
  presenter.dispose()
})

test('Windows: invalid getDisplayMatching bounds return null instead of recursing', () => {
  let calls = 0
  const screen = {
    getDisplayMatching() {
      calls += 1
      return { bounds: { x: Number.NaN, y: 0, width: 100, height: 200 }, scaleFactor: 1.25 }
    },
  }
  const win = { getBounds: () => ({ x: 0, y: 0, width: 10, height: 10 }) }
  // 上一版 fallbackPigDisplayBounds 会在 bounds 无效时再调自己，这里必须只问一次并返回 null。
  assert.equal(pigDisplayBounds({ platform: 'win32', screen, win, pig: null }), null)
  assert.equal(calls, 1)
})

test('Linux/macOS: pig centre nearest display in DIP space, no Windows converters', () => {
  for (const platform of ['linux', 'darwin']) {
    let converterCalls = 0
    let nearest = null
    const secondary = { bounds: { x: 1920, y: 0, width: 1280, height: 800 }, scaleFactor: 1.25 }
    const screen = {
      getDisplayNearestPoint(point) { nearest = point; return secondary },
      dipToScreenRect() { converterCalls += 1; throw new Error('Windows-only converter used on ' + platform) },
      dipToScreenPoint() { converterCalls += 1; throw new Error('Windows-only converter used on ' + platform) },
    }
    const win = {
      getContentBounds: () => ({ x: 100, y: 20, width: 3200, height: 1080 }),
      getBounds: () => ({ x: 100, y: 20, width: 3200, height: 1080 }),
      isVisible: () => false,
      isDestroyed: () => false,
    }
    const presenter = createPresenter({ getWindow: () => win, platform, screen, log: () => {} })
    const pig = { x: 2200, y: 400, width: 56, height: 56 }
    presenter.applyReport({ shape: [pig], visible: { pig }, viewport: { width: 3200, height: 1080 }, interacting: false })
    assert.deepEqual(presenter.getPigDisplayBounds(), { x: 2400, y: 0, width: 1600, height: 1000 })
    assert.deepEqual(nearest, { x: 100 + 2228, y: 20 + 428 }, 'existing DIP content origin + CSS centre')
    assert.equal(converterCalls, 0)
    presenter.dispose()
  }
})

test('system wiring: watchFullscreen uses the injected getter, and keeps the old fallback without it', async () => {
  const win = { isDestroyed: () => false, getBounds: () => ({ x: 10, y: 20, width: 100, height: 200 }) }
  let captured = null
  const watch = await watchFullscreen({
    getWindow: () => win, userData: '/tmp', log: () => {}, onHide: () => {}, onShow: () => {},
    getPigDisplayBounds: () => SECONDARY_PHYSICAL,
    createWatch: options => { captured = options; return { async init() {}, start() {}, stop() {} } },
  })
  assert.deepEqual(captured.pigDisplayBounds(), SECONDARY_PHYSICAL)
  assert.equal(typeof captured.windowsPigDisplayBounds, 'function')
  assert.deepEqual(captured.windowsPigDisplayBounds(), SECONDARY_PHYSICAL)
  watch.stop()

  let asked = null
  const screen = {
    getDisplayMatching(rect) {
      asked = rect
      return { bounds: { x: 5, y: 6, width: 100, height: 200 }, scaleFactor: 1.25 }
    },
  }
  let fallback = null
  const old = await watchFullscreen({
    getWindow: () => win, userData: '/tmp', log: () => {}, onHide: () => {}, onShow: () => {}, screen,
    createWatch: options => { fallback = options; return { async init() {}, start() {}, stop() {} } },
  })
  assert.deepEqual(fallback.pigDisplayBounds(), { x: 6.25, y: 7.5, width: 125, height: 250 })
  assert.equal(fallback.windowsPigDisplayBounds, undefined, 'split path keeps the old HWND-only Windows behavior')
  assert.deepEqual(asked, win.getBounds())
  old.stop()
})

test('main path: presenter getter passed to watchFullscreen picks the pig display', async () => {
  const { presenter } = fixture(vmEntries())
  presenter.applyReport({ shape: [PIG], visible: { pig: PIG }, dpr: 1.25, viewport: VIEWPORT, interacting: false })
  let captured = null
  const watch = await watchFullscreen({
    getWindow: () => ({ isDestroyed: () => false }), userData: '/tmp', log: () => {}, onHide: () => {}, onShow: () => {},
    getPigDisplayBounds: () => presenter.getPigDisplayBounds(),
    createWatch: options => { captured = options; return { async init() {}, start() {}, stop() {} } },
  })
  assert.deepEqual(captured.pigDisplayBounds(), SECONDARY_PHYSICAL)
  watch.stop()
  presenter.dispose()
})
