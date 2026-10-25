// @ts-check
/**
 * 舞台窗口 bounds 的请求/校验回归（纯逻辑，不启动 Electron）。
 *
 * Windows：目标永远是物理工作区并集；请求用 screenToDipRect(null, U)，校验比
 * 物理矩形。绝不拿 getBounds 的 DIP 和 setBounds 的 DIP 比 —— 混合缩放下两者
 * 本来就不对称，比较它们会无限 setBounds。其他平台原样走旧 DIP 路径。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { stageBounds, workAreasOf } from '../stage/geometry.js'
import { coversRect, physicalStagePlan } from '../stage/physical.js'
import { applyPhysicalStageBounds, stageGeometryFor, stageWindowBounds } from '../stage/window-bounds.js'
import { displayEntry, electronDisplays, fakeWindow, immediateSchedule, mockScreen } from './helpers/physical-screen.js'

/** root 实机 R1：100% + 125%，旧窗口 2304x752，物理目标 2560x752。 */
const R1 = [
  displayEntry({ id: 1, scale: 1, physical: { x: 0, y: 0, width: 1280, height: 800 },
    physicalWork: { x: 0, y: 0, width: 1280, height: 752 }, dip: { x: 0, y: 0, width: 1280, height: 800 },
    dipWork: { x: 0, y: 0, width: 1280, height: 752 } }),
  displayEntry({ id: 2, scale: 1.25, physical: { x: 1280, y: 0, width: 1280, height: 800 },
    physicalWork: { x: 1280, y: 0, width: 1280, height: 752 }, dip: { x: 1280, y: 0, width: 1024, height: 640 },
    dipWork: { x: 1280, y: 0, width: 1024, height: 602 } }),
]

/** S6：主屏 150%，右侧 4K 100%。窗口 HMONITOR 是 4K，setBounds 却按 DIP 矩形最近。 */
const S6 = [
  displayEntry({ id: 41, scale: 1.5, physical: { x: 0, y: 0, width: 1920, height: 1080 },
    dip: { x: 0, y: 0, width: 1280, height: 720 } }),
  displayEntry({ id: 42, scale: 1, physical: { x: 1920, y: 0, width: 3840, height: 2160 },
    dip: { x: 1280, y: 0, width: 3840, height: 2160 } }),
]

/** 旧代码建窗用的 DIP 并集（物理上就是右边少 256px 的那个窗口）。 */
function legacyWindow(entries) {
  const { screen } = mockScreen(entries)
  const displays = electronDisplays(entries)
  const dip = stageBounds(displays)
  return { screen, displays, dip }
}

test('non-Windows: window bounds and geometry stay exactly the old DIP path', () => {
  const { screen, displays, dip } = legacyWindow(R1)
  assert.deepEqual(stageWindowBounds({ platform: 'linux', displays, screen }), dip)
  const win = fakeWindow({ entries: R1, screen, physical: { x: 0, y: 0, width: 400, height: 300 } })

  const timers = []
  applyPhysicalStageBounds({
    win, platform: 'darwin', displays, screen, why: 'reconcile', log: () => {},
    schedule: (fn, ms) => { timers.push(ms); fn() },
  })
  assert.deepEqual(win.setBoundsCalls, [dip], 'the non-Windows request is the old DIP union, not a physical conversion')
  assert.deepEqual(timers, [60], 'the old 60ms shape refresh is preserved')

  const payload = stageGeometryFor({ win, platform: 'linux', displays, screen, seq: 2, interacting: false, legacyPig: { x: 200, y: 210 } })
  assert.deepEqual(payload.window, win.getBounds(), 'window stays DIP on non-Windows')
  assert.deepEqual(payload.workAreas, workAreasOf(displays), 'work areas stay DIP on non-Windows (1024x602 secondary)')
  assert.equal(payload.workAreas[1].width, 1024)
  assert.equal('space' in payload, false)
  assert.equal(payload.displays[1].dipWorkArea, undefined)
  assert.deepEqual(payload.legacyPig, { x: 200, y: 210 })
})

