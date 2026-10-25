// @ts-check
/**
 * 舞台按猪所在显示器缩放的回归：全部是假 ipcMain/screen/window，不启 Electron。
 *
 * 夹具按 root 的原生观测：两块 1280x800 物理屏并排（100% + 125%），舞台内容
 * 2560x752，renderer dpr 1；猪在右屏时目标 zoom 1.25。另一个夹具模拟窗口 DSF
 * 是 1.25、猪回到 100% 左屏时目标 zoom 0.8。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { createStageUiScale } from '../stage/ui-scale.js'
import { displayEntry, electronDisplays, mockScreen } from './helpers/physical-screen.js'

const PRIMARY = { id: 'primary', scaleFactor: 1, workArea: { x: 0, y: 0, width: 1280, height: 752 }, physicalWorkArea: { x: 0, y: 0, width: 1280, height: 752 } }
const SECONDARY = { id: 'secondary', scaleFactor: 1.25, workArea: { x: 1024, y: 0, width: 1024, height: 601.6 }, physicalWorkArea: { x: 1280, y: 0, width: 1280, height: 752 } }
const CONTENT = { x: 0, y: 0, width: 2560, height: 752 }

const rectKey = rect => [rect.x, rect.y, rect.width, rect.height].join(',')

function makeIpc() {
  /** @type {Map<string, Function[]>} */
  const listeners = new Map()
  return {
    on(channel, handler) {
      const list = listeners.get(channel) ?? []
      list.push(handler)
      listeners.set(channel, list)
    },
    removeListener(channel, handler) {
      const list = listeners.get(channel)
      if (list === undefined) return
      const index = list.indexOf(handler)
      if (index >= 0) list.splice(index, 1)
    },
    count: channel => (listeners.get(channel) ?? []).length,
    handlers: channel => [...(listeners.get(channel) ?? [])],
    emit(channel, event, payload) {
      for (const handler of [...(listeners.get(channel) ?? [])]) handler(event, payload)
    },
  }
}

function makeScreen(displays, contentPhysical) {
  const physical = new Map(displays.map(display => [rectKey(display.workArea), display.physicalWorkArea]))
  let conversions = 0
  return {
    getAllDisplays: () => displays,
    screenToDipRect: (win, rect) => ({ ...rect }),
    dipToScreenRect: (win, rect) => {
      conversions += 1
      if (win !== null) return { ...contentPhysical }
      const area = physical.get(rectKey(rect))
      return area === undefined ? { ...rect } : { ...area }
    },
    conversions: () => conversions,
  }
}

function makeWindow({ content, contentPhysical, displays, events = [] }) {
  const screen = makeScreen(displays, contentPhysical)
  const calls = { mode: [], factor: [] }
  const loadListeners = new Set()
  let zoom = 1
  const contents = {
    setZoomMode(mode) { calls.mode.push(mode) },
    getZoomFactor: () => zoom,
    setZoomFactor(value) {
      calls.factor.push(value)
      zoom = value
      events.push({ kind: 'zoom', value })
    },
    on(type, handler) { if (type === 'did-finish-load') loadListeners.add(handler) },
    removeListener(type, handler) { if (type === 'did-finish-load') loadListeners.delete(handler) },
  }
  const win = {
    webContents: contents,
    isDestroyed: () => false,
    getContentBounds: () => ({ ...content }),
    getBounds: () => ({ ...content }),
  }
  return {
    win, contents, screen, calls,
    load: () => { for (const handler of [...loadListeners]) handler() },
    listenerCount: () => loadListeners.size,
    setRawZoom: value => { zoom = value },
  }
}

function makeStage({ events = [], platform = 'win32', content = CONTENT, contentPhysical = CONTENT, displays = [PRIMARY, SECONDARY] } = {}) {
  const ipc = makeIpc()
  const stage = makeWindow({ content, contentPhysical, displays, events })
  const ext = makeWindow({ content: { x: 0, y: 0, width: 900, height: 700 }, contentPhysical: { x: 0, y: 0, width: 900, height: 700 }, displays: [PRIMARY], events })
  let current = stage.win
  const ui = createStageUiScale({
    ipcMain: ipc,
    getWindow: () => current,
    screen: stage.screen,
    platform,
    log: () => {},
    onChange: change => { events.push({ kind: 'geometry', change }) },
  })
  return {
    ipc, stage, ext, ui,
    setWindow: value => { current = value },
    report: (payload, sender = stage.contents) => ipc.emit('stage:report', { sender }, payload),
  }
}

