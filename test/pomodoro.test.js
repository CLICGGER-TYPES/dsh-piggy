/**
 * C2：番茄钟。
 *
 * 数值照 docs/archive/tasks/C-round.md：15/25/45 分钟、休息 5 分钟、完成 +8 🪙 +6 心情、
 * 每天前 8 个给奖励、放弃不给。
 *
 * Run: node --test test/*.test.js
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  STATE_VERSION, abandonPomodoro, applyDevPatch, chat, decay, ensurePomodoro,
  hatchEgg, layEgg, migrate, pomodoroView, settlePomodoro, startPomodoro,
} from '../packages/pet-core/src/core.js'
import { POMODORO_MINUTES, POMODORO_REWARD, POMODORO_REWARDED_PER_DAY } from '../packages/pet-core/src/data.js'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createStore } from '../store.js'
import { SNAPSHOT, PIG, contentOf, findByAttr, hostOf, mount, openPanel, sceneOf, settle } from './helpers/bundle.js'

const readClientFile = name => readFileSync(new URL('../src/client/' + name, import.meta.url), 'utf8')

const MIN = 60_000
const at = (h, m = 0) => new Date(2026, 9, 1, h, m, 0, 0).getTime()

/** 一只已经出壳、可以陪你专注的猪。 */
function piggy(nowMs = at(10)) {
  const state = hatchEgg(nowMs)
  return state
}

/** 走完 n 个番茄（每个 15 分钟，含奖励结算）。 */
function finish(state, nowMs, n) {
  let cursor = nowMs
  for (let i = 0; i < n; i += 1) {
    startPomodoro(state, 15, cursor)
    cursor += 15 * MIN
    settlePomodoro(state, cursor)
    cursor += 1000
  }
  return cursor
}

// ---------------------------------------------------------------------------
// 核心
// ---------------------------------------------------------------------------

test('老存档没有 pomodoro 字段也能用：ensurePomodoro 补默认值、坏数据收拾干净', () => {
  const state = layEgg(at(10))
  delete state.pomodoro
  ensurePomodoro(state)
  assert.deepEqual(state.pomodoro, {
    startedAt: null, minutes: 0, todayDone: 0, day: null, restUntil: null, finishedAt: null, quietBefore: null,
  })

  // 只有 startedAt、没有分钟数：半截状态会永远倒计时，必须清掉。
  state.pomodoro = { startedAt: 12345, minutes: 0, todayDone: -3, day: 'nonsense' }
  const fixed = ensurePomodoro(state)
  assert.equal(fixed.startedAt, null, '半截的运行状态要清掉')
  assert.equal(fixed.todayDone, 0, '负数要夹回 0')
  assert.equal(fixed.day, null, '不是日期键就丢掉')
})

test('开始一个番茄：进入免打扰、开了台词、倒计时从 25 分钟走起', () => {
  const state = piggy()
  const before = state.dialogue.quiet
  const result = startPomodoro(state, 25, at(10))
  assert.equal(result.ok, true)
  assert.equal(state.dialogue.quiet, true, '专注期间猪要免打扰')
  assert.notEqual(before, true)
  const view = pomodoroView(state, at(10))
  assert.equal(view.active, true)
  assert.equal(view.minutes, 25)
  assert.equal(view.secondsLeft, 25 * 60)
  // 台词：开场白说出来了（不是被免打扰吞掉）。
  assert.equal(state.dialogue.lastByScene.pomodoroStart !== undefined, true, '要有开场台词')
})

