// @ts-check
/**
 * 钓鱼 App：选鱼饵 → 抛竿 → 等咬钩 → 搏斗（三种玩法随机一种，见 fishing-fight.js）→ 结果。
 * 准备页在 fishing-ready.js：钓点场景 → 独立鱼饵卡 → 一排钓点/鱼竿/自动入口。
 * 玩法、数值和动作都还在宿主：这里只决定怎么画。
 */
import { fishByKey } from '../../../packages/pet-core/src/data/fish.js'
import { button, el } from '../dom.js'
import { fightActive, renderFight, resetFightResolve, stopFight } from './fishing-fight.js'
import { renderFishingReady, renderAutoStock, resetFishingGear } from './fishing-ready.js'
import { currentSpot, fishImage, sceneArt } from './fishing-scene.js'
import { renderSwitchAsk } from '../switch-activity.js'

let lastUi = null
let waitFrame = 0
let waitUi = null
const raf = fn => typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : 0
const caf = id => { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id) }
/** 稀有度 → 星星（沿用现有四格，不加「满星」之类的说法）。 */
const STARS = { common: 1, uncommon: 2, rare: 3, legend: 4 }

function stopWait() {
  if (waitFrame) caf(waitFrame)
  waitFrame = 0
  waitUi = null
}

/** 搏斗中关掉面板算输，并停掉动画。 */
export function closeFishing(ui) {
  resetFishingGear()
  const playing = fightActive(ui) && ui.view.fishing.pending?.phase === 'hooked'
  stopFight(true)
  stopWait()
  if (playing) ui.send('fishResolve', { success: false })
}

function fishShell(ui) {
  const root = el('div', 'dp-fish')
  ui.content.appendChild(root)
  return root
}

/** 等待 / 搏斗 / 结果共用的一行：当前钓点和鱼竿。 */
function contextLine(ui, root) {
  const row = el('div', 'dp-fish-context')
  row.setAttribute('data-fish-context', 'true')
  const spot = currentSpot(ui)
  row.textContent = '当前：' + spot.label + ' · ' + ui.view.fishing.rod.label
  root.appendChild(row)
}

function renderWaiting(ui, pending) {
  const root = fishShell(ui)
  contextLine(ui, root)
  const spot = currentSpot(ui)
  const water = button('dp-fish-water dp-fish-waiting', { 'data-fish': 'hook' }, function () {
    if (Date.now() < pending.bitesAt) { line.textContent = nibbleUntil > Date.now() ? '只是试探，还没咬实…' : '还没上钩，继续等…'; return }
    ui.send('fishHook')
  })
  water.appendChild(sceneArt(spot, 'dp-fish-water-art'))
  const mark = el('span', 'dp-fish-bobber')
  mark.appendChild(fishImage('bobber.png', 'dp-fish-bobber-img'))
  water.appendChild(mark)
  root.appendChild(water)
  const state = el('div', 'dp-fish-wait-state')
  const line = el('b', null, '安静等鱼咬钩…')
  state.appendChild(line)
  state.appendChild(el('small', null, '盯住浮漂，咬钩时点击'))
  root.appendChild(state)
  // 等咬钩时浮漂会被「试探」几下（动森的钓鱼手感）：盯着看才有意思，提前点也不罚。
  let nextNibble = Date.now() + 1500 + Math.random() * 2500
  let nibbleUntil = 0
  waitUi = ui
  function tick() {
    if (waitUi !== ui) return
    const now = Date.now()
    if (now < pending.bitesAt - 900 && now >= nextNibble) {
      nibbleUntil = now + 420
      nextNibble = now + 1800 + Math.random() * 3200
      water.setAttribute('data-nibble', 'true')
      line.textContent = Math.random() < 0.5 ? '浮漂动了一下…' : '咕嘟，冒了个泡…'
    } else if (nibbleUntil > 0 && now > nibbleUntil + 900) { nibbleUntil = 0; water.setAttribute('data-nibble', 'false'); line.textContent = '安静等鱼咬钩…' }
    if (now >= pending.bitesAt && now <= pending.hookUntil) { mark.textContent = '❗'; line.textContent = '上钩了！快点！'; water.setAttribute('data-bite', 'true') }
    else if (now > pending.hookUntil) { stopWait(); ui.send('fishHook'); return }
    waitFrame = raf(tick)
  }
  waitFrame = raf(tick)
}

function renderResult(ui, fish) {
  const root = fishShell(ui)
  contextLine(ui, root)
  const card = el('div', 'dp-fish-result')
  card.setAttribute('data-fish-result', fish.key)
  const artName = fish.art || fishByKey(fish.key)?.art || ''
  card.setAttribute('data-fish-result-art', artName ? 'art' : 'emoji')
  const art = el('div', 'dp-fish-result-art')
  art.appendChild(el('span', 'dp-fish-result-emoji', fish.emoji))
  if (artName) art.appendChild(fishImage(artName, 'dp-fish-result-img'))
  card.appendChild(art)
  card.appendChild(el('b', 'dp-fish-result-title', '钓到了 ' + fish.label + '！'))
  const stars = STARS[fish.rarity] ?? 1
  card.appendChild(el('span', 'dp-fish-stars', '★'.repeat(stars) + '☆'.repeat(4 - stars)))
  const record = fish.maxCm > 0 && fish.sizeCm >= fish.maxCm * .85 ? ' · 大个的！' : ''
  card.appendChild(el('span', 'dp-fish-facts', fish.sizeCm.toFixed(1) + ' cm · 🪙 ' + fish.price + record))
  const keep = button('dp-btn dp-btn-wide dp-fish-keep', { 'data-fish': 'keep' }, function () { ui.send('fishKeep') })
  keep.textContent = '🎒 放进鱼篓'
  card.appendChild(keep)
  root.appendChild(card)
}

function renderAway(ui) {
  const root = fishShell(ui)
  contextLine(ui, root)
  root.appendChild(el('div', 'dp-fish-away', '🎣'))
  root.appendChild(el('div', 'dp-empty', ui.view.activity.label + ' · 钓到的鱼会放进鱼篓'))
  // 人在外面也能收自动仓（旧界面就在这一层收）；只收仓，不放自动出发/升级。
  const panel = el('section', 'dp-fish-panel')
  const head = el('div', 'dp-fish-head')
  head.appendChild(el('b', null, '自动鱼篓'))
  panel.appendChild(head)
  if (renderAutoStock(ui, panel)) root.appendChild(panel)
}

export function renderFishingTab(ui) {
  if (ui !== lastUi) { lastUi = ui; resetFishingGear() }
  stopFight()
  stopWait()
  const pending = ui.view.fishing.pending
  if (pending?.phase !== 'hooked') resetFightResolve()
  if (ui.view.activity?.kind === 'fishing') { stopFight(true); return renderAway(ui) }
  renderSwitchAsk(ui)
  if (pending?.phase === 'waiting') { stopFight(true); return renderWaiting(ui, pending) }
  if (pending?.phase === 'hooked') {
    const root = fishShell(ui)
    contextLine(ui, root)
    return renderFight(ui, pending, root)
  }
  stopFight(true)
  if (pending?.phase === 'caught') return renderResult(ui, pending)
  renderFishingReady(ui)
}