function pigReport({ x = 2173, y = 481, width = 71, height = 106, dpr = 1, viewport = { width: 2560, height: 752 }, interacting = false } = {}) {
  return {
    shape: [{ x, y, width, height }],
    visible: { pig: { x, y, width, height } },
    dpr, viewport, interacting,
  }
}

test('100% + 125%: a pig on the secondary display targets zoom 1.25, zoom before geometry', () => {
  const events = []
  const fixture = makeStage({ events })
  assert.equal(fixture.ui.attach(fixture.stage.win), true)
  fixture.report(pigReport())
  assert.deepEqual(fixture.stage.calls.factor, [1.25])
  assert.deepEqual(fixture.stage.calls.mode, ['isolated'])
  assert.deepEqual(events.map(event => event.kind), ['zoom', 'geometry'], 'root pushes geometry after the zoom lands')
  assert.equal(events[1].change.zoom, 1.25)
  assert.equal(events[1].change.baseDPR, 1)
  assert.equal(events[1].change.display.id, 'secondary')
})

test('window base DSF 1.25 with the pig on the 100% primary: target zoom 0.8', () => {
  const content = { x: 0, y: 0, width: 2048, height: 752 }
  const contentPhysical = { x: 0, y: 0, width: 2560, height: 752 }
  const fixture = makeStage({ content, contentPhysical })
  fixture.ui.attach(fixture.stage.win)
  fixture.report(pigReport({ x: 450, y: 300, width: 56, height: 56, dpr: 1.25, viewport: { width: 2048, height: 601.6 } }))
  assert.deepEqual(fixture.stage.calls.factor, [0.8])
})

test('isolated mode is set on the stage only; the ext webContents is untouched', () => {
  const fixture = makeStage()
  fixture.ui.attach(fixture.stage.win)
  fixture.report(pigReport())
  assert.deepEqual(fixture.stage.calls.mode, ['isolated'])
  assert.deepEqual(fixture.ext.calls.mode, [])
  assert.deepEqual(fixture.ext.calls.factor, [])
  assert.equal(fixture.ext.listenerCount(), 0, 'ui-scale never attaches to the extension window')
})

test('reports while interacting are skipped; the release report applies the zoom', () => {
  const fixture = makeStage()
  fixture.ui.attach(fixture.stage.win)
  fixture.report(pigReport({ interacting: true }))
  assert.deepEqual(fixture.stage.calls.factor, [])
  fixture.report(pigReport({ interacting: true }))
  assert.deepEqual(fixture.stage.calls.factor, [])
  fixture.report(pigReport({ interacting: false }))
  assert.deepEqual(fixture.stage.calls.factor, [1.25])
})

test('a report from any other sender or a detached window is ignored', () => {
  const fixture = makeStage()
  fixture.ui.attach(fixture.stage.win)
  fixture.report(pigReport(), fixture.ext.contents)
  assert.deepEqual(fixture.stage.calls.factor, [])
  const other = makeWindow({ content: CONTENT, contentPhysical: CONTENT, displays: [PRIMARY, SECONDARY] })
  fixture.setWindow(other.win)
  fixture.report(pigReport())
  assert.deepEqual(fixture.stage.calls.factor, [], 'only the attached current stage window may zoom')
  fixture.setWindow(fixture.stage.win)
  fixture.report(pigReport())
  assert.deepEqual(fixture.stage.calls.factor, [1.25])
})

