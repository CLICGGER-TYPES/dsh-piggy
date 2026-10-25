// @ts-check
/**
 * Windows 舞台物理空间的纯几何回归（不启动 Electron）。
 *
 * 用原生形状的转换替身检查窗口/页面换算；空矩形陷阱另以 VM 实测返回值回归。
 *
 * R1 是 root 实机记录的真值：两块 1280x800（工作区高 752），副屏 125%。
 * 旧 DIP 并集 2304x752 的窗口右边少 256 物理像素；物理并集是 2560x752。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { geometryPayload, rectCoveredByAreas, stageBounds } from '../stage/geometry.js'
import { coversRect, dipForPhysicalUnion, effectiveScale, expandRect, physicalStageGeometry, physicalStagePlan, rectsClose } from '../stage/physical.js'
import { stageGeometryFor } from '../stage/window-bounds.js'
import { displayEntry, electronDisplays, fakeWindow, mockScreen } from './helpers/physical-screen.js'

/** root 实机：100% + 125%，物理 1280x800，工作区高 752。 */
const R1 = [
  displayEntry({ id: 1, label: 'primary', scale: 1, physical: { x: 0, y: 0, width: 1280, height: 800 },
    physicalWork: { x: 0, y: 0, width: 1280, height: 752 }, dip: { x: 0, y: 0, width: 1280, height: 800 },
    dipWork: { x: 0, y: 0, width: 1280, height: 752 } }),
  displayEntry({ id: 2, label: 'right125', scale: 1.25, physical: { x: 1280, y: 0, width: 1280, height: 800 },
    physicalWork: { x: 1280, y: 0, width: 1280, height: 752 }, dip: { x: 1280, y: 0, width: 1024, height: 640 },
    dipWork: { x: 1280, y: 0, width: 1024, height: 602 } }),
]

/** 负原点：左侧 125% 屏，物理 -2560..0。 */
const S2 = [
  displayEntry({ id: 11, scale: 1, physical: { x: 0, y: 0, width: 1920, height: 1080 },
    dip: { x: 0, y: 0, width: 1920, height: 1080 } }),
  displayEntry({ id: 12, scale: 1.25, physical: { x: -2560, y: 0, width: 2560, height: 1440 },
    dip: { x: -2048, y: 0, width: 2048, height: 1152 } }),
]

/** L 形：右下角 125% 屏只和主屏在一个角上相接。 */
const S4 = [
  displayEntry({ id: 21, scale: 1, physical: { x: 0, y: 0, width: 1920, height: 1080 },
    dip: { x: 0, y: 0, width: 1920, height: 1080 } }),
  displayEntry({ id: 22, scale: 1.25, physical: { x: 1920, y: 1080, width: 2560, height: 1440 },
    dip: { x: 1920, y: 1080, width: 2048, height: 1152 } }),
]

/** 三屏 200/100/100：DIP 布局有假的缝，物理上主屏和右侧屏是贴着的。 */
const S5 = [
  displayEntry({ id: 31, scale: 2, physical: { x: 0, y: 0, width: 3840, height: 2160 },
    dip: { x: 0, y: 0, width: 1920, height: 1080 } }),
  displayEntry({ id: 32, scale: 1, physical: { x: 3840, y: 1000, width: 1920, height: 1080 },
    dip: { x: 1920, y: 500, width: 1920, height: 1080 } }),
  displayEntry({ id: 33, scale: 1, physical: { x: 1000, y: 2160, width: 1920, height: 1080 },
    dip: { x: 500, y: 1080, width: 1920, height: 1080 } }),
]

test('R1: the old DIP union window misses 256 physical px; the physical plan covers 2560x752', () => {
  const { screen } = mockScreen(R1)
  const displays = electronDisplays(R1)

  const oldDip = stageBounds(displays)
  assert.deepEqual(oldDip, { x: 0, y: 0, width: 2304, height: 752 }, 'root measured the old window as 2304x752 DIP')
  const oldPhysical = screen.dipToScreenRect(null, oldDip)
  assert.deepEqual(oldPhysical, { x: 0, y: 0, width: 2304, height: 752 })
  assert.equal(coversRect(oldPhysical, R1[0].physicalWork), true, 'primary work area was covered')

  const secondary = R1[1].physicalWork
  const missing = secondary.x + secondary.width - (oldPhysical.x + oldPhysical.width)
  assert.equal(missing, 256, 'the right 256 physical px of the 125% display had no window')
  assert.equal(coversRect(oldPhysical, secondary), false)

  const plan = physicalStagePlan(displays, screen)
  assert.ok(plan !== null)
  assert.equal(plan.union.width, 2560, 'physical union is 2560 wide')
  assert.ok(Math.abs(plan.union.height - 752) <= 1, 'height 752 (the DIP work area encloses to 753, within 1px)')
  for (const entry of R1) {
    assert.equal(coversRect(plan.union, entry.physicalWork), true, `window covers display ${entry.id}`)
  }
  // setBounds 必须用 null 窗口换算，不能用窗口所在屏的缩放。
  assert.deepEqual(plan.dip, { x: 0, y: 0, width: 2560, height: 753 })
  assert.deepEqual(plan.physical, plan.dip)
  assert.equal(plan.pad, 0, 'no blanket margin needed')
})

