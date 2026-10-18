// @ts-check
// 混合缩放多屏：窗口管理器把 setBounds 夹回旧位置时，页面必须收敛，不能每帧重发同一个目标。
import assert from 'node:assert/strict'
import { test } from 'node:test'

const memory = new Map()
globalThis.localStorage = {
  getItem: key => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)) },
  removeItem: key => { memory.delete(key) },
}
const { createPlacement } = await import('../src/client/desktop/place.js')
const { createWindowClamp } = await import('../src/client/desktop/window-clamp.js')

// 用户日志里的内置屏：Electron 报 1536×864（缩放 2），Mutter 实际允许的窗口顶部只到 522。
const AREA = [{ x: 2560, y: 0, width: 1536, height: 864 }]
const PIG = { width: 58, height: 58 }
const AT = { x: 233, y: 144 }
const report = (over = {}) => ({ width: 360, height: 292, pig: PIG, pigWindow: AT, pigNow: AT, panelOpen: false, ...over })

test('窗口管理器反复夹回 y=522：有限次后接受实际位置，不再请求 554', () => {
  memory.clear()
  const place = createPlacement()
  // 用户存档里的家：脚底 756（窗口理应在 554，但 Mutter 只给到 522）。
  place.rehome({ x: 3718, y: 554 }, { ...AT, width: PIG.width, height: PIG.height }, AREA)
  const guard = createWindowClamp()
  let actual = { x: 3718, y: 522, width: 360, height: 292 }
  let requests = 0
  let accepted = 0
  let convergedAt = null
  for (let i = 0; i < 30; i += 1) {
    const want = place.decide(report(), actual, AREA)
    requests += 1
    if (Math.abs(want.x - actual.x) <= 2 && Math.abs(want.y - actual.y) <= 2) {
      convergedAt = requests
      break
    }
    const clamped = { ...want, y: 522 }
    if (guard.observe(want, clamped) === 'accept') {
      place.acceptWindow(clamped, { ...AT, width: PIG.width, height: PIG.height })
      accepted += 1
    }
    actual = clamped
  }
  assert.equal(accepted, 1, '只接受一次实际位置')
  assert.ok(convergedAt !== null, '必须收敛')
  assert.ok(convergedAt <= 8, `请求次数 ${convergedAt} 太多`)
  const settled = place.decide(report(), actual, AREA)
  assert.ok(Math.abs(settled.y - actual.y) <= 2, '接受后不再请求 554')
})

test('接受实际位置时不在存档里改家', () => {
  memory.clear()
  const place = createPlacement()
  place.rehome({ x: 3718, y: 554 }, { ...AT, width: PIG.width, height: PIG.height }, AREA)
  const saved = memory.get('dsh-piggy:desktop-pig')
  place.acceptWindow({ x: 3718, y: 522, width: 360, height: 292 }, { ...AT, width: PIG.width, height: PIG.height }, AREA)
  place.persist(AREA)
  assert.equal(memory.get('dsh-piggy:desktop-pig'), saved, '存档里的家不能被窗口管理器的夹取改写')
  assert.equal(place.home().y, 522 + AT.y + PIG.height, '内存里的家按实际位置重算')
})

test('X11 异步回读的短暂旧值不会被当成夹取', () => {
  const guard = createWindowClamp()
  const want = { x: 3718, y: 554, width: 360, height: 292 }
  const stale = { x: 3718, y: 522, width: 360, height: 292 }
  for (let i = 1; i <= 5; i += 1) assert.equal(guard.observe(want, stale), 'retry', `第 ${i} 次只重试`)
  assert.equal(guard.observe(want, stale), 'accept', '第 6 次才接受')
})

test('目标一变就重新计数；成功回读会清零', () => {
  const guard = createWindowClamp()
  const first = { x: 3718, y: 554, width: 360, height: 292 }
  const stale = { x: 3718, y: 522, width: 360, height: 292 }
  for (let i = 0; i < 5; i += 1) guard.observe(first, stale)
  assert.equal(guard.observe({ ...first, y: 560 }, stale), 'retry', '新目标重新计数')
  assert.equal(guard.observe({ ...first, y: 560 }, { ...stale, y: 560 }), 'ok', '目标达成即清零')
  assert.equal(guard.attempts(), 0)
})
