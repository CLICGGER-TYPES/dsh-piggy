// @ts-check
/**
 * 钓鱼 App：选鱼饵 → 抛竿 → 等咬钩 → 搏斗（三种玩法随机一种，见 fishing-fight.js）→ 结果。
 * G 批次按原型 docs/prototypes/fishing-fight.html 重做了界面。
 */
import { button, el } from '../dom.js'
import { fightActive, renderFight, resetFightResolve, stopFight } from './fishing-fight.js'
import { canStart, renderSwitchAsk, startOrSwitch } from '../switch-activity.js'

let selectedBait = null
/** 自动钓鱼那一栏展开着没有。 */
let autoOpen = false
let waitFrame = 0
let waitUi = null
const raf = fn => typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : 0
const caf = id => { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id) }

function stopWait() {
  if (waitFrame) caf(waitFrame)
  waitFrame = 0
  waitUi = null
}

/** 搏斗中关掉面板算输，并停掉动画。 */
export function closeFishing(ui) {
  const playing = fightActive(ui) && ui.view.fishing.pending?.phase === 'hooked'
  stopFight(true)
  stopWait()
  if (playing) ui.send('fishResolve', { success: false })
}

export function renderFishingTab(ui) {
  stopFight()
  stopWait()
  const pending = ui.view.fishing.pending
  if (pending?.phase !== 'hooked') resetFightResolve()
  if (ui.view.activity?.kind === 'fishing') { stopFight(true); return renderAway(ui) }
  renderSwitchAsk(ui)
  if (pending?.phase === 'waiting') { stopFight(true); return renderWaiting(ui, pending) }
  if (pending?.phase === 'hooked') return renderFight(ui, pending)
  stopFight(true)
  if (pending?.phase === 'caught') return renderResult(ui, pending)
  renderReady(ui)
}

/** 鱼饵说明：越贵的饵，稀有鱼越多。 */
var BAIT_NOTE = { bait_worm: '普通鱼', bait_shrimp: '少见的多一点', bait_glow: '稀有的多很多' }

/**
 * 钓点和鱼竿（钓鱼 2.0）：钓点一排小卡片，没开的写开启价、点了就开；鱼竿写现在用的和下一把多少钱。
 * 增量游戏的成长线：好竿咬钩快、搏斗顺手、稀有鱼多；新钓点有新鱼。
 */
function renderGear(ui) {
  const fishing = ui.view.fishing
  if (!Array.isArray(fishing.spots) || fishing.spots.length === 0) return
  const coins = ui.view.pig?.coins ?? 0
  const spots = el('div', 'dp-fish-spots')
  for (const spot of fishing.spots) {
    const here = spot.key === fishing.spot
    const pick = button('dp-fish-spot', { 'data-fish-spot': spot.key, 'aria-pressed': String(here) }, function () { if (!here) ui.send('fishSpot', { spot: spot.key }) })
    pick.appendChild(el('em', null, spot.emoji))
    pick.appendChild(el('b', null, spot.label))
    pick.appendChild(el('small', null, !spot.unlocked ? '🪙 ' + spot.price + ' 开' : !spot.open ? '晚上才开' : spot.kinds + ' 种鱼'))
    pick.disabled = !spot.unlocked && coins < spot.price
    spots.appendChild(pick)
  }
  ui.content.appendChild(spots)
  const rod = el('div', 'dp-fish-rodrow')
  rod.appendChild(el('span', null, fishing.rod.emoji + ' ' + fishing.rod.label))
  if (fishing.nextRod) {
    const up = button('dp-mini', { 'data-fish-rod': fishing.nextRod.key || String(fishing.nextRod.level) }, function () { ui.send('fishRod') })
    up.textContent = '换' + fishing.nextRod.label + ' 🪙 ' + fishing.nextRod.price
    up.disabled = coins < fishing.nextRod.price
    rod.appendChild(up)
    rod.appendChild(el('small', null, '好竿咬钩更快、绿区更宽、更耐拉，稀有鱼更多'))
  } else rod.appendChild(el('small', null, '已经是最好的鱼竿'))
  ui.content.appendChild(rod)
}

