// @ts-check
/**
 * 钓鱼 App：选鱼饵 → 抛竿 → 等咬钩 → 搏斗（三种玩法随机一种，见 fishing-fight.js）→ 结果。
 * U24-7 按用户确认的概念稿整理排版：钓点风景、鱼饵、主按钮，再把换钓点 / 鱼竿 / 自动钓鱼收成折叠项。
 * 玩法、数值和动作都还在宿主：这里只决定怎么画。
 */
import { fishingArtUrl } from '../fishing-art.js'
import { button, el } from '../dom.js'
import { fightActive, renderFight, resetFightResolve, stopFight } from './fishing-fight.js'
import { canStart, renderSwitchAsk, startOrSwitch } from '../switch-activity.js'

let selectedBait = null
/** 三个折叠项各自开着没有；面板每几秒重画一次，不记住就会自己缩回去。 */
const openSections = { spot: false, rod: false, auto: false }
let waitFrame = 0
let waitUi = null
const raf = fn => typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : 0
const caf = id => { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id) }

/** 概念稿里的水域名和游戏钓点对得上：湖用 pond，海边用 reef。 */
const SCENE_FILE = { river: 'scene-river.png', lake: 'scene-pond.png', sea: 'scene-reef.png', night: 'scene-night.png' }
const CRUCIAN_ART = 'crucian-result.png'
/** 稀有度 → 星星（沿用现有四格，不加「满星」之类的说法）。 */
const STARS = { common: 1, uncommon: 2, rare: 3, legend: 4 }

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

/** 图片没到位也不留一个破图：底下的 emoji 兜底一直画着，加载成功才盖上去。 */
function fishImage(name, className) {
  const img = /** @type {HTMLImageElement} */ (el('img', className))
  img.src = fishingArtUrl(name)
  img.alt = ''
  img.setAttribute('aria-hidden', 'true')
  img.addEventListener('load', function () { img.parentElement?.setAttribute('data-art-loaded', 'true') })
  img.addEventListener('error', function () { img.hidden = true })
  return img
}

function currentSpot(ui) {
  const fishing = ui.view.fishing
  return fishing.spots?.find(spot => spot.key === fishing.spot) ?? { key: fishing.spot, label: fishing.spot, emoji: '🏞', open: true }
}