test('reports with an invalid dpr or viewport are ignored instead of guessing', () => {
  const fixture = makeStage()
  fixture.ui.attach(fixture.stage.win)
  const bad = [
    pigReport({ dpr: Number.NaN }),
    pigReport({ dpr: 0 }),
    pigReport({ dpr: 9 }),
    pigReport({ dpr: /** @type {any} */ ('1.25') }),
    pigReport({ viewport: /** @type {any} */ (null) }),
    pigReport({ viewport: { width: 0, height: 752 } }),
    pigReport({ viewport: { width: 2560, height: -1 } }),
    { ...pigReport(), visible: { pig: null } },
    { ...pigReport(), visible: null },
    null,
  ]
  for (const payload of bad) fixture.report(payload)
  assert.deepEqual(fixture.stage.calls.factor, [])
})

test('the same report, or a sub-epsilon drift, never rewrites zoom', () => {
  const events = []
  const fixture = makeStage({ events })
  fixture.ui.attach(fixture.stage.win)
  fixture.report(pigReport())
  fixture.report(pigReport())
  assert.deepEqual(fixture.stage.calls.factor, [1.25], 'same target is a no-op')
  fixture.stage.setRawZoom(1.2499)
  fixture.report(pigReport())
  assert.deepEqual(fixture.stage.calls.factor, [1.25], '0.5% drift is treated as the same zoom')
  assert.deepEqual(events.map(event => event.kind), ['zoom', 'geometry'], 'no feedback loop on repeated reports')
  fixture.report(pigReport({ x: 100, y: 200, width: 56, height: 56, dpr: 1.25, viewport: { width: 2048, height: 601.6 } }))
  assert.deepEqual(fixture.stage.calls.factor, [1.25, 1], 'a real display change still applies')
})

test('reapply after did-finish-load restores the last target and pushes geometry', () => {
  const events = []
  const fixture = makeStage({ events })
  fixture.ui.attach(fixture.stage.win)
  fixture.report(pigReport())
  events.length = 0
  fixture.stage.setRawZoom(1)
  fixture.stage.load()
  assert.deepEqual(fixture.stage.calls.factor, [1.25, 1.25], 'a reload replays the last target')
  assert.deepEqual(events.map(event => event.kind), ['zoom', 'geometry'])
  assert.equal(events[1].change.reason, 'reload')
})

test('dispose removes the ipc and did-finish-load listeners and nothing acts afterwards', () => {
  const fixture = makeStage()
  fixture.ui.attach(fixture.stage.win)
  const [handler] = fixture.ipc.handlers('stage:report')
  assert.equal(fixture.ipc.count('stage:report'), 1)
  assert.equal(fixture.stage.listenerCount(), 1)
  fixture.ui.dispose()
  assert.equal(fixture.ipc.count('stage:report'), 0)
  assert.equal(fixture.stage.listenerCount(), 0)
  handler({ sender: fixture.stage.contents }, pigReport())
  fixture.stage.load()
  fixture.report(pigReport())
  assert.deepEqual(fixture.stage.calls.factor, [], 'no action after dispose')
  assert.equal(fixture.ui.attach(fixture.stage.win), false, 'attach after dispose is refused')
  assert.equal(fixture.stage.listenerCount(), 0)
})

test('Linux and macOS never change the stage zoom', () => {
  for (const platform of ['linux', 'darwin']) {
    const fixture = makeStage({ platform })
    fixture.ui.attach(fixture.stage.win)
    fixture.report(pigReport())
    assert.deepEqual(fixture.stage.calls.factor, [], platform + ' keeps the old zoom policy')
    assert.equal(fixture.stage.screen.conversions(), 0, platform + ' does not call the Windows-only conversion')
    assert.equal(fixture.ui.isIsolated(), true, 'the isolated mode itself is still installed')
  }
})

test('without setZoomMode the helper refuses to zoom instead of leaking to the ext window', () => {
  const fixture = makeStage()
  // 老版本 Electron 没有 setZoomMode
  delete fixture.stage.contents.setZoomMode
  assert.equal(fixture.ui.attach(fixture.stage.win), false)
  fixture.report(pigReport())
  assert.deepEqual(fixture.stage.calls.factor, [])
})


