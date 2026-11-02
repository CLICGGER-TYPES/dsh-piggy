// @ts-check
/** 从生产 IPC 和主进程光标轮询验证输入、绘制、拖放与清理的独立边界。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mouseHarness } from './helpers/mouse-harness.js'

const BOUNDS = { x: 300, y: 200, width: 400, height: 360 }
const DRAW = [{ x: 0, y: 0, width: 400, height: 360 }]
const HIT = [{ x: 100, y: 120, width: 40, height: 50 }]
const PIG = { x: 80, y: 100, width: 100, height: 100 }
const PLACE = { bounds: BOUNDS, shape: DRAW, hitShape: HIT, pig: PIG }
const PLATFORMS = [{ platform: 'darwin' }, { platform: 'win32' }, { platform: 'linux' },
  { platform: 'win32', env: { PIGGY_SHAPE: '1' } }]

for (const options of PLATFORMS) {
  const label = JSON.stringify(options)
  test(`立绘接点击，透明动作预留穿透，绘制范围不缩小：${label}`, async () => {
    const shell = await mouseHarness(options)
    shell.send('piggy:place', PLACE)
    shell.point(110, 130)
    shell.poll()
    assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
    const count = shell.mouse.length
    for (let tick = 0; tick < 120; tick++) shell.poll()
    assert.equal(shell.mouse.length, count)
    shell.point(250, 250)
    shell.poll()
    assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: false })
    const usesNativeShape = options.platform === 'linux' || options.env?.PIGGY_SHAPE === '1'
    assert.deepEqual(shell.shapes, usesNativeShape ? [DRAW] : [])
    shell.send('piggy:place', { hitShape: [] })
    shell.point(110, 130)
    shell.poll()
    assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: false })
    assert.deepEqual(shell.shapes, usesNativeShape ? [DRAW] : [])
  })

  test(`拖动保持捕获，放手不把整窗绘制预留变成输入：${label}`, async () => {
    const shell = await mouseHarness(options)
    shell.send('piggy:place', PLACE)
    shell.point(110, 130)
    shell.send('piggy:drag:start', PIG)
    assert.equal(shell.dragging(), true)
    assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
    shell.point(250, 250)
    shell.poll()
    assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
    const before = { ...shell.state.bounds }
    shell.send('piggy:flight:move', { x: 1000, y: 500, slide: { x: 100, y: 50 } })
    shell.send('piggy:place', { ...PLACE, hitShape: DRAW })
    assert.deepEqual(shell.state.bounds, before, '飞行和普通摆放不能抢走原生拖动所有权')
    shell.send('piggy:drag:end')
    assert.equal(shell.dragging(), false)
    shell.point(250, 250)
    shell.poll()
    assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: false })
    assert.equal(shell.ownership().dragShapeActive, true, '放手到新帧期间仍保留整窗绘制')
    const geometry = shell.send('piggy:place', {})
    assert.deepEqual({ ...geometry.window }, shell.state.bounds)
    shell.send('piggy:place', { shape: DRAW, hitShape: HIT, pig: PIG })
    shell.point(110, 130)
    shell.poll()
    assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
  })

  test(`飞行逐帧跟随输入但不扩大透明预留：${label}`, async () => {
    const shell = await mouseHarness(options)
    shell.send('piggy:place', PLACE)
    shell.send('piggy:flight:move', { x: 500, y: 400, slide: { x: 20, y: -30 } })
    shell.point(125, 100)
    shell.poll()
    assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
    shell.point(105, 160)
    shell.poll()
    assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: false })
    shell.send('piggy:flight:move', { x: 600, y: 300, slide: { x: -110, y: 20 } })
    shell.point(5, 150)
    shell.poll()
    assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
    shell.point(35, 150)
    shell.poll()
    assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: false }, '负 slide 不能夹回 0 后扩大命中')
    assert.equal(shell.ownership().flightShapeActive, true)
    shell.send('piggy:place', { shape: DRAW, hitShape: HIT })
    shell.point(5, 150)
    shell.poll()
    assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: false })
    shell.point(110, 130)
    shell.poll()
    assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
  })
}

for (const scaleFactor of [1, 1.25, 2]) {
  test(`窗口移动和已缩放 CSS 输入只换一次坐标，屏幕倍率 ${scaleFactor}`, async () => {
    const shell = await mouseHarness({ platform: 'darwin', scaleFactor })
    const hitShape = [{ x: 100.25, y: 120.5, width: 30.25, height: 20.75 }]
    shell.send('piggy:place', { ...PLACE, hitShape })
    shell.point(100.3, 120.6)
    shell.poll()
    assert.equal(shell.mouse.at(-1).ignore, false)
    shell.point(130.5, 120.6)
    shell.poll()
    assert.equal(shell.mouse.at(-1).ignore, true, '右边界不因四舍五入或 DPR 扩大')
    shell.send('piggy:place', { bounds: { ...BOUNDS, x: -700, y: 80 }, hitShape })
    shell.point(101, 121)
    shell.poll()
    assert.equal(shell.mouse.at(-1).ignore, false)
    shell.send('piggy:place', { hitShape: [{ x: 150, y: 180, width: 45, height: 31.5 }] })
    shell.point(101, 121)
    shell.poll()
    assert.equal(shell.mouse.at(-1).ignore, true)
    shell.point(151, 181)
    shell.poll()
    assert.equal(shell.mouse.at(-1).ignore, false)
  })
}

test('macOS 启动无输入转发，非法 shape 不能握手或替换缓存，错窗口不能更改输入', async () => {
  const shell = await mouseHarness({ platform: 'darwin' })
  assert.deepEqual(shell.mouse, [{ ignore: true, forward: false }])
  for (const hitShape of [null, {}, [null], [{}], [{ ...HIT[0], width: -1 }], [{ ...HIT[0], x: Infinity }]]) {
    assert.equal(shell.send('piggy:place', { ...PLACE, hitShape }), null)
  }
  assert.deepEqual(shell.mouse, [{ ignore: true, forward: false }])
  shell.send('piggy:hit', false)
  assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: true }, '非法 place 没有提前确认现代能力')
  shell.send('piggy:place', PLACE)
  for (const sender of [{ role: 'panel' }, { role: 'ext' }, {}]) {
    assert.equal(shell.send('piggy:place', { ...PLACE, hitShape: DRAW }, sender), null)
    shell.send('piggy:hit', true, sender)
    shell.send('piggy:drag:start', PIG, sender)
  }
  assert.equal(shell.dragging(), false)
  shell.point(250, 250)
  shell.send('piggy:place', { hitShape: [null] })
  shell.poll()
  assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: false })
  shell.send('piggy:shape', DRAW)
  shell.send('piggy:hit', true)
  shell.send('piggy:place', { shape: DRAW })
  shell.poll()
  assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: false }, '缺失字段或旧消息不能扩大独立输入')
  shell.point(110, 130)
  shell.poll()
  assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
})

test('macOS 旧游戏未提供 hitShape 时仍以 shape 接收输入', async () => {
  const shell = await mouseHarness({ platform: 'darwin' })
  shell.send('piggy:place', { bounds: BOUNDS, shape: HIT })
  shell.point(110, 130)
  shell.poll()
  assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
  shell.point(250, 250)
  shell.poll()
  assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: false })
})

test('透明点和非法拖动不能取得全窗捕获，心跳超时恢复穿透', async () => {
  const shell = await mouseHarness({ platform: 'darwin' })
  shell.send('piggy:place', PLACE)
  shell.point(250, 250)
  shell.send('piggy:drag:start', PIG)
  assert.equal(shell.dragging(), false)
  shell.point(110, 130)
  shell.send('piggy:drag:start', { ...PIG, width: Infinity })
  assert.equal(shell.dragging(), false)
  shell.send('piggy:drag:start', PIG)
  assert.equal(shell.dragging(), true)
  shell.point(250, 250)
  shell.state.now += 2001
  shell.tickDrag()
  assert.equal(shell.dragging(), false)
  assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: false })
})

test('窗口关闭清理光标与拖动 timer，已销毁窗口不处理迟到消息', async () => {
  const shell = await mouseHarness({ platform: 'darwin' })
  shell.send('piggy:place', PLACE)
  shell.point(110, 130)
  shell.send('piggy:drag:start', PIG)
  assert.equal(shell.intervals.filter(timer => timer.active).length, 2)
  shell.close()
  assert.equal(shell.dragging(), false)
  assert.equal(shell.intervals.filter(timer => timer.active).length, 0)
  const before = shell.mouse.length
  shell.send('piggy:hit', true)
  assert.equal(shell.send('piggy:place', PLACE), null)
  shell.poll()
  assert.equal(shell.mouse.length, before)
})

test('渲染进程退出结束捕获但保留正常光标轮询', async () => {
  const shell = await mouseHarness({ platform: 'darwin' })
  shell.send('piggy:place', PLACE)
  shell.point(110, 130)
  shell.send('piggy:drag:start', PIG)
  shell.point(250, 250)
  shell.crash()
  assert.equal(shell.dragging(), false)
  assert.equal(shell.intervals.filter(timer => timer.active).length, 1)
  assert.deepEqual(shell.mouse.at(-1), { ignore: true, forward: false })
})

test('只更新输入不会结束 Linux 的新帧绘制保护', async () => {
  const shell = await mouseHarness({ platform: 'linux', frameSubscription: true })
  shell.send('piggy:place', PLACE)
  shell.present()
  shell.point(110, 130)
  shell.send('piggy:drag:start', PIG)
  shell.send('piggy:drag:end')
  const drawingCount = shell.shapes.length
  shell.send('piggy:place', { hitShape: [{ x: 200, y: 210, width: 20, height: 20 }] })
  assert.equal(shell.ownership().dragShapeActive, true)
  assert.equal(shell.shapes.length, drawingCount)
  shell.point(205, 215)
  shell.poll()
  assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
  shell.send('piggy:place', { shape: DRAW, hitShape: HIT })
  assert.equal(shell.frames.length, 2)
  shell.present()
  assert.deepEqual(shell.shapes.at(-1), DRAW)
})

test('延迟到拖动阈值后仍按真实 pointerdown 原点捕获，而非要求当前光标留在猪内', async () => {
  const shell = await mouseHarness({ platform: 'darwin' })
  shell.send('piggy:place', PLACE)
  shell.point(110, 130)
  const origin = { ...shell.state.cursor }
  shell.point(250, 250)
  shell.send('piggy:drag:start', { ...PIG, origin })
  assert.equal(shell.dragging(), true)
  assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
})

test('摸摸动画改变当前墨迹后，已验证的 pointerdown 原点仍能开始延迟拖动', async () => {
  const shell = await mouseHarness({ platform: 'darwin' })
  shell.send('piggy:place', PLACE)
  shell.point(110, 121)
  const origin = { ...shell.state.cursor }
  shell.send('piggy:place', { hitShape: [{ x: 110, y: 130, width: 30, height: 40 }] })
  shell.point(120, 125)
  shell.send('piggy:drag:start', { ...PIG, origin })
  assert.equal(shell.dragging(), true, '不能用摸摸压缩后的墨迹否认 pointerdown 时的合法命中')
  assert.deepEqual(shell.mouse.at(-1), { ignore: false, forward: false })
})

test('非法飞行帧不移动窗口，不让绘制所有权或输入区域变化', async () => {
  const shell = await mouseHarness({ platform: 'darwin' })
  shell.send('piggy:place', PLACE)
  shell.point(250, 250)
  shell.poll()
  const before = { ...shell.state.bounds }, count = shell.mouse.length
  for (const frame of [null, { x: Infinity, y: 0 }, { x: 500, y: 400, slide: null },
    { x: 500, y: 400, slide: { x: NaN, y: 0 } }, { x: 500, y: 400, slide: { x: '10', y: 0 } }]) {
    shell.send('piggy:flight:move', frame)
  }
  assert.deepEqual(shell.state.bounds, before)
  assert.equal(shell.ownership().flightShapeActive, false)
  assert.equal(shell.mouse.length, count)
})

test('Linux 原生绘制提交后重新保证独立输入，包括等待新帧后的异步 shape', async () => {
  const shell = await mouseHarness({ platform: 'linux', frameSubscription: true, resetsInputOnShape: true })
  shell.send('piggy:place', PLACE)
  shell.point(250, 250)
  shell.poll()
  assert.equal(shell.state.ignoresMouse, true)
  shell.present()
  assert.equal(shell.state.ignoresMouse, true, '异步绘制 shape 提交不能恢复整窗输入')
  shell.send('piggy:place', { shape: DRAW, hitShape: HIT })
  assert.equal(shell.state.ignoresMouse, true, '同步 shape 提交后命中未变化也须恢复穿透')
  assert.deepEqual(shell.shapes.at(-1), DRAW)
  shell.point(110, 130)
  shell.poll()
  assert.equal(shell.state.ignoresMouse, false)
  shell.send('piggy:drag:start', PIG)
  assert.equal(shell.state.ignoresMouse, false, '拖动整窗绘制提交保留捕获')
})

test('重建窗口只保留新窗口的一份输入轮询', async () => {
  const shell = await mouseHarness({ platform: 'linux' })
  await shell.recreate()
  assert.equal(shell.intervals.filter(timer => timer.active && timer.delay === 16).length, 1)
  assert.equal(shell.intervals.filter(timer => !timer.active && timer.delay === 16).length, 1)
})