test('R1: geometry uses the canonical physical / DPR space and keeps the DIP display metadata', () => {
  const { screen } = mockScreen(R1)
  const displays = electronDisplays(R1)
  const plan = physicalStagePlan(displays, screen)
  assert.ok(plan !== null)
  const win = fakeWindow({ entries: R1, screen, physical: plan.physical })
  const payload = stageGeometryFor({
    win, platform: 'win32', displays, screen, seq: 4, interacting: true, legacyPig: { x: 200, y: 210 },
  })
  assert.ok(payload !== null)

  // s = C.width / getContentBounds().width = 1 here (hairline HMONITOR tie picks the primary).
  assert.deepEqual(payload.window, { x: 0, y: 0, width: 2560, height: 753 })
  assert.deepEqual(payload.workAreas, [{ x: 0, y: 0, width: 1280, height: 752 }, { x: 1280, y: 0, width: 1280, height: 753 }],
    'work areas are absolute physical / s, not the DIP 1024x602')

  // Existing display metadata stays untouched (DIP), the physical pair is added next to it.
  assert.deepEqual(payload.displays[1].workArea, { x: 1280, y: 0, width: 1024, height: 602 })
  assert.deepEqual(payload.displays[1].dipWorkArea, { x: 1280, y: 0, width: 1024, height: 602 })
  assert.deepEqual(payload.displays[1].physicalWorkArea, { x: 1280, y: 0, width: 1280, height: 753 })

  assert.equal(payload.space.scale, 1)
  assert.deepEqual(payload.space.content, { x: 0, y: 0, width: 2560, height: 753 }, 'space.content is the physical content rect')
  assert.deepEqual(payload.space.displays, [
    { id: 1, scaleFactor: 1, dipWorkArea: { x: 0, y: 0, width: 1280, height: 752 }, physicalWorkArea: { x: 0, y: 0, width: 1280, height: 752 } },
    { id: 2, scaleFactor: 1.25, dipWorkArea: { x: 1280, y: 0, width: 1024, height: 602 }, physicalWorkArea: { x: 1280, y: 0, width: 1280, height: 753 } },
  ])
  assert.deepEqual(payload.legacyPig, { x: 200, y: 210 }, 'legacy pig stays a DIP hint for the page to convert')
  assert.equal(payload.interacting, true)
  assert.equal(payload.seq, 4)

  // Client maths stay canonical: window + page offset == physical / s.
  const physicalFoot = { x: 1900, y: 500 }
  const page = { x: (physicalFoot.x - payload.space.content.x) / payload.space.scale, y: (physicalFoot.y - payload.space.content.y) / payload.space.scale }
  assert.deepEqual({ x: payload.window.x + page.x, y: payload.window.y + page.y }, { x: 1900, y: 500 })
})

test('R1: page zoom multiplies the effective DPR without moving the physical content', () => {
  const { screen } = mockScreen(R1)
  const displays = electronDisplays(R1)
  const plan = physicalStagePlan(displays, screen)
  assert.ok(plan !== null)
  const win = fakeWindow({ entries: R1, screen, physical: plan.physical, zoom: 1.25 })
  const content = screen.dipToScreenRect(win, win.getContentBounds())
  assert.equal(effectiveScale(win, content), 1.25)

  const payload = stageGeometryFor({ win, platform: 'win32', displays, screen, seq: 5 })
  assert.ok(payload !== null)
  assert.deepEqual(payload.space.content, content)
  assert.equal(payload.space.scale, 1.25)
  assert.deepEqual(payload.window, { x: 0, y: 0, width: 2048, height: 602.4 })
  assert.deepEqual(payload.workAreas[0], { x: 0, y: 0, width: 1024, height: 601.6 })
})