test('到点之前不结算，到点结算：+8 金币 +6 心情、计数 +1、免打扰放回去', () => {
  const state = piggy()
  startPomodoro(state, 25, at(10))
  const coins = state.coins
  const mood = state.happiness
  assert.equal(settlePomodoro(state, at(10) + 24 * MIN), null, '没到点不结算')
  const done = settlePomodoro(state, at(10) + 25 * MIN)
  assert.equal(done.done, true)
  assert.equal(done.rewarded, true)
  assert.equal(state.coins, coins + POMODORO_REWARD.coins)
  assert.equal(state.happiness, mood + POMODORO_REWARD.happiness)
  assert.equal(state.pomodoro.todayDone, 1)
  assert.equal(state.dialogue.quiet, false, '做完把免打扰恢复原样')
  assert.equal(state.pomodoro.finishedAt, at(10) + 25 * MIN, '留个时间戳给客户端弹通知')
  assert.equal(pomodoroView(state, at(10) + 25 * MIN).breakSecondsLeft, 5 * 60, '休息 5 分钟')
})

test('每天前 8 个给奖励，第 9 个只计数', () => {
  const state = piggy()
  const start = state.coins
  const cursor = finish(state, at(10), POMODORO_REWARDED_PER_DAY)
  assert.equal(state.pomodoro.todayDone, 8)
  assert.equal(state.coins, start + 8 * POMODORO_REWARD.coins, '前 8 个都给钱')

  startPomodoro(state, 15, cursor)
  const done = settlePomodoro(state, cursor + 15 * MIN)
  assert.equal(done.rewarded, false, '第 9 个不给钱')
  assert.equal(state.pomodoro.todayDone, 9, '但要计数')
  assert.equal(state.coins, start + 8 * POMODORO_REWARD.coins, '金币没变')
})

test('换天之后重新数（和签到同一个 06:00 口径）', () => {
  const state = piggy()
  finish(state, at(10), 3)
  assert.equal(state.pomodoro.todayDone, 3)
  // 第二天早上 7 点：新的一天，计数归零。
  const tomorrow = at(10) + 24 * 3600_000
  assert.equal(pomodoroView(state, tomorrow).todayDone, 0)
})

test('中途放弃：不给奖励、不计数、免打扰放回去、有台词', () => {
  const state = piggy()
  const coins = state.coins
  startPomodoro(state, 45, at(10))
  // 真的在中途放弃：45 分钟的一个，20 分钟时就停（不是"到点之后才点放弃"）。
  const result = abandonPomodoro(state, at(10) + 20 * MIN)
  assert.equal(result.ok, true)
  assert.equal(state.pomodoro.todayDone, 0)
  assert.equal(state.coins, coins, '放弃没有钱')
  assert.equal(state.dialogue.quiet, false)
  assert.equal(pomodoroView(state, at(10) + 20 * MIN).active, false)
  assert.notEqual(state.dialogue.lastByScene.pomodoroAbandon, undefined, '要有放弃台词')
})

test('放弃一个已经到点的番茄：按完成处理，计数发奖，且不说放弃台词', () => {
  // 面板关着的时候没人轮询：时间早就到了，主人回来点了「放弃」——
  // 那是做完的番茄，不能当放弃丢掉。
  const state = piggy()
  const coins = state.coins
  startPomodoro(state, 15, at(10))
  const result = abandonPomodoro(state, at(10) + 15 * MIN + 1000)
  assert.equal(result.done, true, '要按完成返回')
  assert.equal(state.pomodoro.todayDone, 1, '计数照常')
  assert.equal(state.coins, coins + POMODORO_REWARD.coins, '奖励照发')
  assert.equal(state.dialogue.lastByScene.pomodoroAbandon, undefined, '不能说放弃台词')
  assert.notEqual(state.dialogue.lastByScene.pomodoroDone, undefined, '要说完成台词')
  assert.equal(state.dialogue.quiet, false, '免打扰也要放回去')
})

test('自己本来就开了免打扰：做完之后仍然是免打扰', () => {
  const state = piggy()
  state.dialogue.quiet = true
  startPomodoro(state, 15, at(10))
  settlePomodoro(state, at(10) + 15 * MIN)
  assert.equal(state.dialogue.quiet, true, '不能把用户自己的设置关掉')
})