test('Windows: the request comes from the physical union and covers the 256px the old window missed', () => {
  const { screen, displays, dip } = legacyWindow(R1)
  assert.deepEqual(dip, { x: 0, y: 0, width: 2304, height: 752 })
  const plan = physicalStagePlan(displays, screen)
  assert.ok(plan !== null)
  assert.deepEqual(stageWindowBounds({ platform: 'win32', displays, screen }), plan.dip)

  // BrowserWindow created with the requested DIP: setBounds goes through the null-window conversion.
  const win = fakeWindow({ entries: R1, screen, physical: screen.dipToScreenRect(null, plan.dip) })
  const logs = []
  const schedule = immediateSchedule()
  let settled = 0
  const result = applyPhysicalStageBounds({
    win, platform: 'win32', displays, screen, why: 'startup', log: (...parts) => logs.push(parts.join(' ')),
    schedule: schedule.schedule, onSettled: () => { settled += 1 },
  })
  assert.ok(result !== null)
  assert.equal(result.changed, false, 'the window was created at the physical target already')
  assert.equal(win.setBoundsCalls.length, 0)
  assert.equal(settled, 0, 'no bounds change means no delayed shape refresh; the caller pushes geometry immediately')
  assert.equal(coversRect(win.physicalRect(), R1[1].physicalWork), true)
})

test('Windows: a legacy 2304x752 window is corrected once and the second pass makes no setBounds call', () => {
  const { screen, displays } = legacyWindow(R1)
  const oldPhysical = screen.dipToScreenRect(null, { x: 0, y: 0, width: 2304, height: 752 })
  const win = fakeWindow({ entries: R1, screen, physical: oldPhysical })
  assert.equal(coversRect(win.physicalRect(), R1[1].physicalWork), false, 'precondition: the old window leaves 256px uncovered')

  const logs = []
  const schedule = immediateSchedule()
  let settled = 0
  const first = applyPhysicalStageBounds({
    win, platform: 'win32', displays, screen, why: 'metrics-changed', log: (...parts) => logs.push(parts.join(' ')),
    schedule: schedule.schedule, onSettled: () => { settled += 1 },
  })
  assert.ok(first !== null)
  assert.equal(first.changed, true)
  assert.equal(win.setBoundsCalls.length, 1)
  schedule.run()
  assert.equal(settled, 1)
  assert.equal(logs.some(line => line.startsWith('bounds corrective')), false, 'no corrective pass was needed')
  assert.equal(logs.some(line => line.startsWith('bounds unverified')), false)
  assert.equal(coversRect(win.physicalRect(), R1[1].physicalWork), true, 'the corrected window covers the 125% display')

  const again = applyPhysicalStageBounds({
    win, platform: 'win32', displays, screen, why: 'reconcile', log: (...parts) => logs.push(parts.join(' ')),
    schedule: schedule.schedule,
  })
  assert.equal(again?.changed, false)
  assert.equal(win.setBoundsCalls.length, 1, 'an already-correct physical window is never set again')
})

test('Windows: an asymmetric getBounds DIP does not trigger a setBounds loop when the physical rect is right', () => {
  const { screen, displays } = legacyWindow(S6)
  const plan = physicalStagePlan(displays, screen)
  assert.ok(plan !== null)
  const win = fakeWindow({ entries: S6, screen, physical: plan.physical })
  assert.deepEqual(win.physicalRect(), { x: 0, y: 0, width: 5760, height: 2160 })
  // Native APIs may report a logical rectangle different from the requested
  // rectangle. The reconciler must trust the physical readback, not their equality.
  win.getBounds = () => ({ x: -900, y: 0, width: 4000, height: 1500 })
  const nativeScreen = { ...screen, dipToScreenRect: (hwnd, rect) => hwnd === win
    ? win.physicalRect() : screen.dipToScreenRect(hwnd, rect) }
  assert.notDeepEqual(win.getBounds(), plan.dip)
  const schedule = immediateSchedule()
  const result = applyPhysicalStageBounds({
    win, platform: 'win32', displays, screen: nativeScreen, why: 'reconcile', log: (...parts) => logs.push(parts.join(' ')),
    schedule: schedule.schedule,
  })
  assert.equal(result?.changed, false)
  schedule.run()
  assert.equal(win.setBoundsCalls.length, 0, 'DIP get/set asymmetry alone must not move the window')
})