test('negative origin: the physical union starts at -2560 and the payload uses the left display scale', () => {
  const { screen } = mockScreen(S2)
  const displays = electronDisplays(S2)
  const plan = physicalStagePlan(displays, screen)
  assert.ok(plan !== null)
  assert.deepEqual(plan.union, { x: -2560, y: 0, width: 4480, height: 1440 })
  for (const entry of S2) assert.equal(coversRect(plan.union, entry.physicalWork), true)
  assert.deepEqual(plan.records[1].physicalWorkArea, { x: -2560, y: 0, width: 2560, height: 1440 },
    'the negative-origin 125% display was not converted with the primary scale')
  assert.deepEqual(plan.dip, { x: -2048, y: 0, width: 3584, height: 1152 })
  assert.equal(coversRect(plan.physical, plan.union), true, 'the converted request covers the physical union')

  const win = fakeWindow({ entries: S2, screen, physical: plan.physical })
  const payload = stageGeometryFor({ win, platform: 'win32', displays, screen, seq: 1 })
  assert.ok(payload !== null)
  // The spanning window's HMONITOR is the wider left display, so s = 1.25.
  assert.equal(payload.space.scale, 1.25)
  assert.deepEqual(payload.window, { x: -2048, y: 0, width: 3584, height: 1152 })
  assert.deepEqual(payload.workAreas, [
    { x: 0, y: 0, width: 1536, height: 864 },
    { x: -2048, y: 0, width: 2048, height: 1152 },
  ])
})

test('L gap: the physical corner touch leaves a real hole, nothing is invented there', () => {
  const { screen } = mockScreen(S4)
  const displays = electronDisplays(S4)
  const plan = physicalStagePlan(displays, screen)
  assert.ok(plan !== null)
  assert.deepEqual(plan.union, { x: 0, y: 0, width: 4480, height: 2520 })
  for (const entry of S4) assert.equal(coversRect(plan.union, entry.physicalWork), true)
  assert.deepEqual(plan.records[1].physicalWorkArea, { x: 1920, y: 1080, width: 2560, height: 1440 })

  const areas = plan.records.map(record => record.physicalWorkArea)
  const hole = { x: 2100, y: 500, width: 56, height: 56 }
  assert.equal(rectCoveredByAreas(hole, areas), false, 'right of the primary, above the corner display, is a hole')
  // A pig straddling the corner-only touch is not covered either: the two rects only share a point.
  const acrossCorner = { x: 1900, y: 1060, width: 56, height: 56 }
  assert.equal(rectCoveredByAreas(acrossCorner, areas), false)
})

test('physical seams are contiguous even when the DIP layout shows a fake gap', () => {
  const { screen } = mockScreen(S5)
  const displays = electronDisplays(S5)
  const plan = physicalStagePlan(displays, screen)
  assert.ok(plan !== null)
  assert.deepEqual(plan.union, { x: 0, y: 0, width: 5760, height: 3240 })
  const areas = plan.records.map(record => record.physicalWorkArea)
  assert.deepEqual(areas, S5.map(entry => entry.physicalWork))
  // Right display DIP y = 500 while its physical y = 1000: the page must not see a 500px gap.
  assert.equal(plan.records[1].dipWorkArea.y, 500)
  assert.equal(plan.records[1].physicalWorkArea.y, 1000)
  const acrossSeam = { x: 3800, y: 1200, width: 80, height: 56 }
  assert.equal(rectCoveredByAreas(acrossSeam, areas), true, 'a pig straddling x=3840 is on both screens')

  // Below display is physically adjacent to the primary as well.
  const acrossBelow = { x: 1400, y: 2130, width: 80, height: 56 }
  assert.equal(rectCoveredByAreas(acrossBelow, areas), true)
})

test('rounding: a conversion that loses one physical pixel is retried with a 1px pad, then covered', () => {
  const target = { x: 100, y: 100, width: 300, height: 200 }
  const losesOne = {
    screenToDipRect: (_hwnd, rect) => ({ x: rect.x, y: rect.y, width: rect.width - 1, height: rect.height }),
    dipToScreenRect: (_hwnd, rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }),
  }
  const noPad = losesOne.screenToDipRect(null, target)
  assert.equal(coversRect(losesOne.dipToScreenRect(null, noPad), target), false, 'precondition: the first try misses')
  const fit = dipForPhysicalUnion(target, losesOne)
  assert.ok(fit !== null)
  assert.equal(fit.pad, 1, 'retried with U expanded by 1 physical px, not a blanket margin')
  assert.equal(coversRect(fit.physical, target), true)

  // A conversion that behaves: no padding at all.
  const exact = {
    screenToDipRect: (_hwnd, rect) => ({ ...rect }),
    dipToScreenRect: (_hwnd, rect) => ({ ...rect }),
  }
  assert.equal(dipForPhysicalUnion(target, exact)?.pad, 0)
})