test('专注期间猪不闲聊（复用 B6 免打扰）', () => {
  const state = piggy()
  startPomodoro(state, 25, at(10))
  assert.equal(chat(state, 'idle', at(12)).reason, 'silent')
})

test('正在专注 / 不在家 / 纸盒 / 走了都不能再开一个', () => {
  const state = piggy()
  assert.equal(startPomodoro(state, 25, at(10)).ok, true)
  assert.equal(startPomodoro(state, 25, at(10) + 10 * MIN).reason, 'busy', '同时只能一个（还没到点）')

  const away = piggy()
  away.activity = { kind: 'work', endsAt: at(12) }
  assert.equal(startPomodoro(away, 25, at(10)).reason, 'away')

  assert.equal(startPomodoro(layEgg(at(10)), 25, at(10)).reason, 'box')
  const dead = piggy()
  dead.dead = true
  assert.equal(startPomodoro(dead, 25, at(10)).reason, 'dead')
})

test('只认 15/25/45 分钟', () => {
  const state = piggy()
  for (const minutes of POMODORO_MINUTES) {
    const fresh = piggy()
    assert.equal(startPomodoro(fresh, minutes, at(10)).ok, true, `${minutes} 分钟该能开`)
  }
  assert.equal(startPomodoro(state, 20, at(10)).reason, 'minutes')
  assert.equal(startPomodoro(state, 0, at(10)).reason, 'minutes')
})

test('时间往前走（decay）不会把番茄钟弄丢：还在跑，到点由下次结算收', () => {
  const state = piggy()
  startPomodoro(state, 25, at(10))
  decay(state, at(10) + 30 * MIN)
  assert.equal(state.pomodoro.startedAt, at(10), 'decay 不动番茄钟')
  assert.equal(settlePomodoro(state, at(10) + 30 * MIN).rewarded, true)
})

test('调试补丁：一键完成当前番茄会照常结算发奖，今天=8 之后第 9 个不给钱', () => {
  const state = piggy()
  const coins = state.coins
  startPomodoro(state, 45, at(10))
  applyDevPatch(state, { pomodoro: { finish: true } }, at(12))
  assert.equal(state.pomodoro.todayDone, 1)
  assert.equal(state.coins, coins + POMODORO_REWARD.coins, '一键完成要给钱')

  applyDevPatch(state, { pomodoro: { todayDone: 8 } }, at(12))
  assert.equal(state.pomodoro.todayDone, 8)
  startPomodoro(state, 15, at(13))
  applyDevPatch(state, { pomodoro: { finish: true } }, at(14))
  assert.equal(state.pomodoro.todayDone, 9)
  assert.equal(state.coins, coins + POMODORO_REWARD.coins, '第 9 个不再给钱')
})

test('调试快进一小时：番茄钟到点、结算发奖（验收项）', () => {
  const state = piggy()
  const coins = state.coins
  startPomodoro(state, 25, at(10))
  applyDevPatch(state, { __advanceMs: 3600000 }, at(10) + 1000)
  assert.equal(state.pomodoro.todayDone, 1, '快进一小时就该完成一个')
  assert.equal(state.coins, coins + POMODORO_REWARD.coins, '并且发奖')
  assert.equal(state.pomodoro.startedAt, null)
})

test('存档迁移带上番茄钟字段，版本号不动', () => {
  const old = hatchEgg(at(10))
  delete old.pomodoro
  const migrated = migrate(JSON.parse(JSON.stringify(old)), at(11))
  assert.equal(typeof migrated.pomodoro, 'object')
  assert.equal(migrated.pomodoro.startedAt, null)
  assert.equal(typeof STATE_VERSION, 'number', 'STATE_VERSION 由 Claude 管，这里只确认它还在')
})

// ---------------------------------------------------------------------------
// 客户端
// ---------------------------------------------------------------------------

const POMO_OFF = {
  active: false, minutes: 0, secondsLeft: 0, breakSecondsLeft: 0, todayDone: 0, rewardedToday: 0,
  cap: 8, reward: { coins: 8, happiness: 6 }, breakMinutes: 5, options: [15, 25, 45], finishedAt: null,
}