function sceneArt(spot, className) {
  const art = el('div', 'dp-fish-art ' + className)
  art.setAttribute('data-fish-scene', spot.key)
  art.appendChild(el('span', 'dp-fish-art-fallback', spot.emoji))
  art.appendChild(fishImage(SCENE_FILE[spot.key] ?? SCENE_FILE.river, 'dp-fish-art-img'))
  return art
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

/** 原生 details，展开状态记在模块里，轮询重画不会把它关掉。 */
function accordion(key, className, emoji, label, value) {
  const box = el('details', 'dp-fish-sec ' + className)
  box.setAttribute('data-fish-section', key)
  if (openSections[key]) { box.open = true; box.setAttribute('open', '') }
  const summary = el('summary', 'dp-fish-summary')
  summary.appendChild(el('span', 'dp-fish-summary-main', emoji + ' ' + label))
  if (value) summary.appendChild(el('span', 'dp-fish-summary-value', value))
  summary.appendChild(el('span', 'dp-fish-chev', '⌄'))
  box.appendChild(summary)
  box.addEventListener('toggle', function () { openSections[key] = box.open === true })
  return box
}

/**
 * 钓点和鱼竿（钓鱼 2.0）：点开折叠项才看到下一把竿和各个钓点的开启价。
 * 增量游戏的成长线没有变：好竿咬钩快、搏斗顺手、稀有鱼多；新钓点有新鱼。
 */
function renderSpotSection(ui) {
  const fishing = ui.view.fishing
  const spot = currentSpot(ui)
  const box = accordion('spot', 'dp-fish-spot-sec', '📍', '换钓点', spot.label)
  const spots = el('div', 'dp-fish-spots')
  const coins = ui.view.pig?.coins ?? 0
  for (const entry of fishing.spots ?? []) {
    const here = entry.key === fishing.spot
    const pick = button('dp-fish-spot', { 'data-fish-spot': entry.key, 'aria-pressed': String(here) }, function () {
      if (!here) ui.send('fishSpot', { spot: entry.key })
    })
    pick.appendChild(el('em', null, entry.emoji))
    pick.appendChild(el('b', null, entry.label))
    pick.appendChild(el('small', null, !entry.unlocked ? '🪙 ' + entry.price + ' 开' : !entry.open ? '晚上才开' : entry.kinds + ' 种鱼'))
    pick.disabled = !entry.unlocked && coins < entry.price
    spots.appendChild(pick)
  }
  box.appendChild(spots)
  return box
}

function renderRodSection(ui) {
  const fishing = ui.view.fishing
  const box = accordion('rod', 'dp-fish-rod-sec', '🎣', '鱼竿', fishing.rod.label)
  const body = el('div', 'dp-fish-sec-body')
  const now = el('div', 'dp-fish-rodnow')
  now.appendChild(el('span', null, fishing.rod.emoji + ' ' + fishing.rod.label))
  now.appendChild(el('small', null, '现在用的'))
  body.appendChild(now)
  if (fishing.nextRod) {
    const coins = ui.view.pig?.coins ?? 0
    const up = button('dp-mini', { 'data-fish-rod': fishing.nextRod.key || String(fishing.nextRod.level) }, function () { ui.send('fishRod') })
    up.textContent = '换' + fishing.nextRod.label + ' · 🪙 ' + fishing.nextRod.price
    up.disabled = coins < fishing.nextRod.price
    body.appendChild(up)
    body.appendChild(el('p', 'dp-fish-note', '好竿咬钩更快、绿区更宽、更耐拉，稀有鱼更多'))
  } else body.appendChild(el('p', 'dp-fish-note', '已经是最好的鱼竿'))
  box.appendChild(body)
  return box
}

/** 自动仓与背包分开，行程中也能收；旧背包不受仓容量限制。 */
function renderAutoStock(ui, parent) {
  const automation = ui.view.fishing.automation
  if (!automation || (!automation.unlocked && automation.stored === 0 && automation.usedHours === 0)) return false
  const row = el('div', 'dp-fish-stock')
  const capacity = automation.capacityHours ?? 6
  row.appendChild(el('span', null, '🧺 ' + (automation.full ? automation.stored > 0 ? '鱼篓满了' : '钓鱼歇了' : '鱼篓') + ' ' + automation.usedHours.toFixed(1) + ' / ' + capacity + ' 小时'))
  const collect = button('dp-mini', { 'data-fish-collect': 'true' }, () => ui.send('fishCollect'))
  collect.textContent = automation.stored > 0 ? '收一下' : automation.full ? '接着干' : '暂无收成'
  collect.disabled = automation.stored === 0 && !automation.full
  row.appendChild(collect)
  parent.appendChild(row)
  return true
}

/** 自动钓鱼收在第三个折叠项里：点不了的时候写清楚是哪一条数据不够。 */
function renderAutoSection(ui, baitState) {
  const automation = ui.view.fishing.automation
  const box = accordion('auto', 'dp-fish-auto', '🐷', '自动钓鱼', automation?.unlocked ? '已开' : '')
  const body = el('div', 'dp-fish-sec-body')
  const chosen = baitState.baits.find(item => item.key === baitState.selected)
  const baitRow = el('div', 'dp-fish-auto-bait')
  baitRow.appendChild(el('span', null, '当前鱼饵'))
  baitRow.appendChild(el('b', null, chosen ? chosen.emoji + ' ' + baitLabel(chosen) + ' ×' + baitState.owned(chosen.key) : '没有鱼饵'))
  body.appendChild(baitRow)
  renderAutoStock(ui, body)

  const choices = automation?.choices ?? [30, 60].map(minutes => ({ minutes, attempts: minutes / 3 }))
  const closed = currentSpot(ui).open === false
  const row = el('div', 'dp-fish-auto-row')
  const reasons = []
  for (const { minutes, attempts, legacy = minutes <= 60 } of choices) {
    const boxed = !legacy && automation?.baitLimit > 0
    const need = boxed ? 1 : attempts
    const have = ui.view.inventory[baitState.selected] ?? 0
    const go = button('dp-mini dp-fish-auto-go', { 'data-fish-auto': String(minutes) }, function () {
      startOrSwitch(ui, '自动钓鱼 ' + minutes + ' 分钟', 'fishAuto', { minutes, bait: baitState.selected })
    })
    go.textContent = `${minutes} 分钟` + (boxed ? '（自动补饵）' : `（鱼饵 ${need} 个）`)
    go.disabled = !canStart(ui) || have < need || (!legacy && automation?.full === true) || closed
    if (go.disabled && reasons.length === 0) {
      if (!canStart(ui)) reasons.push('猪现在不能出门')
      else if (!legacy && automation?.full) reasons.push(automation.stored > 0 ? '鱼篓满了，先收一下' : '钓鱼歇了，先接着干')
      else if (closed) reasons.push('这个钓点现在没有开')
      else reasons.push('鱼饵只剩 ' + have + ' 个，不够 ' + need + ' 个')
    }
    row.appendChild(go)
  }
  body.appendChild(row)
  const blockedUpgrades = []
  for (const upgrade of automation?.upgrades ?? []) {
    const buy = button('dp-mini', { 'data-fish-upgrade': upgrade.kind }, () => ui.send('fishAutomation', { kind: upgrade.kind }))
    buy.textContent = upgrade.label + ' 🪙 ' + upgrade.price
    buy.disabled = (ui.view.pig?.coins ?? 0) < upgrade.price
    if (buy.disabled) blockedUpgrades.push(upgrade.label + '要 ' + upgrade.price + ' 金币')
    body.appendChild(buy)
  }
  if (reasons.length > 0) body.appendChild(el('span', 'dp-fish-why', '点不了：' + reasons[0] + '。'))
  else if (blockedUpgrades.length > 0) body.appendChild(el('span', 'dp-fish-why', '金币不够：' + blockedUpgrades[0] + '。'))
  box.appendChild(body)
  return box
}

function baitLabel(bait) {
  return bait.label.replace(/鱼饵$/, '')
}

function currentBaitState(ui) {
  const baits = ui.view.shop.filter(item => item.kind === 'bait')
  const owned = key => ui.view.inventory[key] ?? 0
  if (!baits.some(item => item.key === selectedBait && owned(item.key) > 0)) selectedBait = baits.find(item => owned(item.key) > 0)?.key ?? null
  return { baits, owned, selected: selectedBait }
}

function renderHero(ui) {
  const spot = currentSpot(ui)
  const hero = el('section', 'dp-fish-hero')
  const cap = el('div', 'dp-fish-hero-cap')
  cap.appendChild(el('span', 'dp-fish-kicker', '当前钓点'))
  cap.appendChild(el('b', 'dp-fish-spot-name', spot.label))
  if (spot.open === false) cap.appendChild(el('span', 'dp-fish-tag', '晚上才开'))
  hero.appendChild(cap)
  hero.appendChild(sceneArt(spot, 'dp-fish-hero-art'))
  ui.content.appendChild(hero)
  return spot
}

function renderBaits(ui, baitState) {
  const section = el('section', 'dp-fish-panel')
  const head = el('div', 'dp-fish-head')
  head.appendChild(el('b', null, '选鱼饵'))
  const chosen = baitState.baits.find(item => item.key === baitState.selected)
  head.appendChild(el('span', 'dp-fish-head-note', chosen ? '已选 ' + baitLabel(chosen) + ' ×' + baitState.owned(chosen.key) : '没有可选鱼饵'))
  section.appendChild(head)
  const choices = el('div', 'dp-fish-baits')
  for (const bait of baitState.baits) {
    const choice = button('dp-fish-bait', { 'data-fish-bait': bait.key }, function () { selectedBait = bait.key; ui.renderContent() })
    choice.appendChild(el('em', null, bait.emoji))
    const text = el('span', 'dp-fish-bait-text')
    text.appendChild(el('b', null, baitLabel(bait)))
    text.appendChild(el('small', null, '×' + baitState.owned(bait.key)))
    choice.appendChild(text)
    choice.setAttribute('aria-pressed', String(baitState.selected === bait.key))
    choice.disabled = baitState.owned(bait.key) === 0
    choices.appendChild(choice)
  }
  section.appendChild(choices)
  ui.content.appendChild(section)
}

function renderReady(ui) {
  // 准备页也使用同一个容器，保持卡片间距并让窄屏容器查询生效。
  ui = { ...ui, content: fishShell(ui) }
  const spot = renderHero(ui)
  const baitState = currentBaitState(ui)
  renderBaits(ui, baitState)
  const hungry = (ui.view.pig?.satiety ?? 0) < 1
  const closed = spot.open === false
  if (hungry) {
    ui.content.appendChild(el('div', 'dp-fish-blocked', '饱食为 0，先喂食才能抛竿。'))
    const care = button('dp-mini dp-fish-care', { 'data-fish-care': 'feed' }, function () { ui.select('status') })
    care.textContent = '去状态页喂食 →'
    ui.content.appendChild(care)
  } else if (baitState.selected === null) ui.content.appendChild(el('div', 'dp-fish-blocked', '没有鱼饵了，先去商店的鱼饵货架买。'))
  else if (closed) ui.content.appendChild(el('div', 'dp-fish-blocked', '这个钓点现在没有开，换个钓点或等晚上。'))
  const cast = button('dp-btn dp-btn-wide dp-fish-cast', { 'data-fish': 'cast' }, function () { ui.send('fishCast', { power: .5, bait: selectedBait }) })
  cast.textContent = hungry ? '🍚 喂食后才能抛竿' : '🎣 抛竿'
  cast.disabled = baitState.selected === null || hungry || closed
  ui.content.appendChild(cast)
  ui.content.appendChild(renderSpotSection(ui))
  ui.content.appendChild(renderRodSection(ui))
  ui.content.appendChild(renderAutoSection(ui, baitState))
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
  card.setAttribute('data-fish-result-art', fish.key === 'fish_crucian' ? 'crucian' : 'emoji')
  const art = el('div', 'dp-fish-result-art')
  art.appendChild(el('span', 'dp-fish-result-emoji', fish.emoji))
  if (fish.key === 'fish_crucian') art.appendChild(fishImage(CRUCIAN_ART, 'dp-fish-result-img'))
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
  renderReady(ui)
}
