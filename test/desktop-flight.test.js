// @ts-check
// A2 弹道：60/120/144Hz 同一套固定子步、不越界、落地/反弹/摔晕判定、旧外壳降级。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createFlight, supportsFlight } from '../src/client/desktop/flight.js'
import { FEEL } from '../src/client/feel/config.js'

const AREA = { x: 0, y: 0, width: 1280, height: 800 }
const PIG = { width: 56, height: 56 }

function simulate(hz, options) {
  const flight = createFlight({
    x: options.x, y: options.y, vx: options.vx, vy: options.vy,
    area: AREA, pig: PIG, artMargin: 40,
  })
  const events = []
  let wall = 0
  while (!flight.done && wall < 3000) {
    events.push(...flight.advance(1000 / hz))
    wall += 1000 / hz
  }
  return { flight, events, wall }
}

test('60/120/144Hz 的轨迹一致（固定 1/120 子步）', () => {
  const runs = [60, 120, 144].map(hz => simulate(hz, { x: 640, y: 700, vx: 1200, vy: -600 }))
  for (const run of runs) {
    assert.ok(Math.abs(run.flight.x - runs[0].flight.x) < 0.5, '水平轨迹一致')
    assert.ok(Math.abs(run.flight.y - runs[0].flight.y) < 0.5, '垂直轨迹一致')
  }
})

test('抛掷不会越出工作区：左右边界和地面都夹住', () => {
  for (const [vx, vy] of [[2200, -1200], [-2200, -1200], [2200, 2200], [0, -300]]) {
    const { flight } = simulate(60, { x: 640, y: 700, vx, vy })
    const bounds = flight.bounds()
    assert.ok(flight.x >= bounds.left - 0.001 && flight.x <= bounds.right + 0.001, `x 越界 (${vx},${vy})`)
    assert.ok(flight.y <= bounds.floor + 0.001, `脚底穿地 (${vx},${vy})`)
    assert.ok(flight.y >= bounds.ceiling - 0.001, `头顶出界 (${vx},${vy})`)
  }
})

test('落地后停止，冲击决定挤压和尘土', () => {
  const { flight, events } = simulate(60, { x: 640, y: 700, vx: 0, vy: -300 })
  const land = events.find(event => event.type === 'land')
  assert.ok(land !== undefined, '必须落地')
  assert.ok(land.speed >= 0)
  assert.ok(flight.impactFor(land.speed) >= 0.04 && flight.impactFor(land.speed) <= FEEL.squashMax)
  assert.ok(flight.dustFor(land.speed) >= 1 && flight.dustFor(land.speed) <= 4)
})

test('从约 600px 高落下会摔晕', () => {
  const { events } = simulate(60, { x: 640, y: 200, vx: 0, vy: 0 })
  const floorHit = events.find(event => event.type === 'bounce' && event.side === 'floor')
  assert.ok(floorHit !== undefined, '第一次落地要记录冲击')
  assert.ok(floorHit.speed > FEEL.dizzyImpact, '第一次落地竖速要超过晕阈值')
  assert.ok(events.some(event => event.type === 'dizzy'), '要有晕事件')
})

test('站在地上平着甩也会先离地再飞出去', () => {
  const flight = createFlight({
    x: 640, y: 800, vx: 1200, vy: 0, area: AREA, pig: PIG, artMargin: 40,
  })
  let minY = flight.y
  let wall = 0
  while (!flight.done && wall < 3000) {
    flight.advance(1000 / 60)
    wall += 1000 / 60
    minY = Math.min(minY, flight.y)
  }
  assert.ok(minY < 795, '要先离地（不能贴着地面立刻落地）')
  assert.ok(flight.x > 900, '要真的飞出去')
})

test('站在地上往下甩不会先弹上天', () => {
  const flight = createFlight({
    x: 640, y: 800, vx: 0, vy: 1200, area: AREA, pig: PIG, artMargin: 40,
  })
  let maxY = flight.y
  while (!flight.done) {
    flight.advance(1000 / 60)
    maxY = Math.max(maxY, flight.y)
  }
  assert.ok(maxY <= 800.001, '不能向上弹')
  assert.equal(flight.landed, true)
})

test('飞太久也会落到地面，不会停在半空', () => {
  const { flight } = simulate(60, { x: 640, y: 700, vx: 0, vy: -2200 })
  assert.equal(flight.landed, true)
  assert.equal(flight.y, flight.bounds().floor)
})

test('旧外壳没有 flyMove 时明确降级', () => {
  assert.equal(supportsFlight(null), false)
  assert.equal(supportsFlight({}), false)
  assert.equal(supportsFlight({ flyMove: function () {} }), true)
})

function multiFlight(areas, values = {}) {
  return createFlight({x: 1100, y: 500, vx: 1200, vy: -200,
    area: areas[0], areas, pig: PIG, artMargin: 40, ...values})
}
function runMulti(flight) {
  const samples = [], events = []
  while (!flight.done && samples.length < 500) {
    events.push(...flight.advance(1000 / 120))
    samples.push([flight.x, flight.y])
  }
  return {samples, events}
}

test('并排屏幕抛掷穿过内侧屏缝，在接收屏落地', () => {
  const flight = multiFlight([AREA, {...AREA, x: 1280}])
  const {samples, events} = runMulti(flight)
  assert.ok(samples.some(([x]) => x > 1400), '必须飞进副屏')
  assert.ok(flight.x > 1280, '落在副屏')
  assert.equal(flight.y, 800)
  assert.ok(!events.some(e => e.side === 'right'), '内侧屏缝不能反弹')
})

test('向负坐标副屏抛掷不会被主屏左边挡住', () => {
  const flight = multiFlight([AREA, {...AREA, x: -1280}], {x: 180, vx: -1200})
  const {samples} = runMulti(flight)
  assert.ok(samples.some(([x]) => x < -100))
  assert.ok(flight.x < 0)
})

test('上下相接的屏幕之间没有虚假的地面', () => {
  const flight = multiFlight([AREA, {...AREA, y: 800}], {x: 640, y: 700, vx: 0, vy: 900})
  const {samples} = runMulti(flight)
  assert.ok(samples.some(([, y]) => y > 1000))
  assert.equal(flight.y, 1600)
})

test('错位双屏只允许从重叠的通道飞过，空白角落仍会反弹', () => {
  const areas = [AREA, {...AREA, x: 1280, y: 400}]
  const blocked = multiFlight(areas, {y: 150, vy: -200})
  let hit = false
  for (let i = 0; i < 30; i++) hit ||= blocked.advance(1000 / 120).some(e => e.side === 'right')
  assert.ok(hit, '上方空白角落应挡住')
  const open = multiFlight(areas, {y: 650, vy: 0})
  const {samples} = runMulti(open)
  assert.ok(samples.some(([x]) => x > 1400), '重叠处可以跨屏')
  for (const [x, y] of samples) {
    if (x > 1280 - 68) assert.ok(y >= 464 - 0.001, '整个身体不能进入上方空白')
    if (x < 1280 + 68) assert.ok(y <= 800.001, '不能掉进左下角空白')
  }
})

test('屏幕之间实际有空隙时不能穿越', () => {
  const flight = multiFlight([AREA, {...AREA, x: 1380}])
  const {samples, events} = runMulti(flight)
  assert.ok(samples.every(([x]) => x <= 1212.001))
  assert.ok(events.some(e => e.side === 'right'))
})
