import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const memory = new Map()
globalThis.localStorage = {
  getItem: key => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)) },
  removeItem: key => { memory.delete(key) },
}
const { createPlacement } = await import('../src/client/desktop/place.js')

// 用户机器上的工作区：1920x1080，顶栏 29px
const AREA = [{ x: 0, y: 29, width: 1920, height: 985 }]
const PIG = { width: 54, height: 54 }
/** 一轮页面量到的东西：窗口（=内容）w x h，猪在（换成这个大小后的）窗口里的左上角 at。 */
const report = (w, h, at, over = {}) => ({ width: w, height: h, pig: PIG, pigWindow: at, pigNow: at, panelOpen: false, ...over })
/** 猪脚底中心的屏幕点。 */
const foot = (win, at, size = PIG) => ({ x: win.x + at.x + size.width / 2, y: win.y + at.y + size.height })
/** 收起时窗口被夹了，页面会把内容反向挪同样多：猪的真实落点 = 窗口 + 猪位置 − 夹取量。 */
const landed = (place, win, at, size = PIG) => foot(win, { x: at.x - place.clamp().dx, y: at.y - place.clamp().dy }, size)

test('第一次摆放：没有存档就把猪现在的位置当家，窗口不动', () => {
  memory.clear()
  const place = createPlacement()
  const win = { x: 1152, y: 180, width: 324, height: 732 }
  const next = place.decide(report(324, 732, { x: 248, y: 120 }), win, AREA)
  assert.deepEqual(next, win)
  assert.deepEqual(place.home(), foot(win, { x: 248, y: 120 }))
})

test('内容怎么变猪都不动：收起↔拖动尺寸、预留面板、气泡，窗口按「家 − 猪在窗口里的位置」摆', () => {
  memory.clear()
  for (const y of [180, 600, 840]) {
    const place = createPlacement()
    const win = { x: 1152, y, width: 304, height: 204 }
    place.decide(report(304, 204, { x: 228, y: 120 }), win, AREA)
    const home = place.home()
    for (const [w, h, at] of [[324, 732, { x: 248, y: 120 }], [304, 204, { x: 228, y: 120 }], [304, 208, { x: 228, y: 124 }], [324, 656, { x: 248, y: 120 }]]) {
      const next = place.decide(report(w, h, at), win, AREA)
      assert.deepEqual(landed(place, next, at), home, `猪在 y=${y}、内容 ${w}x${h} 时猪不能动`)
      assert.ok(next.y >= AREA[0].y && next.y + next.height <= AREA[0].y + AREA[0].height, '窗口不伸出工作区')
    }
    assert.deepEqual(place.home(), home, '家没变')
  }
})

test('上一轮算错了也不会被继承：下一轮按真实布局重新算（每点一下往左跑 20px 的回归）', () => {
  memory.clear()
  const place = createPlacement()
  const win = { x: 1152, y: 180, width: 324, height: 732 }
  place.decide(report(324, 732, { x: 248, y: 120 }), win, AREA)
  const home = place.home()
  // 假设上一轮预测错了 20px，窗口被摆到了 1132
  const wrong = { ...win, x: 1132 }
  const next = place.decide(report(324, 732, { x: 248, y: 120 }), wrong, AREA)
  assert.deepEqual(foot(next, { x: 248, y: 120 }), home, '直接摆回家，不在错的基础上再算')
})

test('换立绘大小（占位纸盒 → 真猪、73x58 ↔ 54x54）脚底中心不动，不需要特殊处理', () => {
  memory.clear()
  const place = createPlacement()
  const win = { x: 1172, y: 380, width: 304, height: 204 }
  place.decide(report(304, 204, { x: 228, y: 120 }), win, AREA)
  const home = place.home()
  const big = { width: 73, height: 58 }
  const next = place.decide({ ...report(304, 208, { x: 209, y: 120 }), pig: big }, win, AREA)
  assert.deepEqual(landed(place, next, { x: 209, y: 120 }, big), { x: home.x + 0.5, y: home.y }, '脚底中心不动（奇数宽差半像素）')
})

test('拖动 / 散步按真实落点重定家，并写进存档（显示器相对、脚底中心）', () => {
  memory.clear()
  const place = createPlacement()
  place.decide(report(304, 204, { x: 228, y: 120 }), { x: 1172, y: 380, width: 304, height: 204 }, AREA)
  place.rehome({ x: 800, y: 500 }, { x: 228, y: 120, width: 54, height: 54 }, AREA)
  assert.deepEqual(place.home(), { x: 1055, y: 674 })
  assert.deepEqual(JSON.parse(memory.get('dsh-piggy:desktop-pig')), { v: 3, area: AREA[0], x: 1055, y: 674 - 29 })
})

test('重启按存档摆：v3 直接用；v2（左上角+大小）和更早的绝对坐标换算成脚底中心', () => {
  const win = { x: 100, y: 100, width: 304, height: 204 }
  const at = { x: 228, y: 120 }
  memory.clear()
  memory.set('dsh-piggy:desktop-pig', JSON.stringify({ v: 3, area: AREA[0], x: 1055, y: 645 }))
  let place = createPlacement()
  assert.deepEqual(foot(place.decide(report(304, 204, at), win, AREA), at), { x: 1055, y: 674 })
  memory.set('dsh-piggy:desktop-pig', JSON.stringify({ v: 2, area: AREA[0], x: 1028, y: 591, w: 54, h: 54 }))
  place = createPlacement()
  assert.deepEqual(foot(place.decide(report(304, 204, at), win, AREA), at), { x: 1055, y: 674 })
  memory.set('dsh-piggy:desktop-pig', JSON.stringify({ x: 1028, y: 620 }))
  place = createPlacement()
  assert.deepEqual(foot(place.decide(report(304, 204, at), win, AREA), at), { x: 1055, y: 674 })
  place.persist(AREA)
  assert.equal(JSON.parse(memory.get('dsh-piggy:desktop-pig')).v, 3, '读过以后升级成 v3')
})