test('physical displays reuse displayRecords: a pig at the true right edge of the 125% screen picks 1.25, not the neighbor', () => {
  // 同一套物理显示器记录用于窗口和页面缩放，副屏右边缘不能误判到邻屏。
  const entries = [
    displayEntry({ id: 1, label: 'primary', scale: 1,
      physical: { x: 0, y: 0, width: 1280, height: 800 }, physicalWork: { x: 0, y: 0, width: 1280, height: 752 },
      dip: { x: 0, y: 0, width: 1280, height: 800 }, dipWork: { x: 0, y: 0, width: 1280, height: 752 } }),
    displayEntry({ id: 2, label: 'right125', scale: 1.25,
      physical: { x: 1280, y: 0, width: 1280, height: 800 }, physicalWork: { x: 1280, y: 0, width: 1280, height: 752 },
      dip: { x: 1280, y: 0, width: 1024, height: 640 }, dipWork: { x: 1280, y: 0, width: 1024, height: 601.6 } }),
    displayEntry({ id: 3, label: 'right150', scale: 1.5,
      physical: { x: 2600, y: 0, width: 400, height: 800 }, physicalWork: { x: 2600, y: 0, width: 400, height: 752 },
      dip: { x: 2304, y: 0, width: 267, height: 533 }, dipWork: { x: 2304, y: 0, width: 267, height: 501 } }),
  ]
  const { screen: mock } = mockScreen(entries)
  const displays = electronDisplays(entries)
  const screen = { ...mock, getAllDisplays: () => displays }
  assert.deepEqual(screen.dipToScreenRect(null, displays[1].workArea), { x: 1280, y: 0, width: 1280, height: 752 })

  const ipc = makeIpc()
  const factors = []
  const contents = {
    setZoomMode() {}, getZoomFactor: () => 1,
    setZoomFactor(value) { factors.push(value) },
    on() {}, removeListener() {},
  }
  const content = { x: 0, y: 0, width: 3000, height: 752 }
  const stageWin = {
    webContents: contents, isDestroyed: () => false,
    getContentBounds: () => ({ ...content }), getBounds: () => ({ ...content }),
    physicalRect: () => ({ x: 0, y: 0, width: 3000, height: 752 }),
  }
  const ui = createStageUiScale({
    ipcMain: ipc, getWindow: () => stageWin, screen, platform: 'win32', log: () => {}, onChange: () => {},
  })
  ui.attach(stageWin)
  // 猪的物理中心 2500：仍在真副屏 1280..2560 内，但已超出错误区域 1280..2304。
  const pig = { x: 2440, y: 300, width: 120, height: 100 }
  ipc.emit('stage:report', { sender: contents }, {
    shape: [pig], visible: { pig }, dpr: 1, viewport: { width: 3000, height: 752 }, interacting: false,
  })
  assert.deepEqual(factors, [1.25], 'displayRecords keeps the real 1280-wide secondary physical area')
})


// 原生 Win+P Extend：主屏 100% 1280x800（工作区 752），副屏 200% 4K 物理
// {-1280,800,3840,2160}。舞台的正确物理并集是 C2 {-1280,0,3840,2864}。
const EXTEND = {
  primary: { id: 'ext-primary', scaleFactor: 1, workArea: { x: 0, y: 0, width: 1280, height: 752 }, physicalWorkArea: { x: 0, y: 0, width: 1280, height: 752 } },
  secondary: { id: 'ext-secondary', scaleFactor: 2, workArea: { x: -640, y: 800, width: 1920, height: 1032 }, physicalWorkArea: { x: -1280, y: 800, width: 3840, height: 2064 } },
  content: { x: -640, y: 0, width: 1920, height: 1432 },
  physical: { x: -1280, y: 0, width: 3840, height: 2864 },
  stalePhysical: { x: -2560, y: -800, width: 7680, height: 5920 },
}

function extendStage({ content = EXTEND.content, physical = EXTEND.physical } = {}) {
  return makeStage({ content, contentPhysical: physical, displays: [EXTEND.primary, EXTEND.secondary] })
}

function rawReport({ pig, dpr, viewport }) {
  return { shape: [pig], visible: { pig }, dpr, viewport, interacting: false }
}