/** 打开面板 → 主屏 → 番茄钟 App。 */
async function openPomodoro(status, extra = {}) {
  const mounted = await mount({ status, ...extra })
  // 先落到主屏，确认有这个 App（进去以后主屏就换掉了），再点进去。
  openPanel(mounted.dom)
  const tile = findByAttr(contentOf(mounted.dom), 'data-app', 'pomodoro')
  mounted.tileText = tile === undefined ? '' : tile.allText()
  if (tile !== undefined) tile.fire('click')
  return mounted
}

test('主屏有番茄钟 App，点进去是三个时长', async () => {
  const { dom, tileText } = await openPomodoro({ ...SNAPSHOT, pomodoro: POMO_OFF })
  assert.ok(tileText.includes('🍅'), `主屏要有番茄钟：${tileText}`)
  for (const minutes of POMODORO_MINUTES) {
    assert.notEqual(findByAttr(contentOf(dom), 'data-pomo-start', String(minutes)), undefined, `${minutes} 分钟按钮`)
  }
  assert.ok(contentOf(dom).allText().includes('每天前 8 个给奖励'), contentOf(dom).allText())
})

test('点 25 分钟会发 pomodoro 动作', async () => {
  const { dom, calls } = await openPomodoro({ ...SNAPSHOT, pomodoro: POMO_OFF }, { actResult: { ...SNAPSHOT, pomodoro: { ...POMO_OFF, active: true, minutes: 25, secondsLeft: 1500 } } })
  findByAttr(contentOf(dom), 'data-pomo-start', '25').fire('click')
  await settle()
  const post = JSON.parse(String(calls.filter(call => call.method === 'POST').at(-1).body))
  assert.deepEqual(post, { action: 'pomodoro', minutes: 25 })
})

test('专注中：猪头顶挂着剩余时间，页面上是倒计时和放弃', async () => {
  const active = { ...POMO_OFF, active: true, minutes: 25, secondsLeft: 754 }
  const { dom } = await openPomodoro({ ...SNAPSHOT, pomodoro: active })
  const pill = findByAttr(sceneOf(dom), 'data-pomo-pill', 'true')
  assert.notEqual(pill, undefined, '猪头顶要有番茄钟药丸')
  assert.ok(pill.allText().includes('12:34'), `药丸要写剩余时间：${pill.allText()}`)
  assert.ok(contentOf(dom).allText().includes('12:34'), '页面上也是倒计时')
  assert.notEqual(findByAttr(contentOf(dom), 'data-pomo-abandon', 'true'), undefined, '要有放弃按钮')
})

test('放弃按钮发 pomodoroAbandon', async () => {
  const active = { ...POMO_OFF, active: true, minutes: 25, secondsLeft: 60 }
  const { dom, calls } = await openPomodoro({ ...SNAPSHOT, pomodoro: active }, { actResult: { ...SNAPSHOT, pomodoro: POMO_OFF } })
  findByAttr(contentOf(dom), 'data-pomo-abandon', 'true').fire('click')
  await settle()
  const post = JSON.parse(String(calls.filter(call => call.method === 'POST').at(-1).body))
  assert.deepEqual(post, { action: 'pomodoroAbandon' })
})

test('状态页不显示番茄钟（G 批次反馈：状态页保持简洁）', async () => {
  const { dom } = await mount({ status: { ...SNAPSHOT, pomodoro: { ...POMO_OFF, todayDone: 3 } } })
  openPanel(dom, 'status')
  assert.equal(contentOf(dom).allText().includes('番茄钟'), false, contentOf(dom).allText())
})