test('显示器拔掉：家落到剩下那块屏里，整只猪看得见', () => {
  memory.clear()
  memory.set('dsh-piggy:desktop-pig', JSON.stringify({ v: 3, area: { x: 0, y: 1080, width: 1920, height: 1080 }, x: 1650, y: 830 }))
  const place = createPlacement()
  place.decide(report(304, 204, { x: 228, y: 120 }), { x: 100, y: 100, width: 304, height: 204 }, AREA)
  const home = place.home()
  assert.ok(home.y <= AREA[0].y + AREA[0].height && home.y - 54 >= AREA[0].y, JSON.stringify(home))
})

test('收起时窗口伸出工作区：窗口照夹，告诉页面夹了多少（页面把内容反向挪，猪不动）', () => {
  memory.clear()
  const place = createPlacement()
  // 猪贴着屏幕底边：脚底在 1012（工作区底边 1014），窗口还要往下留 PAD
  place.rehome({ x: 1172, y: 838 }, { x: 228, y: 120, width: 54, height: 54 }, AREA)
  const next = place.decide(report(304, 204, { x: 228, y: 120 }), { x: 1172, y: 838, width: 304, height: 204 }, AREA)
  assert.ok(next.y + next.height <= 1014, '窗口不伸出工作区')
  assert.equal(place.clamp().dy, next.y - 838, '夹了多少')
  assert.deepEqual(place.home(), { x: 1427, y: 1012 }, '家不动')
})

test('页面已经把内容挪过（shift）：按没挪过的布局算，挪多少每次重新算，不累加', () => {
  memory.clear()
  const place = createPlacement()
  place.rehome({ x: 1172, y: 838 }, { x: 228, y: 120, width: 54, height: 54 }, AREA)
  const first = place.decide(report(304, 204, { x: 228, y: 120 }), { x: 1172, y: 838, width: 304, height: 204 }, AREA)
  const shift = { x: 0, y: -place.clamp().dy }
  // 下一轮：内容已经挪了 shift，猪在窗口里的位置跟着变了
  const second = place.decide(report(304, 204, { x: 228, y: 120 + shift.y }, { shift }), first, AREA)
  assert.deepEqual(second, first, '窗口不再动')
  assert.equal(place.clamp().dy, -shift.y, '还是同一个夹取量（不是 0，也不是两倍）')
})

test('面板开着两边都放不下才挪猪；收起后自动回家', () => {
  memory.clear()
  const place = createPlacement()
  const area = [{ x: 0, y: 29, width: 1280, height: 771 }]
  place.rehome({ x: 723, y: 279 }, { x: 228, y: 120, width: 54, height: 54 }, area)
  const home = place.home()
  // 开面板：内容 324x700，猪在下面，面板往上开但上面只有 370px
  const opened = place.decide(report(324, 700, { x: 248, y: 610 }, { panelOpen: true }), { x: 723, y: 279, width: 304, height: 204 }, area)
  assert.ok(opened.y >= 29 && opened.y + 700 <= 800, '面板整块在屏幕里')
  const closed = place.decide(report(304, 204, { x: 228, y: 120 }), opened, area)
  assert.deepEqual(foot(closed, { x: 228, y: 120 }), home, '收起回到原处')
})

test('macOS：不把窗口摆到托盘高度里（Electron 会静默夹住）', () => {
  memory.clear()
  const area = { x: 0, y: 25, width: 1920, height: 1055 }
  const place = createPlacement({ platform: 'darwin' })
  place.rehome({ x: 1400, y: -90 }, { x: 250, y: 120, width: 54, height: 54 }, [area])
  const next = place.decide(report(324, 692, { x: 250, y: 120 }), { x: 1400, y: 300, width: 324, height: 692 }, [area])
  assert.ok(next.y >= area.y, '窗口 y 不能进托盘：' + next.y)
})

test('游戏包导出桌面模块；更新页只推荐正式版、测试版折叠，可选的外壳更新不再红字', () => {
  const index = readFileSync(new URL('../src/client/index.js', import.meta.url), 'utf8')
  assert.match(index, /exports\.desktop = desktop/)
  const update = readFileSync(new URL('../src/client/tabs/update.js', import.meta.url), 'utf8')
  // G 批次：测试版收进对应正式版下面、默认折叠；只推荐正式版。
  assert.match(update, /var eligible = function \(r\) \{ return !r\.prerelease \}/)
  assert.match(update, /测试版 ' \+ group\.previews\.length \+ ' 个 · 手动安装/)
  assert.match(update, /required \? 'dp-req' : 'dp-dim'/)
})

test('气泡不进窗口外框，猪头上方一直留气泡位置（面板朝下开时冒气泡会让整块内容挪一下，Windows 上出重影）', () => {
  const src = readFileSync(new URL('../src/client/desktop/measure.js', import.meta.url), 'utf8')
  assert.match(src, /if \(bubble !== null\) bubbleRects\.push\(rect\)/)
  assert.match(src, /const outline = rects\.concat\(bubbleZone === null \? \[\] : \[bubbleZone\]\)/)
  assert.match(src, /const shape = rects\.concat\(bubbleRects\)/)
})
