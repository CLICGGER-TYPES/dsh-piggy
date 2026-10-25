// 盲盒 4.0.3 薄卡界面：卡池 / 单抽 / 十连的状态、逐张揭晓时序与行为。
// 只跑 client.js + server.js 的纯源码（fakeDom，不启浏览器、不连宿主），结果都从 server 的真实事务里取。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import blindbox, { CATALOG } from '../extensions/blindbox/server.js'
import { harness } from './helpers/blindbox-ui.js'

const T0 = Date.UTC(2026, 9, 6, 12)
const SOURCE = readFileSync(new URL('../extensions/blindbox/client.js', import.meta.url), 'utf8')
const labelOf = key => (CATALOG.find(entry => entry.key === key) ?? { label: '未知摆件' }).label
const emojiOf = key => (CATALOG.find(entry => entry.key === key) ?? { emoji: '❔' }).emoji
const seq = (...values) => { let i = 0; return () => values[Math.min(i++, values.length - 1)] }
const lcg = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
const classesOf = node => (typeof node.className === 'string' ? node.className.split(/\s+/) : [])

function allClass(ui, name) {
  const found = []
  ui.dom.body.walk(node => { if (classesOf(node).includes(name)) found.push(node) })
  return found
}
function oneClass(ui, name) {
  const found = allClass(ui, name)
  assert.equal(found.length, 1, '应该正好有一个 .' + name)
  return found[0]
}
/** 每张十连卡的翻面层（--tf）和抖动层（--ts）。 */
function tenLayers(ui) {
  return allClass(ui, 'bx-tcard').map(cell => {
    let flip = null
    let shake = null
    cell.walk(node => {
      if (classesOf(node).includes('bx-flip')) flip = node
      if (classesOf(node).includes('bx-shake')) shake = node
    })
    return { cell, flip, shake }
  })
}
function mainLayers(ui) {
  const main = oneClass(ui, 'bx-main')
  let flip = null
  let shake = null
  main.walk(node => {
    if (classesOf(node).includes('bx-flip')) flip = node
    if (classesOf(node).includes('bx-shake')) shake = node
  })
  return { main, flip, shake }
}
function frontNames(ui) {
  return allClass(ui, 'bx-front').map(front => {
    let name = ''
    front.walk(node => { if (node.tagName === 'b') name = node.textContent })
    return name
  })
}
function flushZero(ui) {
  for (const [id, timer] of [...ui.pending.entries()]) {
    if (timer.ms !== 0) continue
    ui.pending.delete(id)
    timer.fn()
  }
}
function runTimers(ui, limit = 40) {
  for (let i = 0; i < limit && ui.pending.size > 0; i += 1) {
    for (const [id, timer] of [...ui.pending.entries()]) {
      ui.pending.delete(id)
      timer.fn()
    }
  }
  assert.equal(ui.pending.size, 0, '所有计时器都应该在终态前跑完')
}

function fakeApi({ coins = 20_000, tickets = 0, wallet = true } = {}) {
  let balance = 0
  const bag = { boxticket: tickets }
  const api = {
    now: T0,
    coins: () => coins,
    spend: n => { if (coins < n) return false; coins -= n; return true },
    earn: n => { coins += n },
    count: key => bag[key] ?? 0,
    take: (key, n = 1) => { if ((bag[key] ?? 0) < n) return false; bag[key] -= n; return true },
    give: (key, n = 1) => { bag[key] = (bag[key] ?? 0) + n; return true },
    say() {},
  }
  if (wallet) api.wallet = { balance: () => balance, earn: n => { balance += n; return n }, spend: n => { if (balance < n) return false; balance -= n; return true } }
  return { api, balance: () => balance, tickets: () => bag.boxticket }
}


function drawView(data, api, payload, random) {
  const result = blindbox.actions.open(data, payload, api, random)
  assert.equal(result.ok, true)
  return blindbox.view(data, api)
}

test('卡池：常驻/限时、UP、概率/保底、价格、券、凭证、图鉴入口都在，并能切换池子', () => {
  const data = blindbox.init()
  const { api } = fakeApi({ tickets: 2 })
  const view = blindbox.view(data, api)
  const ui = harness(view)
  assert.equal(ui.all('data-bx-banner').length, 2)
  assert.equal(ui.find('data-bx-banner', 'standard').getAttribute('aria-pressed'), 'true')
  assert.match(ui.text(), /常驻/)
  assert.match(ui.text(), /限时/)
  assert.match(ui.text(), new RegExp(labelOf(view.banners[0].up6[0])))
  assert.match(ui.text(), /六星 2%/)
  assert.match(ui.text(), /寻访 1 次/)
  assert.match(ui.text(), /寻访 10 次/)
  assert.match(ui.text(), /2700/)
  assert.match(ui.text(), /盲盒券寻访 1 次（有 2 张）/)
  assert.match(ui.text(), /资质凭证|📜/)
  assert.equal(ui.all('data-bx-dex').length, 1)
  assert.equal(ui.all('data-bx-draw').length, 2)
  assert.ok(ui.find('data-bx-big', '1'))
  ui.click('data-bx-banner', 'limited')
  assert.equal(ui.find('data-bx-banner', 'limited').getAttribute('aria-pressed'), 'true')
  assert.match(ui.text(), /剩 \d+ 天/)
})