test('geometryPayload keeps old payloads byte-identical and adds space only when asked', () => {
  const window = { x: -1920, y: -200, width: 4480, height: 1440 }
  const workAreas = [{ x: -1920, y: -200, width: 1920, height: 1440 }, { x: 0, y: 0, width: 2560, height: 1440 }]
  const displays = [{ id: 3, label: 'left', bounds: { x: -1920, y: -200, width: 1920, height: 1440 }, workArea: workAreas[0], scaleFactor: 1 }]
  const old = geometryPayload({ window, workAreas, displays, seq: 9, interacting: false, legacyPig: null })
  assert.deepEqual(old, {
    window, workAreas,
    displays: [{ id: 3, label: 'left', bounds: { x: -1920, y: -200, width: 1920, height: 1440 }, workArea: workAreas[0], scaleFactor: 1 }],
    interacting: false, legacyPig: null, seq: 9,
  })
  assert.equal('space' in old, false)

  const withSpace = geometryPayload({
    window, workAreas,
    displays: [{ id: 3, workArea: workAreas[0], scaleFactor: 1.25, dipWorkArea: workAreas[0], physicalWorkArea: { x: -2560, y: 0, width: 2560, height: 1440 } }],
    space: { scale: 1.25, content: { x: -2560, y: 0, width: 4480, height: 1440 }, displays: [{ id: 3, scaleFactor: 1.25, dipWorkArea: workAreas[0], physicalWorkArea: { x: -2560, y: 0, width: 2560, height: 1440 } }] },
    seq: 10,
  })
  assert.deepEqual(withSpace.space, {
    scale: 1.25,
    content: { x: -2560, y: 0, width: 4480, height: 1440 },
    displays: [{ id: 3, scaleFactor: 1.25, dipWorkArea: workAreas[0], physicalWorkArea: { x: -2560, y: 0, width: 2560, height: 1440 } }],
  })
  assert.deepEqual(withSpace.displays[0].physicalWorkArea, { x: -2560, y: 0, width: 2560, height: 1440 })
})

test('rectsClose tolerates the 1px DIP enclosing error but not a real mismatch', () => {
  const union = { x: 0, y: 0, width: 2560, height: 752 }
  assert.equal(rectsClose({ x: 0, y: 0, width: 2560, height: 753 }, union, 1), true)
  assert.equal(rectsClose({ x: 0, y: 0, width: 2304, height: 752 }, union, 1), false, 'the old 2304 window is not "close"')
})

test('native Windows empty-rectangle conversion must not override the display work-area rectangle', () => {
  const displays = [
    { id: 1, scaleFactor: 1, workArea: { x: 0, y: 0, width: 1280, height: 752 } },
    { id: 2, scaleFactor: 1.25, workArea: { x: 1280, y: 0, width: 820, height: 567 } },
  ]
  // Captured in the dual-QXL VM: whole work area converts correctly. An empty
  // rectangle returns its unscaled origin and cannot identify the owning display.
  const screen = {
    screenToDipRect: (_win, rect) => ({ ...rect }),
    dipToScreenRect: (_win, rect) => rect.x === 1280 && rect.width === 820
      ? { x: 1280, y: 0, width: 1025, height: 709 } : { ...rect },
  }
  const plan = physicalStagePlan(displays, screen)
  assert.deepEqual(plan.records[1].physicalWorkArea, { x: 1280, y: 0, width: 1025, height: 709 })
  assert.deepEqual(plan.union, { x: 0, y: 0, width: 2305, height: 752 })
})


test('a settled tight union still publishes when the plan needed a 2px pad', () => {
  const union = { x: 0, y: 0, width: 1920, height: 1080 }
  const plan = {
    records: [{ id: 1, scaleFactor: 1.5, bounds: union, workArea: union, dipWorkArea: union, physicalWorkArea: union }],
    union,
    physical: expandRect(union, 2),
    pad: 2,
  }
  const content = { x: 0, y: 0, width: 1280, height: 720 }
  const win = { getContentBounds: () => ({ ...content }), webContents: { getZoomFactor: () => 1 } }
  const screen = { dipToScreenRect: (hwnd, rect) => hwnd === null ? { ...rect } : { ...union } }
  const payload = physicalStageGeometry({ win, screen, plan, seq: 30 })
  assert.ok(payload !== null, '<=2px plan padding must not be treated as an unsettled window forever')
  assert.deepEqual(payload.space.content, union)
})