test('完成时：有通知权限就发浏览器通知，没有就退回猪的气泡', async () => {
  const finished = { ...POMO_OFF, todayDone: 1, finishedAt: at(10) }
  const notices = []
  class FakeNotification {
    static permission = 'granted'
    constructor(title, options) { notices.push({ title, body: options?.body }) }
  }
  globalThis.Notification = FakeNotification
  let withPermission
  try {
    withPermission = await mount({
      status: { ...SNAPSHOT, pomodoro: finished },
      windowExtra: { Notification: FakeNotification },
    })
    openPanel(withPermission.dom, 'status')
    await settle()
    assert.equal(notices.length, 1, '要弹一条通知')
    assert.ok(notices[0].title.includes('专注结束'), notices[0].title)
  } finally {
    delete globalThis.Notification
  }

  // 没权限：走气泡。
  const bubbleCase = await mount({ status: { ...SNAPSHOT, pomodoro: finished } })
  openPanel(bubbleCase.dom)
  await settle()
  assert.ok(findByAttr(sceneOf(bubbleCase.dom), 'data-bubble-shown', 'true') !== undefined
    || sceneOf(bubbleCase.dom).allText().includes('专注结束'), '没权限就用气泡说一声')
})

test('同一个番茄只弹一次通知（轮询不重复弹）', async () => {
  const finished = { ...POMO_OFF, todayDone: 1, finishedAt: at(10) }
  const notices = []
  class FakeNotification {
    static permission = 'granted'
    constructor(title) { notices.push(title) }
  }
  globalThis.Notification = FakeNotification
  try {
    const mounted = await mount({ status: { ...SNAPSHOT, pomodoro: finished }, windowExtra: { Notification: FakeNotification } })
    openPanel(mounted.dom, 'status')
    await settle()
    // 再渲染几次（模拟轮询）
    for (let i = 0; i < 3; i += 1) {
      findByAttr(contentOf(mounted.dom), 'data-action', 'pet').fire('click')
      await settle()
    }
    assert.equal(notices.length, 1, '同一个 finishedAt 只弹一次')
  } finally {
    delete globalThis.Notification
  }
})

test('调试页有番茄钟组：完成当前 / 今天=8', async () => {
  const realNow = Date.now
  let now = 11_000_000
  Date.now = () => now
  try {
    const mounted = await mount({ status: { ...SNAPSHOT, pomodoro: POMO_OFF } })
    openPanel(mounted.dom)
    for (let i = 0; i < 7; i += 1) {
      now += 100
      findByAttr(contentOf(mounted.dom), 'data-version', 'true').fire('click')
    }
    const home = findByAttr(contentOf(mounted.dom), 'data-home', 'true')
    if (home !== undefined) home.fire('click')
    findByAttr(contentOf(mounted.dom), 'data-app', 'dev').fire('click')
    for (const key of ['pomoDone', 'pomoCap']) {
      assert.notEqual(findByAttr(contentOf(mounted.dom), 'data-dev', key), undefined, `调试页要有 ${key}`)
    }
    findByAttr(contentOf(mounted.dom), 'data-dev', 'pomoDone').fire('click')
    await settle()
    const post = JSON.parse(String(mounted.calls.filter(call => call.method === 'POST').at(-1).body))
    assert.equal(post.action, 'dev')
    assert.equal(post.patch.pomodoro.finish, true)
  } finally {
    Date.now = realNow
  }
})