test('外观回到 2.1 主题：青绿按钮/16 圆角/3px 实体阴影、金券奶油金边、文字跟主题色', () => {
  const rules = []
  for (const match of SOURCE.matchAll(/'([^']*)'/g)) if (match[1].includes('{')) rules.push(match[1])
  const ruleOf = selector => {
    const found = rules.find(rule => rule.split('{')[0].split(',').map(part => part.trim()).includes(selector) || rule.includes(selector + '{'))
    assert.ok(found, '找不到样式规则 ' + selector)
    return found
  }
  const btn = ruleOf('.bx-btn')
  assert.match(btn, /background:var\(--ac-primary/)
  assert.match(btn, /border-radius:16px/)
  assert.match(btn, /box-shadow:0 3px 0/)
  assert.match(btn, /font-size:12px/)
  const ticket = ruleOf('.bx-btn[data-bx-ticket]')
  assert.match(ticket, /background:var\(--paper\)/)
  assert.match(ticket, /border:2px solid #dfb949/)
  assert.match(ruleOf('.bx-tab[aria-pressed="true"]'), /background:var\(--ac-primary/)
  assert.match(ruleOf('.bx-skip'), /border-radius:16px/)
  assert.match(ruleOf('.bx-skip'), /font-size:12px/)
  assert.match(ruleOf('.bx-back-btn'), /width:32px/)
  assert.match(ruleOf('.bx-back-btn'), /border-radius:16px/)
  // 不再有覆盖主题的黑底/黑字胶囊按钮。
  assert.equal(/#2f2c26|#faf6ee/.test(SOURCE), false, '不要再用黑底/黑字覆盖主题')
  assert.match(ruleOf('.bx'), /color:var\(--ac-text/)
  for (const match of SOURCE.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
    assert.ok(Number(match[1]) >= 12, '字号至少 12px：' + match[0])
  }
})

test('单抽：先卡背抖动再翻面，揭晓前 DOM 里没有答案，跳过/收下/返回/重播都不再发 draw', () => {
  const data = blindbox.init()
  const { api } = fakeApi()
  const pool = blindbox.view(data, api)
  const view = drawView(data, api, { banner: 'standard', count: 1 }, seq(0.05, 0.2, 0.1))
  const got = data.last.items[0]
  assert.equal(got.stars, 5)
  const label = labelOf(got.key)
  const emoji = emojiOf(got.key)
  const ui = harness(pool)
  ui.show(view)
  assert.equal(ui.settled(), 'false')
  assert.equal(ui.all('data-bx-draw').length, 0, '揭晓里不该再出现抽卡按钮')
  assert.equal(allClass(ui, 'bx-back').length, 1, '先看到卡背')
  assert.equal(allClass(ui, 'bx-front').length, 0, '翻面前不构建正面')
  assert.equal(ui.all('data-s').length, 0, '翻面前不挂星级')
  assert.equal(ui.all('data-lit').length, 0, '翻面前不挂稀有度光')
  assert.match(ui.text(), /正在揭开/)
  for (const secret of [label, emoji, '★★★★★', '首次获得', '潜能', '六星']) {
    assert.equal(ui.text().includes(secret), false, '揭晓前不该泄露：' + secret)
  }
  assert.ok(ui.find('data-bx-skip', '1'))
  assert.equal(ui.find('data-bx-done', '1'), undefined, '动画没放完之前不显示收下')

  // 抖动阶段：抖动先开始，翻面还在等；单抽抖动 0.6s（0.5~0.7 之间）。
  const start = mainLayers(ui)
  assert.equal(start.shake.style.getPropertyValue('--ts'), '0.00s')
  assert.equal(start.flip.style.getPropertyValue('--tf'), '0.60s')
  ui.clock.t += 500
  ui.rerender()
  assert.equal(mainLayers(ui).flip.style.getPropertyValue('--tf'), '0.10s')
  assert.equal(ui.text().includes(label), false, '抖动中途还是卡背')

  ui.clock.t += 200
  ui.rerender()
  assert.equal(allClass(ui, 'bx-front').length, 0, '翻面前半圈还是只有卡背')
  assert.equal(allClass(ui, 'bx-back').length, 1)

  ui.clock.t += 200
  ui.rerender()
  assert.equal(allClass(ui, 'bx-front').length, 1, '过 90 度中点才出现正面')
  assert.equal(allClass(ui, 'bx-back').length, 0, '卡面出现后不再同时留着卡背')
  assert.match(ui.text(), new RegExp(label))
  ui.clock.t += 800
  ui.rerender()
  assert.equal(ui.settled(), 'true')
  assert.equal(allClass(ui, 'bx-back').length, 0)
  assert.equal(ui.all('data-bx-skip').length, 0)
  assert.equal(ui.find('data-bx-done', '1').textContent, '收下')
  assert.equal(ui.all('data-bx-replay').length, 1)
  assert.match(ui.text(), /★★★★★/)
  assert.match(ui.text(), /首次获得/)
  assert.equal(ui.sent.length, 0)

  // 重播：回到卡背，答案文本再次消失；播完还是同一笔结果。
  ui.click('data-bx-replay', '1')
  assert.equal(ui.settled(), 'false', '重播只是本地重放')
  assert.equal(allClass(ui, 'bx-front').length, 0)
  assert.equal(ui.text().includes(label), false, '重播从卡背开始，不闪出卡面')
  assert.equal(data.pulls, 1)
  ui.clock.t += 5000
  ui.rerender()
  assert.equal(ui.all('data-bx-done').length, 1)
  ui.click('data-bx-done', '1')
  assert.equal(ui.all('data-bx-banner').length, 2, '收下后回到卡池')
  assert.equal(ui.sent.length, 0)
  assert.equal(data.pulls, 1, '跳过/重播/收下都没有再抽一次')
  assert.equal(data.last.items.length, 1)
})

test('跳过：立刻是完整正面终态，计时器清干净，不留下遮罩或半张卡', () => {
  const data = blindbox.init()
  const { api } = fakeApi()
  const pool = blindbox.view(data, api)
  const view = drawView(data, api, { banner: 'standard', count: 1 }, seq(0.05, 0.2, 0.1))
  const ui = harness(pool)
  ui.show(view)
  flushZero(ui)
  const label = labelOf(data.last.items[0].key)
  assert.ok(ui.pending.size > 0, '揭晓中应该有相位计时器')
  ui.click('data-bx-skip', '1')
  assert.equal(ui.settled(), 'true')
  assert.equal(ui.pending.size, 0, '跳过之后不再留计时器')
  assert.equal(allClass(ui, 'bx-front').length, 1)
  assert.equal(allClass(ui, 'bx-back').length, 0, '跳过直接给静态正面')
  assert.ok(frontNames(ui).includes(label))
  assert.equal(allClass(ui, 'bx-hint').length, 0)
  assert.ok(ui.find('data-bx-done', '1'))
  assert.equal(ui.find('data-bx-skip', '1'), undefined)
  assert.match(ui.text(), new RegExp(label))
  assert.equal(ui.sent.length, 0)
})

test('十连：一张一张播完整（抖 0.6s → 翻 0.46s → 正面停留 ≥0.7s），第 1 张播完才换第 2 张', () => {
  const data = blindbox.init()
  const { api } = fakeApi({ coins: 1_000_000 })
  const pool = blindbox.view(data, api)
  const view = drawView(data, api, { banner: 'limited', count: 10 }, lcg(7))
  assert.equal(data.last.items.length, 10)
  const labels = data.last.items.map(got => labelOf(got.key))
  const ui = harness(pool)
  ui.show(view)
  assert.equal(ui.settled(), 'false')
  assert.equal(allClass(ui, 'bx-tcard').length, 0, '播放时不预建总览网格')
  assert.equal(allClass(ui, 'bx-main').length, 1, '舞台上只有当前这一张主卡')
  assert.equal(allClass(ui, 'bx-back').length, 1)
  assert.equal(allClass(ui, 'bx-front').length, 0)
  assert.match(ui.text(), /1 \/ 10/, '进度写清楚第几张')
  for (const label of labels) assert.equal(ui.text().includes(label), false, '十连揭晓前不泄露：' + label)

  const layer = () => mainLayers(ui)
  assert.equal(layer().shake.style.getPropertyValue('--ts'), '0.00s')
  assert.equal(layer().flip.style.getPropertyValue('--tf'), '0.60s')

  ui.clock.t = 500
  ui.rerender()
  assert.equal(layer().flip.style.getPropertyValue('--tf'), '0.10s', '重画接着抖，不重头开始')
  assert.equal(allClass(ui, 'bx-front').length, 0, '抖动阶段只有卡背')
  assert.match(ui.text(), /1 \/ 10/)

  ui.clock.t = 900
  ui.rerender()
  assert.equal(allClass(ui, 'bx-front').length, 1, '过 90 度中点才有正面')
  assert.equal(allClass(ui, 'bx-back').length, 0)
  assert.ok(frontNames(ui).includes(labels[0]))
  assert.equal(ui.text().includes(labels[1]), false, '第 2 张还没开始')
  assert.match(ui.text(), /1 \/ 10/)

  // 正面从 0.83s 停到 1.76s（≥0.7s），期间还是第 1 张，不能提前换卡。
  ui.clock.t = 1700
  ui.rerender()
  assert.match(ui.text(), /1 \/ 10/)
  assert.ok(frontNames(ui).includes(labels[0]))
  assert.equal(allClass(ui, 'bx-front').length, 1)

  // 1.76s 换第 2 张：回到卡背，第 1 张的名字从 DOM 消失。
  ui.clock.t = 1760
  ui.rerender()
  assert.match(ui.text(), /2 \/ 10/)
  assert.equal(allClass(ui, 'bx-front').length, 0)
  assert.equal(allClass(ui, 'bx-back').length, 1)
  assert.equal(ui.text().includes(labels[0]), false, '上一张已撤下')
  assert.equal(ui.text().includes(labels[1]), false, '第 2 张还在卡背')
  assert.equal(allClass(ui, 'bx-tcard').length, 0)

  ui.clock.t = 2590
  ui.rerender()
  assert.match(ui.text(), /2 \/ 10/)
  assert.ok(frontNames(ui).includes(labels[1]))
  assert.equal(ui.text().includes(labels[2]), false, '第 3 张不提前出现')

  // 3~10 张也逐张上台：任何时刻只有当前这一张正面，前后张都不在 DOM。
  for (let i = 2; i < 10; i += 1) {
    ui.clock.t = Math.round((i * 1.76 + 0.9) * 1000)
    ui.rerender()
    assert.match(ui.text(), new RegExp((i + 1) + ' / 10'))
    assert.deepEqual(frontNames(ui), [labels[i]])
    assert.equal(allClass(ui, 'bx-tcard').length, 0)
  }

  // 第 10 张：本地时间仍从 0 算，后段的负延迟不会被夹到 -9s。
  ui.clock.t = 16840
  ui.rerender()
  assert.match(ui.text(), /10 \/ 10/)
  assert.ok(frontNames(ui).includes(labels[9]))
  assert.equal(layer().shake.style.getPropertyValue('--ts'), '-1.00s')
  assert.equal(layer().flip.style.getPropertyValue('--tf'), '-0.40s')
  assert.notEqual(layer().shake.style.getPropertyValue('--ts'), '-9.00s')

  ui.clock.t = 17_600
  ui.rerender()
  assert.equal(ui.settled(), 'true')
  assert.equal(allClass(ui, 'bx-tcard').length, 10, '全部播完才进总览')
  assert.equal(allClass(ui, 'bx-main').length, 0)
  assert.deepEqual(frontNames(ui), labels)
  assert.match(ui.text(), /十连寻访 · 10 个摆件/)
  assert.match(ui.text(), new RegExp('新的 ' + data.last.items.filter(got => got.isNew).length + ' 个'))
  assert.equal(ui.pending.size, 0)
  ui.click('data-bx-done', '1')
  assert.equal(ui.all('data-bx-banner').length, 2)
  assert.equal(ui.sent.length, 0)
  assert.equal(data.pulls, 10)
})

test('快进：十连播到一半点快进，立刻是完整总览，计时器清干净，不再发 open', () => {
  const data = blindbox.init()
  const { api } = fakeApi({ coins: 1_000_000 })
  const pool = blindbox.view(data, api)
  const view = drawView(data, api, { banner: 'standard', count: 10 }, lcg(11))
  const labels = data.last.items.map(got => labelOf(got.key))
  const ui = harness(pool)
  ui.show(view)
  ui.clock.t = 3000
  ui.rerender()
  assert.match(ui.text(), /2 \/ 10/)
  assert.equal(ui.find('data-bx-skip', '1').textContent, '快进 ›')
  ui.click('data-bx-skip', '1')
  assert.equal(ui.settled(), 'true')
  assert.equal(ui.pending.size, 0, '快进后不留计时器')
  assert.equal(allClass(ui, 'bx-tcard').length, 10)
  assert.deepEqual(frontNames(ui), labels)
  assert.equal(ui.all('data-bx-skip').length, 0)
  assert.ok(ui.find('data-bx-done', '1'))
  assert.equal(ui.sent.length, 0)
  assert.equal(data.pulls, 10)
})

test('重播十连：从第 1 张重新播，不新请求、不扣币，播完还是同一笔结果', () => {
  const data = blindbox.init()
  const { api } = fakeApi({ coins: 1_000_000 })
  const pool = blindbox.view(data, api)
  const view = drawView(data, api, { banner: 'standard', count: 10 }, lcg(13))
  const labels = data.last.items.map(got => labelOf(got.key))
  const ui = harness(pool)
  ui.show(view)
  ui.click('data-bx-skip', '1')
  const pulls = data.pulls
  ui.click('data-bx-replay', '1')
  assert.equal(ui.settled(), 'false')
  assert.match(ui.text(), /1 \/ 10/)
  assert.equal(allClass(ui, 'bx-tcard').length, 0)
  assert.equal(allClass(ui, 'bx-back').length, 1)
  assert.equal(allClass(ui, 'bx-front').length, 0)
  assert.equal(ui.text().includes(labels[0]), false, '重播从卡背开始')
  ui.clock.t += 900
  ui.rerender()
  assert.match(ui.text(), /1 \/ 10/)
  assert.ok(frontNames(ui).includes(labels[0]))
  assert.equal(ui.sent.length, 0)
  assert.equal(data.pulls, pulls)
  assert.equal(data.last.items.length, 10)
  ui.clock.t += 20_000
  ui.rerender()
  assert.equal(ui.settled(), 'true')
  assert.deepEqual(frontNames(ui), labels)
  assert.equal(ui.sent.length, 0)
})

test('十连播放中隐藏真暂停时钟：隐藏 20 秒仍停第 1 张同相位，恢复后接着播；卸载摘监听清计时器', () => {
  const data = blindbox.init()
  const { api } = fakeApi({ coins: 1_000_000 })
  const pool = blindbox.view(data, api)
  const view = drawView(data, api, { banner: 'standard', count: 10 }, lcg(17))
  const labels = data.last.items.map(got => labelOf(got.key))
  const pulls = data.pulls
  const ui = harness(pool, { observe: true })
  ui.show(view)
  flushZero(ui)
  ui.clock.t = 1000
  ui.rerender()
  assert.ok(frontNames(ui).includes(labels[0]))
  const tfBefore = mainLayers(ui).flip.style.getPropertyValue('--tf')
  assert.equal(ui.pending.size, 1, '播放中挂着相位计时器')
  ui.dom.document.hidden = true
  for (const fn of ui.dom.documentListeners.visibilitychange) fn({})
  assert.equal(ui.dom.body.children[0].getAttribute('data-asleep'), 'true')
  assert.equal(ui.pending.size, 0, '隐藏时取消相位计时器')
  ui.clock.t = 21000
  ui.rerender()
  assert.match(ui.text(), /1 \/ 10/, '隐藏 20 秒也不跳过当前卡')
  assert.equal(ui.settled(), 'false', '隐藏期间不直接结算')
  assert.equal(mainLayers(ui).flip.style.getPropertyValue('--tf'), tfBefore, '隐藏期间相位冻结')
  assert.equal(ui.pending.size, 0, '宿主轮询重绘不能偷跑进度或重挂计时器')
  ui.dom.document.hidden = false
  for (const fn of ui.dom.documentListeners.visibilitychange) fn({})
  assert.equal(ui.dom.body.children[0].getAttribute('data-asleep'), 'false')
  assert.equal(ui.pending.size, 1, '恢复后重新挂上相位计时器')
  assert.match(ui.text(), /1 \/ 10/, '恢复后接着第 1 张，不重头')
  assert.equal(mainLayers(ui).flip.style.getPropertyValue('--tf'), tfBefore, '恢复仍是同一相位')
  assert.ok(frontNames(ui).includes(labels[0]))
  ui.clock.t = 21800
  ui.rerender()
  assert.match(ui.text(), /2 \/ 10/, '恢复后时钟继续走，到点才换下一张')
  assert.equal(ui.sent.length, 0, '暂停/恢复不发 open')
  assert.equal(data.pulls, pulls, 'open 次数不变')
  ui.dom.body.children[0].remove()
  ui.observers[0].ping()
  assert.equal((ui.dom.documentListeners.visibilitychange ?? []).length, 0)
  assert.equal(ui.pending.size, 0)
  assert.equal(ui.observers[0].disconnected, true)
})


test('结束清晰：推进时钟跑完相位计时器，直接落到终态、有收下、没有残留遮罩', () => {
  const data = blindbox.init()
  const { api } = fakeApi({ coins: 1_000_000 })
  const pool = blindbox.view(data, api)
  const view = drawView(data, api, { banner: 'standard', count: 10 }, lcg(11))
  const ui = harness(pool)
  ui.show(view)
  assert.ok(ui.pending.size > 0)
  ui.clock.t += 20_000
  runTimers(ui)
  assert.equal(ui.settled(), 'true')
  assert.equal(ui.pending.size, 0)
  assert.equal(allClass(ui, 'bx-front').length, 10)
  assert.equal(allClass(ui, 'bx-hint').length, 0)
  assert.ok(ui.find('data-bx-done', '1'))
  assert.equal(ui.all('data-bx-skip').length, 0)
  // 再让宿主轮询重画几次，终态不变、不重播。
  for (let i = 0; i < 3; i += 1) { ui.clock.t += 5000; ui.rerender() }
  assert.equal(ui.settled(), 'true')
  assert.equal(ui.sent.length, 0)
  assert.equal(data.pulls, 10)
})

test('轮询重画：同一个事务接着播（负延迟继续走），播完是静态终态，不会重放/重消费', () => {
  const data = blindbox.init()
  const { api } = fakeApi()
  const pool = blindbox.view(data, api)
  const view = drawView(data, api, { banner: 'standard', count: 1 }, seq(0.05, 0.2, 0.1))
  const ui = harness(pool)
  ui.show(view)
  const flipDelay = () => Number.parseFloat(mainLayers(ui).flip.style.getPropertyValue('--tf'))
  const shakeDelay = () => Number.parseFloat(mainLayers(ui).shake.style.getPropertyValue('--ts'))
  assert.equal(flipDelay(), 0.6, '刚抽到：先抖 0.6s 再翻')
  assert.equal(shakeDelay(), 0)
  ui.clock.t += 500
  ui.rerender()
  assert.ok(Math.abs(flipDelay() - 0.1) < 0.001, '重画后翻面从当前进度接着等：' + flipDelay())
  assert.ok(Math.abs(shakeDelay() + 0.5) < 0.001, '重画后抖动从当前进度接着播：' + shakeDelay())
  assert.equal(ui.sent.length, 0)
  assert.equal(ui.all('data-bx-skip').length, 1)
  assert.equal(ui.text().includes(labelOf(data.last.items[0].key)), false, '抖动阶段重画也不会闪出卡面')
  ui.clock.t += 700
  ui.rerender()
  assert.equal(ui.settled(), 'true')
  assert.equal(ui.all('data-bx-skip').length, 0)
  ui.clock.t += 10_000
  ui.rerender()
  assert.equal(ui.settled(), 'true')
  assert.equal(ui.all('data-bx-done').length, 1)
  assert.equal(data.pulls, 1)
})

test('重复点击：动作回来之前再点也只发一次 open（单抽和十连都一样）', () => {
  const data = blindbox.init()
  const { api } = fakeApi()
  const ui = harness(blindbox.view(data, api))
  ui.click('data-bx-draw', '1')
  ui.find('data-bx-draw', '1').fire('click')
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent)), [{ op: 'open', payload: { banner: 'standard', count: 1 } }])
  assert.equal(ui.find('data-bx-draw', '1').disabled, true)
  assert.equal(ui.find('data-bx-draw', '10').disabled, true)
  assert.match(ui.text(), /寻访中…/)

  const data2 = blindbox.init()
  const { api: api2 } = fakeApi({ tickets: 1 })
  const ui2 = harness(blindbox.view(data2, api2))
  ui2.click('data-bx-draw', '10')
  ui2.click('data-bx-draw', '10')
  ui2.click('data-bx-ticket', '1')
  assert.equal(ui2.find('data-bx-ticket', '1').disabled, true)
  assert.deepEqual(JSON.parse(JSON.stringify(ui2.sent)), [{ op: 'open', payload: { banner: 'standard', count: 10 } }])
})

test('a slow draw stays disabled past five seconds; a definitive rejection releases its buttons', async () => {
  const { api } = fakeApi()
  let complete
  const response = new Promise(resolve => { complete = resolve })
  const ui = harness(blindbox.view(blindbox.init(), api), { sendResult: () => response })
  ui.click('data-bx-draw', '1')
  for (const { fn, ms } of [...ui.pending.values()]) if (ms === 5000) fn()
  ui.clock.t += 20_000
  ui.rerender()
  ui.click('data-bx-draw', '1')
  assert.equal(ui.sent.length, 1)
  assert.equal(ui.find('data-bx-draw', '1').disabled, true)
  complete({ ok: false, reason: 'poor' })
  await response
  await Promise.resolve()
  assert.equal(ui.find('data-bx-draw', '1').disabled, false)
})

test('减少动态：关动效但十连仍按顺序停留，不自动跳到总览', () => {
  const data = blindbox.init()
  const { api } = fakeApi({ coins: 1_000_000 })
  const pool = blindbox.view(data, api)
  const view = drawView(data, api, { banner: 'standard', count: 10 }, lcg(19))
  const labels = data.last.items.map(got => labelOf(got.key))
  const ui = harness(pool, { reducedMotion: true })
  ui.show(view)
  assert.equal(ui.settled(), 'false', '减少动态不能自动全览')
  assert.equal(allClass(ui, 'bx-tcard').length, 0)
  assert.equal(allClass(ui, 'bx-back').length, 1)
  assert.equal(allClass(ui, 'bx-front').length, 0)
  assert.match(ui.text(), /1 \/ 10/)
  const still = mainLayers(ui)
  assert.equal(still.shake.getAttribute('data-still'), 'true')
  assert.equal(still.flip.getAttribute('data-still'), 'true')
  assert.equal(still.flip.style.getPropertyValue('--tf'), '', '不挂动画延迟')
  assert.equal(still.flip.style.transform, 'rotateY(0deg)')

  ui.clock.t = 900
  ui.rerender()
  assert.equal(allClass(ui, 'bx-front').length, 1)
  assert.ok(frontNames(ui).includes(labels[0]))
  assert.equal(mainLayers(ui).flip.style.transform, 'rotateY(180deg)')
  assert.equal(ui.text().includes(labels[1]), false)

  ui.clock.t = 1760
  ui.rerender()
  assert.match(ui.text(), /2 \/ 10/, '仍按顺序换下一张')
  assert.equal(allClass(ui, 'bx-back').length, 1)
  assert.equal(ui.text().includes(labels[0]), false)
  assert.equal(ui.text().includes(labels[1]), false)

  ui.clock.t = 17_600
  ui.rerender()
  assert.equal(ui.settled(), 'true')
  assert.equal(allClass(ui, 'bx-tcard').length, 10)
  assert.deepEqual(frontNames(ui), labels)
  assert.equal(ui.pending.size, 0)
})

test('减少动态单抽：没有逐张流程，直接给正面终态、不挂计时器', () => {
  const data = blindbox.init()
  const { api } = fakeApi()
  const pool = blindbox.view(data, api)
  const view = drawView(data, api, { banner: 'standard', count: 1 }, seq(0.05, 0.2, 0.1))
  const ui = harness(pool, { reducedMotion: true })
  ui.show(view)
  flushZero(ui)
  assert.equal(ui.settled(), 'true')
  assert.equal(ui.all('data-bx-skip').length, 0)
  assert.equal(allClass(ui, 'bx-front').length, 1)
  assert.ok(ui.find('data-bx-done', '1'))
  assert.match(ui.text(), /首次获得/)
  assert.equal(ui.pending.size, 0, '减少动态不需要任何相位计时器')
  ui.click('data-bx-done', '1')
  assert.equal(ui.sent.length, 0)
})

test('老存档的凭证：打开盲盒时搬进钱包只发一次 sync（面板重画不重复搬）', () => {
  const data = blindbox.init()
  data.certs = 30
  const { api } = fakeApi()
  const view = blindbox.view(data, api)
  assert.equal(view.pendingCerts, 30)
  const ui = harness(view)
  ui.rerender()
  ui.rerender()
  assert.equal(ui.sent.length, 1)
  assert.equal(ui.sent[0].op, 'sync')
})

test('旧存档/未知结果：没有 catalog 条目也能画出来，shop 结果同样能收下', () => {
  const data = blindbox.init()
  const { api } = fakeApi()
  const view = blindbox.view(data, api)
  view.last = { id: 99, banner: 'shop', items: [{ key: 'gone-figure', stars: 4, isNew: false }] }
  const ui = harness(blindbox.view(data, api), { reducedMotion: true })
  ui.show(view)
  assert.match(ui.text(), /未知摆件/)
  assert.match(ui.text(), /潜能 1/)
  assert.match(ui.text(), /★★★★/)
  ui.click('data-bx-done', '1')
  assert.equal(ui.all('data-bx-banner').length, 2)
  assert.equal(ui.sent.length, 0)
})

test('大鲸鱼：server 抽到的六星鲸鱼按真实结果显示卡面、首次获得和六星提示', () => {
  const data = blindbox.init()
  const { api } = fakeApi({ coins: 1e9 })
  const pool = blindbox.view(data, api)
  const random = lcg(20261022)
  for (let i = 0; i < 400 && data.last?.items?.[0]?.key !== 'whale'; i += 1) {
    blindbox.actions.open(data, { banner: 'standard', count: 1 }, api, random)
  }
  assert.equal(data.last.items[0].key, 'whale', '没抽到鲸鱼，测试的随机序列需要检查')
  const got = data.last.items[0]
  const ui = harness(pool, { reducedMotion: true })
  ui.show(blindbox.view(data, api))
  assert.equal(got.stars, 6)
  assert.equal(got.isNew, true)
  assert.equal(ui.settled(), 'true')
  assert.match(ui.text(), /大鲸鱼/)
  assert.match(ui.text(), /🐳/)
  assert.match(ui.text(), /首次获得/)
  assert.match(ui.text(), /六星/)
  assert.equal(ui.all('data-bx-skip').length, 0)
})

test('大窗：宽屏排版走 bx-big，有关闭入口，十连仍是 10 张薄卡', () => {
  const data = blindbox.init()
  const { api } = fakeApi({ coins: 100_000 })
  const pool = blindbox.view(data, api)
  let closed = 0
  const ui = harness(pool, { mode: 'big', onClose() { closed += 1 } })
  assert.match(ui.dom.body.children[0].className, /\bbx-big\b/)
  assert.equal(ui.all('data-bx-big').length, 0, '大窗里不再有「大窗」入口')
  ui.click('data-bx-close', '1')
  assert.equal(closed, 1)
  const view = drawView(data, api, { banner: 'standard', count: 10 }, lcg(11))
  ui.show(view)
  assert.match(ui.dom.body.children[0].className, /\bbx-big\b/)
  assert.equal(allClass(ui, 'bx-tcard').length, 0, '播放中只展示当前一张')
  assert.equal(allClass(ui, 'bx-main').length, 1)
  ui.clock.t += 20_000
  ui.rerender()
  assert.equal(allClass(ui, 'bx-tcard').length, 10, '播完大窗仍是 5 列总览')
  assert.equal(ui.find('data-bx-close', '1'), undefined, '揭晓里由返回键回卡池')
  ui.click('data-bx-done', '1')
  assert.equal(ui.find('data-bx-close', '1') !== undefined, true)
  assert.equal(ui.sent.length, 0)
})

test('面板隐藏只暂停 CSS 动画（卡池没有播放时钟），关掉扩展/换页时摘掉监听、清掉计时器', () => {
  const data = blindbox.init()
  const { api } = fakeApi()
  const view = blindbox.view(data, api)
  const ui = harness(view, { observe: true })
  assert.equal((ui.dom.documentListeners.visibilitychange ?? []).length, 1)
  assert.ok(ui.pending.size >= 1, '卡池自动轮换确实挂了计时器')

  ui.dom.document.hidden = true
  for (const fn of ui.dom.documentListeners.visibilitychange) fn({})
  assert.equal(ui.dom.body.children[0].getAttribute('data-asleep'), 'true')
  ui.dom.document.hidden = false
  for (const fn of ui.dom.documentListeners.visibilitychange) fn({})
  assert.equal(ui.dom.body.children[0].getAttribute('data-asleep'), 'false')

  const root = ui.dom.body.children[0]
  root.remove()
  ui.observers[0].ping()
  assert.equal((ui.dom.documentListeners.visibilitychange ?? []).length, 0)
  assert.equal(ui.pending.size, 0)
  assert.equal(ui.observers[0].disconnected, true)

  // 换页后下一次 render 会重新绑定，而且只绑一次（不会越挂越多）。
  ui.rerender()
  assert.equal((ui.dom.documentListeners.visibilitychange ?? []).length, 1)
})

test('292px 与样式隔离：没有固定宽/固定定位、没有 RAF、所有规则都在 .bx 下、减少动态有兜底', () => {
  const rules = [...SOURCE.matchAll(/'((?:\.|@)[^']*)'/g)].map(match => match[1]).filter(rule => rule.includes('{'))
  assert.ok(rules.length > 30, 'CSS 规则应该被这条守卫扫到')
  for (const rule of rules) {
    if (rule.startsWith('@keyframes')) continue
    if (rule.startsWith('@media')) {
      const inside = rule.slice(rule.indexOf('{') + 1)
      for (const selector of inside.split('}')[0].split(',')) {
        assert.match(selector.trim(), /^\.bx/, '媒体查询里的选择器也要在 .bx 下：' + selector)
      }
      continue
    }
    for (const selector of rule.slice(0, rule.indexOf('{')).split(',')) {
      assert.match(selector.trim(), /^\.bx/, '选择器没有 .bx 作用域：' + selector)
    }
  }
  assert.equal(/requestAnimationFrame/.test(SOURCE), false, '不留常驻/临时 RAF 循环')
  assert.equal(/getContext|createElement\('canvas'\)|new WebGL/.test(SOURCE), false, '不用 Canvas / WebGL')
  assert.equal(/position:\s*fixed/.test(SOURCE), false)
  for (const match of SOURCE.matchAll(/(?:^|[;{])(?:min-)?width:\s*(\d+)px/g)) {
    assert.ok(Number(match[1]) <= 280, '固定宽度超过 292px 小窗：' + match[0])
  }
  assert.match(SOURCE, /prefers-reduced-motion/)
  assert.match(SOURCE, /data-asleep/)
})

test('小面板十连 2 列、卡高按内容保底；大窗仍 5 列，名字换行、6 星不裁', () => {
  const rules = []
  for (const match of SOURCE.matchAll(/'([^']*)'/g)) if (match[1].includes('{')) rules.push(match[1])
  const ruleOf = selector => {
    const found = rules.find(rule => rule.split('{')[0].split(',').map(part => part.trim()).includes(selector) || rule.includes(selector + '{'))
    assert.ok(found, '找不到样式规则 ' + selector)
    return found
  }
  assert.match(ruleOf('.bx-ten'), /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(ruleOf('.bx-big .bx-ten'), /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/)
  const card = ruleOf('.bx-tcard')
  assert.match(card, /min-height:112px/, '小面板卡片至少 112px 高')
  assert.equal(/background:|border:|box-shadow:/.test(card), false, '结果卡外壳不再画静止白底/边框/阴影')
  assert.match(ruleOf('.bx-card.bx-live'), /background:none/)
  assert.match(ruleOf('.bx-card.bx-live'), /border:0/)
  assert.match(ruleOf('.bx-card.bx-live'), /box-shadow:none/)
  assert.match(ruleOf('.bx-side'), /border:1px solid/, '纸张边框由真正翻动的两面承担')
  assert.match(ruleOf('.bx-side'), /box-shadow:/)
  const name = ruleOf('.bx-tcard b')
  assert.match(name, /white-space:normal/, '名字可以换行，不截断')
  assert.match(name, /overflow-wrap:anywhere/)
  assert.equal(/text-overflow:ellipsis/.test(name), false, '名字不能用省略号裁掉')
  assert.match(ruleOf('.bx-tcard .bx-stars'), /white-space:nowrap/, '6 星保持一行，不裁星')
  assert.match(ruleOf('.bx-tcard .bx-em'), /font-size:28px/, '图标不缩字号')
  // 真实十连仍走 2 列小卡；所有卡都有保底高度。
  const data = blindbox.init()
  const { api } = fakeApi({ coins: 1_000_000 })
  const ui = harness(blindbox.view(data, api))
  ui.show(drawView(data, api, { banner: 'standard', count: 10 }, lcg(21)))
  assert.equal(allClass(ui, 'bx-tcard').length, 0)
  ui.clock.t += 20_000
  ui.rerender()
  assert.equal(allClass(ui, 'bx-tcard').length, 10)
})

test('高度预算：用宿主内容高度减掉实际钱包占位，结果页固定总高、只在舞台内滚', () => {
  const data = blindbox.init()
  const { api } = fakeApi()
  const pool = blindbox.view(data, api)
  const ui = harness(pool, { panelHeight: 560, walletHeight: 74, walletMargin: 10 })
  let root = ui.dom.body.children.find(node => classesOf(node).includes('bx'))
  assert.equal(root.style.getPropertyValue('--bx-avail'), '476px', '560 - (74 + 10) 才是真实可用高度')
  assert.equal(classesOf(root).includes('bx-reveal'), false)

  ui.show(drawView(data, api, { banner: 'standard', count: 10 }, lcg(31)))
  root = ui.dom.body.children.find(node => classesOf(node).includes('bx'))
  assert.equal(classesOf(root).includes('bx-reveal'), true)
  assert.equal(root.style.getPropertyValue('--bx-avail'), '476px', '揭晓重画也要重新量钱包')

  const rules = []
  for (const match of SOURCE.matchAll(/'([^']*)'/g)) if (match[1].includes('{')) rules.push(match[1])
  const ruleOf = selector => {
    const found = rules.find(rule => rule.split('{')[0].split(',').map(part => part.trim()).includes(selector) || rule.includes(selector + '{'))
    assert.ok(found, '找不到样式规则 ' + selector)
    return found
  }
  assert.match(ruleOf('.bx-reveal:not(.bx-big)'), /height:var\(--bx-avail,auto\)/)
  assert.match(ruleOf('.bx-reveal:not(.bx-big)'), /min-height:0/)
  assert.match(ruleOf('.bx-reveal:not(.bx-big)>.bx-draw'), /grid-template-rows:auto minmax\(0,1fr\) auto/)
  assert.match(ruleOf('.bx-reveal:not(.bx-big)>.bx-draw>.bx-stage'), /overflow-y:auto/)
  assert.match(ruleOf('.bx-reveal:not(.bx-big)>.bx-draw>.bx-stage'), /min-height:0/)

  // 小高度约 280px 时仍是「标题 / 可滚舞台 / 结果与按钮」三行，按钮不会被十连行数挤出去。
  const small = harness(pool, { panelHeight: 360, walletHeight: 70, walletMargin: 10 })
  const smallRoot = small.dom.body.children.find(node => classesOf(node).includes('bx'))
  assert.equal(smallRoot.style.getPropertyValue('--bx-avail'), '280px')
})

test('翻面结构：双面卡背/正面、backface 隐藏、3D、抖动与翻面分两层不互相覆盖', () => {
  assert.match(SOURCE, /\.bx-side\{[^}]*backface-visibility:hidden/)
  assert.match(SOURCE, /\.bx-side\{[^}]*(-webkit-)?backface-visibility:hidden/)
  assert.match(SOURCE, /\.bx-flip\{[^}]*transform-style:preserve-3d/)
  assert.match(SOURCE, /\.bx-front\{transform:rotateY\(180deg\)/)
  assert.match(SOURCE, /data-settled="true"\] \.bx-flip\{transform:rotateY\(180deg\)/)
  // 抖动和翻面分属 .bx-shake / .bx-flip 两层：同一个元素只挂一段 transform 动画。
  assert.match(SOURCE, /@keyframes bx-shake\{[^}]*translateX/)
  assert.match(SOURCE, /@keyframes bx-flip\{from\{transform:rotateY\(0deg\)\}to\{transform:rotateY\(180deg\)\}\}/)
  for (const rule of SOURCE.matchAll(/'([^']*:[^']*)'/g)) {
    const text = rule[1]
    if (!text.includes('animation:bx-shake') && !text.includes('animation:bx-flip')) continue
    assert.ok(text.startsWith('.bx-shake{') || text.startsWith('.bx-flip{') || text.includes(' .bx-shake{') || text.includes(' .bx-flip{'),
      'transform 动画只挂在抖动层或翻面层：' + text.slice(0, 60))
  }
  assert.equal(/\.bx-card\{[^}]*animation:/.test(SOURCE), false, '定位层的 transform 不能被动画覆盖')
})

test('卡池两翼还是磨砂卡背，抽卡结果卡不再用磨砂盖答案', () => {
  const data = blindbox.init()
  const { api } = fakeApi()
  const ui = harness(blindbox.view(data, api))
  assert.equal(allClass(ui, 'bx-frost').length >= 4, true, '卡池两翼用磨砂薄卡')
  const view = drawView(data, api, { banner: 'standard', count: 10 }, lcg(83))
  ui.show(view)
  assert.equal(allClass(ui, 'bx-frost').length, 0, '揭晓卡用卡背/正面，不靠磨砂遮罩')
  ui.clock.t += 5000
  ui.rerender()
  assert.equal(allClass(ui, 'bx-frost').length, 0)
  assert.ok(frontNames(ui).every(name => name.length > 0))
})