test('Windows: one corrective setBounds when the native window lands clipped, then the log stops it', () => {
  const { screen, displays } = legacyWindow(R1)
  const win = fakeWindow({
    entries: R1, screen, physical: { x: 0, y: 0, width: 2304, height: 752 },
    // 模拟 WM_GETMINMAXINFO 之类把窗口横向夹掉 100px，只夹第一次。
    clip: (applied, call) => (call === 1 ? { x: applied.x, y: applied.y, width: applied.width - 100, height: applied.height } : null),
  })
  const logs = []
  const schedule = immediateSchedule()
  let settled = 0
  applyPhysicalStageBounds({
    win, platform: 'win32', displays, screen, why: 'metrics-changed', log: (...parts) => logs.push(parts.join(' ')),
    schedule: schedule.schedule, onSettled: () => { settled += 1 },
  })
  schedule.run()
  assert.equal(win.setBoundsCalls.length, 2, 'exactly one corrective pass')
  assert.equal(settled, 1)
  assert.equal(logs.filter(line => line.startsWith('bounds corrective')).length, 1)
  assert.equal(logs.some(line => line.startsWith('bounds unverified')), false)
  assert.equal(coversRect(win.physicalRect(), R1[1].physicalWork), true)

  // A window that stays clipped: verify + one correction, then stop and log — no endless loop.
  const stuck = fakeWindow({
    entries: R1, screen, physical: { x: 0, y: 0, width: 2304, height: 752 },
    clip: applied => ({ x: applied.x, y: applied.y, width: applied.width - 100, height: applied.height }),
  })
  const stuckLogs = []
  const stuckSchedule = immediateSchedule()
  let stuckSettled = 0
  applyPhysicalStageBounds({
    win: stuck, platform: 'win32', displays, screen, why: 'metrics-changed', log: (...parts) => stuckLogs.push(parts.join(' ')),
    schedule: stuckSchedule.schedule, onSettled: () => { stuckSettled += 1 },
  })
  const rounds = stuckSchedule.run()
  assert.equal(stuck.setBoundsCalls.length, 2, 'no third setBounds: the corrective pass is the last one')
  assert.equal(rounds <= 3, true)
  assert.equal(stuckSettled, 1, 'the shape refresh still runs')
  assert.equal(stuckLogs.some(line => line.startsWith('bounds unverified')), true, 'the native mismatch is reported, not hidden')
})

/** 原生捕获：Win+P PC screen only 后只剩主屏 1280x800（工作区 752），舞台被系统最小化。 */
const DISABLED = [
  displayEntry({ id: 2121262686, scale: 1, physical: { x: 0, y: 0, width: 1280, height: 800 },
    physicalWork: { x: 0, y: 0, width: 1280, height: 752 }, dip: { x: 0, y: 0, width: 1280, height: 800 },
    dipWork: { x: 0, y: 0, width: 1280, height: 752 } }),
]

/** 同一份 monitor-disabled.json：窗口仍报旧舞台大小，内容矩形是 {-32000,-32000,0,0}。 */
const MINIMIZED_PHYSICAL = { x: 0, y: 0, width: 1920, height: 1432 }

test('native monitor-disabled: the minimized content sentinel never becomes page geometry', () => {
  const { screen } = mockScreen(DISABLED)
  const displays = electronDisplays(DISABLED)
  const win = fakeWindow({ entries: DISABLED, screen, physical: MINIMIZED_PHYSICAL, minimized: true })

  assert.deepEqual(win.getContentBounds(), { x: -32000, y: -32000, width: 0, height: 0 },
    'captured native state: minimized content is a zero-size sentinel')
  assert.equal(stageGeometryFor({ win, platform: 'win32', displays, screen, seq: 8 }), null,
    'the page must keep its last valid geometry instead of consuming the sentinel')

  // Even if the native window claims it is not minimized, a zero-size content rect is not geometry.
  win.restore()
  win.getContentBounds = () => ({ x: -32000, y: -32000, width: 0, height: 0 })
  assert.equal(stageGeometryFor({ win, platform: 'win32', displays, screen, seq: 9 }), null)
})

test('native monitor-disabled: a minimized stage is restored and rebased to the primary work area', () => {
  const { screen } = mockScreen(DISABLED)
  const displays = electronDisplays(DISABLED)
  const win = fakeWindow({ entries: DISABLED, screen, physical: MINIMIZED_PHYSICAL, minimized: true })
  const logs = []
  const schedule = immediateSchedule()
  let settled = 0

  const result = applyPhysicalStageBounds({
    win, platform: 'win32', displays, screen, why: 'removed', log: (...parts) => logs.push(parts.join(' ')),
    schedule: schedule.schedule, onSettled: () => { settled += 1 },
  })
  assert.ok(result !== null)
  assert.equal(win.restoreCalls, 1, 'the OS-minimized stage is restored before any bounds request')
  assert.equal(win.isFocused(), false, 'native recovery uses showInactive, preserving the foreground application')
  assert.ok(logs.includes('bounds restore removed'))
  assert.equal(win.setBoundsCalls.length, 1, 'only the real target is requested after restore')

  schedule.run()
  assert.equal(win.isMinimized(), false)
  assert.deepEqual(win.physicalRect(), { x: 0, y: 0, width: 1280, height: 752 })
  assert.equal(settled, 1)
  assert.equal(logs.some(line => line.startsWith('bounds unverified')), false)

  const payload = stageGeometryFor({ win, platform: 'win32', displays, screen, seq: 10 })
  assert.ok(payload !== null)
  assert.deepEqual(payload.window, { x: 0, y: 0, width: 1280, height: 752 })
  assert.deepEqual(payload.workAreas, [{ x: 0, y: 0, width: 1280, height: 752 }])
  assert.equal(payload.space.scale, 1)
})