test('走真实 store：开一个番茄，时间到之后读一次状态就结算发奖', () => {
  // 这条守的是验收里的「关着面板也会结算」：结算挂在 store 的 freshen 上。
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-pomo-'))
  let clock = at(10)
  const store = createStore(join(dir, 'state.json'), { now: () => clock, setTimer: () => 0, clearTimer: () => {} })
  try {
    store.hatch()
    const before = store.state.coins
    assert.equal(store.startPomodoro(25).ok, true)
    assert.equal(store.state.pomodoro.startedAt, clock)

    clock += 24 * MIN
    store.freshen()
    assert.equal(store.state.coins, before, '没到点不给钱')

    clock += 2 * MIN
    store.freshen()
    assert.equal(store.state.coins, before + POMODORO_REWARD.coins, '到点后读一次状态就结算')
    assert.equal(store.state.pomodoro.todayDone, 1)
    assert.equal(store.state.pomodoro.startedAt, null)
  } finally {
    store.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// C2 返工：头顶角标的位置
// ---------------------------------------------------------------------------

test('角标挂在猪身上（跟着猪一起动），不是挂在场景上', async () => {
  const active = { ...POMO_OFF, active: true, minutes: 45, secondsLeft: 2700 }
  const { dom } = await openPomodoro({ ...SNAPSHOT, pomodoro: active })
  const pill = findByAttr(sceneOf(dom), 'data-pomo-pill', 'true')
  assert.notEqual(pill, undefined)
  assert.equal(pill.parentNode.className.includes('dp-pig'), true, '父节点必须是猪立绘，这样它才跟着猪走')
})

test('角标的 CSS：贴右上角、离猪头不过 20px、层级高于装扮（帽子不会压住它）', () => {
  // 这条守的是返工原因：原来它挂在场景上、z-index:4，面板打开时正好压在「今天完成」那行上。
  const css = readClientFile('css-tiles.js')
  const rule = /\.dp-pomo\{([^}]*)\}/.exec(css)
  assert.notEqual(rule, null, '找不到 .dp-pomo 规则')
  const body = rule[1].replace(/\s+/g, '')
  const bottom = /bottom:calc\(100%\+(\d+)px\)/.exec(body)
  assert.notEqual(bottom, null, '要相对猪（100%）定位，不是相对场景')
  const lineHeight = Number(/\.dp-pomo\{|line-height:(\d+(?:\.\d+)?)px/.exec(body.replace('line-height:', 'line-height:'))?.[1] ?? 0)
  const padding = /\.dp-pomo\{|padding:(\d+)px(\d+)px/.exec(body.replace('padding:', 'padding:'))
  const padY = padding === null ? 0 : Number(padding[1])
  const total = Number(bottom[1]) + lineHeight + padY * 2
  assert.ok(total <= 20, `角标最多高出猪头 ${total}px（要求 20px 以内）`)
  assert.ok(/right:/.test(body), '贴右上角')
  const z = /z-index:(\d+)/.exec(body)
  assert.notEqual(z, null, '要写明层级')
  // 2026-10-04 Windows 实测：戴帽子时帽子（装扮层 z-index:3）压住角标。
  assert.ok(Number(z[1]) > 3, `层级要高于装扮层（3），现在是 ${z[1]}`)
})

test('猪说话的时候角标让位（气泡和角标挨着，宁可角标先消失）', async () => {
  const active = { ...POMO_OFF, active: true, minutes: 45, secondsLeft: 2700 }
  // G 批次起摸猪的那句话由核心说：动作返回的快照里带一条台词消息。
  const said = { ...SNAPSHOT, pomodoro: active, pending: [{ id: 9001, at: Date.now(), kind: 'line', text: '呼噜呼噜……', scene: 'pet', replies: [] }] }
  const { dom } = await openPomodoro({ ...SNAPSHOT, pomodoro: active }, { actResult: said })
  const scene = sceneOf(dom)
  const pill = findByAttr(scene, 'data-pomo-pill', 'true')

  // 左键摸一下 → 核心回一句 → 猪说出来 → 角标让位。
  scene.fire('pointerdown', { button: 0, clientX: 0, clientY: 0 })
  scene.fire('pointerup', {})
  await settle()
  const bubble = findByAttr(scene, 'data-bubble-shown', 'true')
  assert.equal(bubble.hidden, false, '气泡应该出来了')
  assert.equal(pill.hidden, true, '气泡在场时角标不显示')
  // 气泡收起后由下一次重绘放回来，这里只确认面板记着「专注中」这个事实
  // （真机采样：气泡消失约 3 秒后角标回来，见卡末验证记录）。
  assert.equal(pill.getAttribute('data-pomo'), 'on', '面板要知道专注还在，好把角标放回来')
})