test('topology race: the stale huge native content with an old CSS viewport never retargets zoom', () => {
  const fixture = extendStage({ content: EXTEND.stalePhysical, physical: EXTEND.stalePhysical })
  fixture.ui.attach(fixture.stage.win)
  // 页面还停在旧的 1280x752 主屏报告；新原生内容 C1 是 7680x5920。
  fixture.report(rawReport({
    pig: { x: 13, y: 604, width: 164, height: 130 }, dpr: 1, viewport: { width: 1280, height: 752 },
  }))
  assert.deepEqual(fixture.stage.calls.factor, [],
    'a report whose viewport*dpr does not cover the native content is from before the reflow')
})

test('topology race: an unaligned native content rect is rejected even when the report viewport matches it', () => {
  const fixture = extendStage({ content: EXTEND.stalePhysical, physical: EXTEND.stalePhysical })
  fixture.ui.attach(fixture.stage.win)
  const pig = { x: 1600, y: 1700, width: 100, height: 100 }
  fixture.report(rawReport({ pig, dpr: 1, viewport: { width: 7680, height: 5920 } }))
  assert.deepEqual(fixture.stage.calls.factor, [],
    'the stage content must match the current physical work-area union before it can pick a display')
})

test('topology race: after the native request lands, an old 1280-wide report cannot pick the wrong display', () => {
  const fixture = extendStage()
  fixture.ui.attach(fixture.stage.win)
  fixture.stage.setRawZoom(0.5)
  fixture.report(rawReport({
    pig: { x: 13, y: 604, width: 164, height: 130 }, dpr: 1, viewport: { width: 1280, height: 752 },
  }))
  assert.deepEqual(fixture.stage.calls.factor, [],
    'the old CSS pig belongs to the pre-Extend viewport; interpreting it on C2 would put it on the 200% screen')
})

test('topology race: a reflowed 3840x2864 report on the primary targets zoom 0.5', () => {
  const fixture = extendStage()
  fixture.ui.attach(fixture.stage.win)
  // C2 origin -1280, so CSS foot 1470 maps back to physical foot 190? No: use the
  // captured post-settle foot 95/716 -> CSS foot 1375/716 on the primary.
  const pig = { x: 1293, y: 552, width: 164, height: 164 }
  fixture.report(rawReport({ pig, dpr: 1, viewport: { width: 3840, height: 2864 } }))
  assert.deepEqual(fixture.stage.calls.factor, [0.5],
    'base DPR 2 on the 200% stage, pig on the 100% primary -> page zoom 0.5')
})

// 真实 4K/150%：紧并集右边 2562，原生内容右边 2565；有效的外扩不能被当旧拓扑。
test('native 150% padded content still changes zoom when the pig returns to the primary', () => {
  const captured = JSON.parse(readFileSync(new URL('./fixtures/stage-150-native.json', import.meta.url), 'utf8'))
  const displays = captured.plan.records.map(d => ({ ...d, workArea: d.dipWorkArea }))
  const fixture = makeStage({ displays, content: captured.window.content, contentPhysical: captured.window.physicalContent })
  const screen = fixture.stage.screen
  const original = screen.dipToScreenRect
  screen.screenToDipRect = (win, rect) => {
    const sample = captured.attempts.find(a => rectKey(a.request) === rectKey(rect))
    assert.ok(sample, 'only captured native round trips are used')
    return { ...sample.dip }
  }
  screen.dipToScreenRect = (win, rect) => {
    const sample = win === null && captured.attempts.find(a => rectKey(a.dip) === rectKey(rect))
    return sample ? { ...sample.physical } : original(win, rect)
  }
  fixture.ui.attach(fixture.stage.win)
  const c = captured.window.physicalContent, dpr = 1.5
  fixture.report(rawReport({ pig: { x: (190 - c.x) / dpr - 34, y: 300, width: 68, height: 68 },
    dpr, viewport: { width: c.width / dpr, height: c.height / dpr } }))
  assert.equal(fixture.stage.calls.factor.length, 1)
  assert.equal(fixture.stage.calls.factor[0], captured.window.content.width / c.width)
})