test('native monitor-disabled: a minimize after the first request is recovered by the bounded check', () => {
  const { screen } = mockScreen(DISABLED)
  const displays = electronDisplays(DISABLED)
  const win = fakeWindow({ entries: DISABLED, screen, physical: MINIMIZED_PHYSICAL })
  const logs = []
  const schedule = immediateSchedule()
  let settled = 0

  applyPhysicalStageBounds({
    win, platform: 'win32', displays, screen, why: 'removed', log: (...parts) => logs.push(parts.join(' ')),
    schedule: schedule.schedule, onSettled: () => { settled += 1 },
  })
  assert.equal(win.setBoundsCalls.length, 1)
  win.minimize() // OS processes the disconnected monitor after the first setBounds.

  schedule.run()
  assert.equal(win.restoreCalls, 1, 'the 80ms verification also resumes a late OS minimize')
  assert.ok(logs.includes('bounds restore settle'))
  assert.equal(win.isMinimized(), false)
  assert.deepEqual(win.physicalRect(), { x: 0, y: 0, width: 1280, height: 752 })
  assert.equal(settled, 1)
  assert.equal(logs.some(line => line.startsWith('bounds unverified')), false)
})

test('native monitor-disabled: a minimize after the first verification gets the 60ms watch', () => {
  const { screen } = mockScreen(DISABLED)
  const displays = electronDisplays(DISABLED)
  const win = fakeWindow({ entries: DISABLED, screen, physical: MINIMIZED_PHYSICAL })
  const logs = []
  const schedule = immediateSchedule()
  let settled = 0

  applyPhysicalStageBounds({
    win, platform: 'win32', displays, screen, why: 'removed', log: (...parts) => logs.push(parts.join(' ')),
    schedule: schedule.schedule, onSettled: () => { settled += 1 },
  })
  assert.equal(schedule.step(), true, '80ms verification')
  assert.equal(settled, 1)
  win.minimize() // OS minimizes after the 80ms check has already accepted the bounds.

  assert.equal(schedule.step(), true, '60ms watch')
  assert.equal(win.restoreCalls, 1)
  assert.equal(win.isMinimized(), false)
  assert.ok(logs.includes('bounds restore final'))
  assert.equal(settled, 1, 'the watch restores first, then asks for the shape/geometry refresh')

  schedule.run()
  assert.equal(settled, 2)
  assert.deepEqual(win.physicalRect(), { x: 0, y: 0, width: 1280, height: 752 })
})


/** 原生 Win+P Extend：主屏 100% + 副屏 200% 4K，物理并集 C2 3840x2864。 */
const EXTEND = [
  displayEntry({ id: 1, label: 'primary', scale: 1, physical: { x: 0, y: 0, width: 1280, height: 800 },
    physicalWork: { x: 0, y: 0, width: 1280, height: 752 }, dip: { x: 0, y: 0, width: 1280, height: 800 },
    dipWork: { x: 0, y: 0, width: 1280, height: 752 } }),
  displayEntry({ id: 2, label: 'secondary', scale: 2, physical: { x: -1280, y: 800, width: 3840, height: 2160 },
    physicalWork: { x: -1280, y: 800, width: 3840, height: 2064 }, dip: { x: -640, y: 800, width: 1920, height: 1080 },
    dipWork: { x: -640, y: 800, width: 1920, height: 1032 } }),
]

/** root 在 Extend 后 1.4 秒读到的原生内容矩形（尚未对齐前的过渡值）。 */
const EXTEND_STALE = { x: -2560, y: -800, width: 7680, height: 5920 }

test('native Extend: unverified native content is not published as page geometry', () => {
  const { screen } = mockScreen(EXTEND)
  const displays = electronDisplays(EXTEND)
  const plan = physicalStagePlan(displays, screen)
  assert.ok(plan !== null)
  const win = fakeWindow({ entries: EXTEND, screen, physical: EXTEND_STALE })

  assert.equal(stageGeometryFor({ win, platform: 'win32', displays, screen, seq: 20 }), null,
    'C1 7680x5920 does not match the current plan; pages must keep the last valid geometry')
  win.setBounds(plan.dip)
  const payload = stageGeometryFor({ win, platform: 'win32', displays, screen, seq: 21 })
  assert.ok(payload !== null, 'after setBounds lands, geometry resumes')
  assert.deepEqual(payload.space.content, plan.physical)
})
