// @ts-check
/** 执行生产窗口、命中轮询和 IPC 回调；只替换 Electron、时钟及持久化外围。 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createContext, runInContext } from 'node:vm'
import * as geometry from '../lib/window-geometry.js'
import { createResizeShape } from '../lib/resize-shape.js'
import { dragHeartbeatExpired } from '../lib/drag-watchdog.js'
import { pointerHitsShape } from '../lib/pointer-hit.js'
import { validDragOrigin } from '../lib/drag-origin.js'
import { SHOW_FALLBACK_MS, createShowGate } from '../lib/window-show.js'

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
const SHAPE = [{ x: 20, y: 30, width: 60, height: 60 }]
const PIG = { x: 20, y: 30, width: 60, height: 60 }

async function mouseHarness({ platform = 'win32', env = {}, frameSubscription = false } = {}) {
  const handlers = new Map(), intervals = [], mouse = [], shapes = [], sent = []
  const area = { x: 0, y: 0, width: 1920, height: 1040 }
  const display = { workArea: area, bounds: area, scaleFactor: 1, displayFrequency: 60 }
  const state = { bounds: null, cursor: { x: 0, y: 0 }, destroyed: false }
  const frames = [], ended = []
  const webContents = { on() {}, setFrameRate() {}, send: (...args) => sent.push(args),
    ...(frameSubscription ? { isDestroyed:()=>false, beginFrameSubscription:fn=>frames.push(fn), endFrameSubscription:()=>ended.push(true) } : {}) }
  class WindowStub {
    constructor(bounds) { state.bounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } }
    webContents = webContents
    isDestroyed() { return state.destroyed }
    isVisible() { return true }
    getBounds() { return { ...state.bounds } }
    setBounds(bounds) { state.bounds = { ...bounds } }
    setIgnoreMouseEvents(ignore, options) { mouse.push({ ignore, forward: options.forward }) }
    setShape(rects) { shapes.push(JSON.parse(JSON.stringify(rects))) }
    setAlwaysOnTop() {}
    loadURL() {}
    once() {}
    on() {}
  }
  const context = createContext({
    ...geometry, createResizeShape, pointerHitsShape, dragHeartbeatExpired, validDragOrigin, SHOW_FALLBACK_MS, createShowGate,
    process: { platform, env }, BrowserWindow: WindowStub, FRAME_CAP: 0, HERE: '.',
    win: null, quitting: false, petAsked: null, panelPig: null, dragStats: null,
    BOUNDS_TOLERANCE: 2, FALLBACK_CONTENT: { width: 132, height: 152 },
    readWindowState: () => null, pigDisplay: () => display, join: (...parts) => parts.join('/'),
    screen: { getCursorScreenPoint: () => state.cursor, getAllDisplays: () => [display],
      getDisplayMatching: () => display, getDisplayNearestPoint: () => display, getPrimaryDisplay: () => display },
    setInterval: (callback, delay) => { const timer = { callback, delay }; intervals.push(timer); return timer },
    clearInterval() {}, setTimeout() {}, log() {}, followPig() {}, scheduleWindowStateSave() {}, reanchorPanel() {},
    ipcMain: { on: (channel, callback) => handlers.set(channel, callback) },
    Date: { now: () => 1000 },
  })
  const fromPet = source.indexOf('function fromPet(event)')
  runInContext(source.slice(fromPet, source.indexOf('\n/**', fromPet)), context)
  const start = source.indexOf('function workAreaFor(bounds)')
  const end = source.indexOf('\n// ---------------------------------------------------------------------------\n// 面板窗口', start)
  assert.ok(fromPet > 0 && start > 0 && end > start, '必须加载生产窗口和鼠标入口')
  runInContext(source.slice(start, end), context)
  await runInContext('createWindow()', context)
  return {
    mouse, shapes, sent, intervals, state,
    send(channel, payload, sender = webContents) {
      const event = { sender, returnValue: undefined }
      handlers.get(channel)(event, payload)
      return event.returnValue
    },
    poll() { for (const timer of intervals.filter(timer => timer.delay === 16)) timer.callback() },
    point(x, y) { state.cursor = { x: state.bounds.x + x, y: state.bounds.y + y } },
    dragging: () => runInContext('dragSession !== null', context),
    ownership: () => JSON.parse(runInContext('JSON.stringify({dragShapeActive, flightShapeActive, flightSlide})', context)),
    frames, ended,
    present() { frames.at(-1)({getSize:()=>({width:state.bounds.width,height:state.bounds.height})}) },
  }
}

test('geometry reads preserve native drag and flight drawing ownership', async () => {
  const shell = await mouseHarness({platform:'linux'})
  shell.send('piggy:place',{shape:SHAPE,pig:PIG})
  shell.send('piggy:drag:start',{...PIG,slide:true})
  shell.send('piggy:place',{})
  assert.equal(shell.ownership().dragShapeActive,true)
  shell.send('piggy:drag:end')
  shell.send('piggy:flight:move',{x:300,y:200,slide:{x:25,y:40}})
  shell.send('piggy:place',{})
  assert.deepEqual(shell.ownership(),{dragShapeActive:true,flightShapeActive:true,flightSlide:{x:25,y:40}})
})

test('ordinary placement cannot compete with an active native drag, and resumes after release', async () => {
  const shell = await mouseHarness({platform:'linux'})
  shell.send('piggy:place',{shape:SHAPE,pig:PIG})
  shell.send('piggy:drag:start',{...PIG,slide:true})
  const before={...shell.state.bounds}, count=shell.shapes.length
  const requested={x:300,y:200,width:384,height:348}
  shell.send('piggy:place',{bounds:requested,shape:SHAPE,pig:PIG})
  assert.deepEqual(shell.state.bounds,before)
  assert.equal(shell.shapes.length,count)
  assert.equal(shell.ownership().dragShapeActive,true)
  shell.send('piggy:drag:end')
  shell.send('piggy:place',{bounds:requested,shape:SHAPE,pig:PIG})
  assert.deepEqual(shell.state.bounds,requested)
  assert.equal(shell.ownership().dragShapeActive,false)
})

test('drag and flight handoff wait for a new frame before restoring a same-size precise shape', async () => {
  const shell=await mouseHarness({platform:'linux',frameSubscription:true})
  shell.send('piggy:place',{shape:SHAPE,pig:PIG})
  shell.send('piggy:drag:start',{...PIG,slide:true})
  shell.send('piggy:drag:end')
  const shape=[{x:50,y:60,width:60,height:60}]
  shell.send('piggy:place',{shape,pig:PIG})
  const full=[{x:0,y:0,width:shell.state.bounds.width,height:shell.state.bounds.height}]
  assert.deepEqual(shell.shapes.at(-1),full,'the old backing frame still needs the whole native drawing area')
  assert.equal(shell.frames.length,1,'shape-only handoff must also wait for presentation')
  shell.present()
  assert.deepEqual(shell.shapes.at(-1),shape)
  assert.equal(shell.ended.length,1)
  shell.send('piggy:place',{shape,pig:PIG})
  assert.equal(shell.frames.length,1,'idle measurements must not keep capturing frames')
  shell.send('piggy:flight:move',{x:300,y:200,slide:{x:20,y:40}})
  shell.send('piggy:place',{bounds:{...shell.state.bounds},shape,pig:PIG})
  assert.deepEqual(shell.shapes.at(-1),full)
  assert.equal(shell.frames.length,2,'same-size bounds handoff must also wait once')
  shell.present()
  assert.deepEqual(shell.shapes.at(-1),shape)
})

test('未知能力启动不转发，16ms 命中轮询保留且静止 120 帧不重复设置', async () => {
  const shell = await mouseHarness()
  assert.deepEqual(shell.mouse, [{ ignore: true, forward: false }])
  assert.equal(shell.intervals.filter(timer => timer.delay === 16).length, 1)
  for (let tick = 0; tick < 120; tick++) shell.poll()
  assert.equal(shell.mouse.length, 1)
})

test('legacy 首次 hit=false 与启动命中相同也开启转发，重复消息去重', async () => {
  const shell = await mouseHarness()
  shell.send('piggy:hit', false)
  assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: true })
  assert.equal(shell.mouse.length, 2)
  for (let tick = 0; tick < 120; tick++) shell.send('piggy:hit', false)
  assert.equal(shell.mouse.length, 2)
  shell.send('piggy:hit', true)
  assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: true })
  shell.send('piggy:hit', true)
  assert.equal(shell.mouse.length, 3)
  shell.send('piggy:hit', false)
  assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: true })
})

for (const [channel, payload, label] of [
  ['piggy:content', { width: 164, height: 184, immediate: true }, '内容'],
  ['piggy:shape', SHAPE, '非空形状'],
  ['piggy:shape', [], '空形状'],
]) test(`合法 ${label}在命中不变时确认 legacy，重复上报不重设`, async () => {
  const shell = await mouseHarness()
  const result = shell.send(channel, payload)
  assert.deepEqual(shell.mouse, [{ ignore: true, forward: false }, { ignore: true, forward: true }])
  shell.send(channel, payload)
  assert.equal(shell.mouse.length, 2)
  if (channel === 'piggy:content') assert.deepEqual({ ...result.window }, shell.state.bounds)
})

test('modern 只靠生产轮询切换命中，不需要 renderer mousemove 且保持不转发', async () => {
  const shell = await mouseHarness()
  shell.send('piggy:place', { shape: SHAPE })
  shell.point(25, 35)
  shell.poll()
  assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
  for (let tick = 0; tick < 120; tick++) shell.poll()
  assert.equal(shell.mouse.length, 2)
  shell.point(80, 90)
  shell.poll()
  assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: false })
  assert.equal(shell.mouse.length, 3)
})

for (const hit of [false, true]) test(`legacy → modern 在 hit=${hit} 不变时刷新 forward`, async () => {
  const shell = await mouseHarness()
  shell.send('piggy:hit', hit)
  shell.point(hit ? 25 : 0, hit ? 35 : 0)
  const before = shell.mouse.length
  shell.send('piggy:place', { shape: SHAPE })
  assert.equal(shell.mouse.length, before + 1)
  assert.deepEqual(shell.mouse.at(-1), { ignore: !hit, forward: false })
  shell.send('piggy:place', { shape: SHAPE })
  shell.poll()
  assert.equal(shell.mouse.length, before + 1)
})

test('place({}) 是合法同步几何屏障；现代能力无 shape 也不被旧 hit 降级', async () => {
  const shell = await mouseHarness()
  shell.send('piggy:hit', true)
  const result = shell.send('piggy:place', {})
  assert.deepEqual({ ...result.window }, shell.state.bounds)
  assert.equal(result.seq, 0)
  assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
  const before = shell.mouse.length
  shell.send('piggy:hit', false)
  shell.send('piggy:shape', SHAPE)
  shell.send('piggy:content', { width: 164, height: 184 })
  assert.equal(shell.mouse.length, before)
})

test('modern place 后迟到的旧 content/shape/hit 不重开转发，不替换现代轮询形状', async () => {
  const shell = await mouseHarness()
  shell.send('piggy:place', { shape: SHAPE })
  shell.send('piggy:content', { width: 164, height: 184, shape: [] })
  shell.send('piggy:shape', [])
  shell.send('piggy:hit', true)
  assert.deepEqual(shell.mouse, [{ ignore: true, forward: false }])
  shell.point(25, 35)
  shell.poll()
  assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
})

for (const [channel, payloads] of [
  ['piggy:hit', [undefined, null, 0, 1, '', 'true', {}, []]],
  ['piggy:content', [undefined, null, {}, { width: null, height: 184 }, { width: true, height: 184 },
    { width: '164', height: 184 }, { width: -1, height: 184 },
    { width: Infinity, height: 184 }, { width: 164, height: 0 }, { width: 164, height: 184, shape: [null] }]],
  ['piggy:shape', [undefined, null, {}, 'shape', [null], [{}], [{ ...PIG, x: NaN }], [{ ...PIG, width: -1 }]]],
]) test(`非法 ${channel} 不激活 legacy，之后合法 hit=false 仍可确认能力`, async () => {
  const shell = await mouseHarness()
  for (const payload of payloads) assert.doesNotThrow(() => shell.send(channel, payload))
  assert.deepEqual(shell.mouse, [{ ignore: true, forward: false }])
  shell.send('piggy:hit', false)
  assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: true })
  shell.send('piggy:hit', true)
  const before = shell.mouse.length
  for (const payload of payloads) shell.send(channel, payload)
  assert.equal(shell.mouse.length, before, '非法消息也不能改变已确认 legacy 的命中')
})

test('非法 place 不确认 modern，不会阻止后续合法 legacy 消息', async () => {
  const shell = await mouseHarness()
  shell.send('piggy:hit', false)
  const before = shell.mouse.length
  for (const payload of [undefined, null, [], true, 'place', { bounds: null }, { bounds: {} },
    { bounds: { ...PIG, width: 0 } }, { shape: null }, { shape: [null] }, { shape: [{}] },
    { pig: { ...PIG, height: -1 } }]) assert.doesNotThrow(() => shell.send('piggy:place', payload))
  assert.equal(shell.mouse.length, before)
  shell.send('piggy:hit', true)
  assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: true })
})

test('面板、扩展或其他 renderer 的合法消息不能激活能力或命中', async () => {
  const shell = await mouseHarness()
  for (const sender of [{ role: 'panel' }, { role: 'ext' }, {}]) {
    shell.send('piggy:hit', true, sender)
    shell.send('piggy:content', { width: 164, height: 184 }, sender)
    shell.send('piggy:shape', SHAPE, sender)
    assert.equal(shell.send('piggy:place', { shape: SHAPE }, sender), null)
  }
  assert.deepEqual(shell.mouse, [{ ignore: true, forward: false }])
  shell.send('piggy:hit', false)
  assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: true })
})

test('现代拖动期间轮询不抢走命中，心跳与松手采样、同步最终几何仍保留', async () => {
  const shell = await mouseHarness()
  shell.point(25, 35)
  shell.send('piggy:place', { shape: SHAPE, pig: PIG })
  shell.send('piggy:drag:start', PIG)
  assert.equal(shell.dragging(), true)
  const before = { ...shell.state.bounds }
  const mouseCalls = shell.mouse.length
  shell.point(125, 85)
  shell.poll()
  assert.equal(shell.mouse.length, mouseCalls)
  shell.send('piggy:drag:heartbeat')
  assert.equal(shell.state.bounds.x, before.x + 100)
  assert.equal(shell.state.bounds.y, before.y + 50)
  shell.point(35, 45)
  shell.send('piggy:drag:end')
  assert.equal(shell.dragging(), false)
  const final = shell.send('piggy:place', {})
  assert.deepEqual({ ...final.window }, shell.state.bounds)
  assert.ok(final.seq > 0)
  assert.ok(shell.sent.some(([channel]) => channel === 'piggy:geometry'))
  assert.ok(shell.mouse.every(call => call.forward === false))
})

for (const options of [{ platform: 'linux' }, { platform: 'darwin' }, { env: { PIGGY_SHAPE: '1' } }]) {
  test(`原生 shape 路径不使用转发：${JSON.stringify(options)}`, async () => {
    const shell = await mouseHarness(options)
    shell.send('piggy:hit', true)
    shell.send('piggy:place', { shape: SHAPE })
    assert.deepEqual(shell.mouse, [])
    assert.equal(shell.intervals.length, 0)
    // 启动不再先设空形状（Linux 防 Xwayland resize 崩溃），只有 place 这一次。
    assert.equal(shell.shapes.length, options.platform === 'darwin' ? 0 : 1)
  })
}