function renderReady(ui) {
  renderGear(ui)
  const baits = ui.view.shop.filter(item => item.kind === 'bait')
  const owned = key => ui.view.inventory[key] ?? 0
  if (!baits.some(item => item.key === selectedBait && owned(item.key) > 0)) selectedBait = baits.find(item => owned(item.key) > 0)?.key ?? null
  ui.content.appendChild(el('div', 'dp-fish-label', '选鱼饵'))
  const choices = el('div', 'dp-fish-baits')
  for (const bait of baits) {
    const choice = button('dp-fish-bait', { 'data-fish-bait': bait.key }, function () { selectedBait = bait.key; ui.renderContent() })
    choice.appendChild(el('em', null, bait.emoji))
    choice.appendChild(el('b', null, bait.label.replace(/鱼饵$/, '') + ' ×' + owned(bait.key)))
    choice.appendChild(el('small', null, BAIT_NOTE[bait.key] ?? ''))
    choice.setAttribute('aria-pressed', String(selectedBait === bait.key))
    choice.disabled = owned(bait.key) === 0
    choices.appendChild(choice)
  }
  ui.content.appendChild(choices)
  if (selectedBait === null) ui.content.appendChild(el('div', 'dp-fish-blocked', '没有鱼饵了，先去商店的鱼饵货架买。'))
  const hungry = (ui.view.pig?.satiety ?? 0) < 1
  if (hungry) {
    ui.content.appendChild(el('div', 'dp-fish-blocked', '饱食为 0，先喂食才能抛竿。'))
    const care = button('dp-mini dp-fish-care', { 'data-fish-care': 'feed' }, function () { ui.select('status') })
    care.textContent = '去状态页喂食 →'
    ui.content.appendChild(care)
  }
  const cast = button('dp-btn dp-btn-wide dp-fish-cast', { 'data-fish': 'cast' }, function () { ui.send('fishCast', { power: .5, bait: selectedBait }) })
  cast.textContent = hungry ? '🍚 喂食后才能抛竿' : '🎣 抛竿'
  cast.disabled = selectedBait === null || hungry
  ui.content.appendChild(cast)
  renderAuto(ui)
}

/** 自动钓鱼收在下面：点不了的时候写清楚为什么。 */
function renderAuto(ui) {
  const auto = el('details', 'dp-fish-auto')
  // 面板每几秒重画一次：记住展开过，不然一刷新就自己缩回去（rc.1 反馈）。
  if (autoOpen) auto.setAttribute('open', '')
  auto.addEventListener('toggle', function () { autoOpen = auto.open === true })
  auto.appendChild(el('summary', null, '🐷 让猪自己去钓'))
  auto.appendChild(el('span', null, '猪出门 30 / 60 分钟，每 3 分钟用 1 个选中的鱼饵，钓到的放进鱼篓。'))
  const row = el('div', 'dp-fish-auto-row')
  const reasons = []
  for (const minutes of [30, 60]) {
    const need = minutes / 3
    const have = ui.view.inventory[selectedBait] ?? 0
    const go = button('dp-mini', { 'data-fish-auto': String(minutes) }, function () { startOrSwitch(ui, '自动钓鱼 ' + minutes + ' 分钟', 'fishAuto', { minutes, bait: selectedBait }) })
    go.textContent = `${minutes} 分钟（鱼饵 ${need} 个）`
    go.disabled = !canStart(ui) || have < need
    if (go.disabled && minutes === 30) {
      if (!canStart(ui)) reasons.push('猪现在不能出门')
      else reasons.push('鱼饵只剩 ' + have + ' 个，不够 ' + need + ' 个')
    }
    row.appendChild(go)
  }
  auto.appendChild(row)
  if (reasons.length > 0) auto.appendChild(el('span', 'dp-fish-why', '点不了：' + reasons[0] + '。'))
  ui.content.appendChild(auto)
}

function renderWaiting(ui, pending) {
  const water = button('dp-fish-waiting', { 'data-fish': 'hook' }, function () {
    if (Date.now() < pending.bitesAt) { line.textContent = nibbleUntil > Date.now() ? '只是试探，还没咬实…' : '还没上钩，继续等…'; return }
    ui.send('fishHook')
  })
  // 等咬钩时浮漂会被「试探」几下（动森的钓鱼手感）：盯着看才有意思，提前点也不罚。
  let nextNibble = Date.now() + 1500 + Math.random() * 2500
  let nibbleUntil = 0
  const mark = el('span', 'dp-fish-bobber', '🎣')
  const line = el('b', null, '安静等鱼咬钩…')
  water.appendChild(mark)
  water.appendChild(line)
  ui.content.appendChild(water)
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

/** 稀有度 → 星星。 */
var STARS = { common: 1, uncommon: 2, rare: 3, legend: 4 }

function renderResult(ui, fish) {
  const card = el('div', 'dp-fish-result')
  card.appendChild(el('div', 'dp-fish-result-emoji', fish.emoji))
  card.appendChild(el('b', null, '钓到了 ' + fish.label + '！'))
  const stars = STARS[fish.rarity] ?? 1
  card.appendChild(el('span', 'dp-fish-stars', '★'.repeat(stars) + '☆'.repeat(4 - stars)))
  const record = fish.maxCm > 0 && fish.sizeCm >= fish.maxCm * .85 ? ' · 大个的！' : ''
  card.appendChild(el('span', null, fish.sizeCm.toFixed(1) + ' cm · 🪙 ' + fish.price + record))
  const keep = button('dp-btn dp-btn-wide', { 'data-fish': 'keep' }, function () { ui.send('fishKeep') })
  keep.textContent = '🎒 放进鱼篓'
  card.appendChild(keep)
  ui.content.appendChild(card)
}

function renderAway(ui) {
  ui.content.appendChild(el('div', 'dp-fish-away', '🎣'))
  ui.content.appendChild(el('div', 'dp-empty', ui.view.activity.label + ' · 钓到的鱼会放进鱼篓'))
}
