// @ts-check
/**
 * 钓鱼准备页：钓点场景 → 独立鱼饵卡 → 底部钓点/鱼竿/自动三个入口。
 * 入口共用一张设置卡，展开后自动滚到可见位置；收起回到原来的滚动位置。
 */
import { button, el } from '../dom.js'
import { canStart, startOrSwitch } from '../switch-activity.js'
import { currentSpot, sceneArt } from './fishing-scene.js'

let selectedBait = null
let openGear = null
let gearScrollBefore = 0

function baitLabel(bait) {
  return bait.label.replace(/鱼饵$/, '')
}

function currentBaitState(ui) {
  const baits = ui.view.shop.filter(item => item.kind === 'bait')
  const owned = key => ui.view.inventory[key] ?? 0
  if (!baits.some(item => item.key === selectedBait && owned(item.key) > 0)) selectedBait = baits.find(item => owned(item.key) > 0)?.key ?? null
  return { baits, owned, selected: selectedBait }
}

export function resetFishingGear() {
  openGear = null
  gearScrollBefore = 0
}

/** 钓点场景：地点和鱼种数直接浮在画上，不再压一层「当前钓点」大字。 */
function renderHero(ui) {
  const spot = currentSpot(ui)
  const hero = el('section', 'dp-fish-scene')
  const art = sceneArt(spot, 'dp-fish-hero-art dp-fish-scene-art')
  const top = el('div', 'dp-fish-scene-top')
  const loc = el('span', 'dp-fish-loc-pill')
  loc.appendChild(el('span', 'dp-fish-loc-icon', '📍'))
  loc.appendChild(el('b', null, spot.label))
  top.appendChild(loc)
  art.appendChild(top)
  const bottom = el('div', 'dp-fish-scene-bottom')
  if (spot.kinds) bottom.appendChild(el('span', 'dp-fish-scene-pill', spot.kinds + ' 种鱼'))
  const bag = Array.isArray(ui.view.fishing.bag) ? ui.view.fishing.bag.length : 0
  if (bag > 0) bottom.appendChild(el('span', 'dp-fish-scene-pill', '🧺 ' + bag + ' 条'))
  if (spot.open === false) bottom.appendChild(el('span', 'dp-fish-scene-pill dp-fish-scene-warn', '晚上才开'))
  if (bottom.children.length > 0) art.appendChild(bottom)
  hero.appendChild(art)
  ui.content.appendChild(hero)
}

/** 鱼饵卡：三颗圆形鱼饵，数量只出现一次；选中的有薄荷环和对勾。 */
function renderDock(ui, baitState) {
  const spot = currentSpot(ui)
  const hungry = (ui.view.pig?.satiety ?? 0) < 1
  const closed = spot.open === false
  const chosen = baitState.baits.find(item => item.key === baitState.selected)
  const dock = el('section', 'dp-fish-dock')
  if (hungry) {
    const warn = el('div', 'dp-fish-warn')
    warn.appendChild(el('span', null, '🍚 饱食为 0，先喂食才能抛竿'))
    const care = button('dp-mini dp-fish-care', { 'data-fish-care': 'feed' }, function () { ui.select('status') })
    care.textContent = '去喂食'
    warn.appendChild(care)
    dock.appendChild(warn)
  }
  const head = el('div', 'dp-fish-dock-head')
  head.appendChild(el('b', null, '鱼饵'))
  if (chosen) head.appendChild(el('span', 'dp-fish-dock-note', '已选 ' + baitLabel(chosen)))
  else {
    head.appendChild(el('span', 'dp-fish-dock-note', '没有鱼饵了'))
    const shop = button('dp-fish-dock-shop', { 'data-fish-shop': 'bait' }, function () { ui.select('shop') })
    shop.textContent = '去商店'
    head.appendChild(shop)
  }
  dock.appendChild(head)
  const choices = el('div', 'dp-fish-baits')
  for (const bait of baitState.baits) {
    const count = baitState.owned(bait.key)
    const choice = button('dp-fish-bait', {
      'data-fish-bait': bait.key,
      'aria-label': baitLabel(bait) + '，剩 ' + count + ' 个',
      'aria-pressed': String(baitState.selected === bait.key),
    }, function () { selectedBait = bait.key; ui.renderContent() })
    choice.appendChild(el('em', null, bait.emoji))
    choice.appendChild(el('span', 'dp-fish-bait-count', '×' + count))
    if (baitState.selected === bait.key) choice.appendChild(el('span', 'dp-fish-bait-check', '✓'))
    choice.disabled = count === 0
    choices.appendChild(choice)
  }
  dock.appendChild(choices)
  const cast = button('dp-btn dp-btn-wide dp-fish-cast', { 'data-fish': 'cast' }, function () {
    ui.send('fishCast', { power: .5, bait: selectedBait })
  })
  const castLabel = hungry ? '先喂食' : closed ? '晚上才开' : baitState.selected === null ? '没有鱼饵' : '抛竿'
  const castNote = hungry ? '饱食为 0' : closed ? '换个钓点或等晚上' : chosen ? baitLabel(chosen) + ' ×1' : '去商店买鱼饵'
  cast.appendChild(el('b', null, castLabel))
  cast.appendChild(el('small', null, castNote))
  cast.disabled = baitState.selected === null || hungry || closed
  dock.appendChild(cast)
  ui.content.appendChild(dock)
}

/** 钓点列表：两列，比原来四列挤在一行更好读。 */
function renderSpotPanel(ui) {
  const fishing = ui.view.fishing
  const spots = el('div', 'dp-fish-spots')
  const coins = ui.view.pig?.coins ?? 0
  for (const entry of fishing.spots ?? []) {
    const here = entry.key === fishing.spot
    const pick = button('dp-fish-spot', { 'data-fish-spot': entry.key, 'aria-pressed': String(here) }, function () {
      if (!here) ui.send('fishSpot', { spot: entry.key })
    })
    pick.appendChild(el('em', null, entry.emoji))
    const text = el('span', 'dp-fish-spot-text')
    text.appendChild(el('b', null, entry.label))
    text.appendChild(el('small', null, !entry.unlocked ? '🪙 ' + entry.price + ' 开' : !entry.open ? '晚上才开' : entry.kinds + ' 种鱼'))
    pick.appendChild(text)
    pick.disabled = !entry.unlocked && coins < entry.price
    spots.appendChild(pick)
  }
  return spots
}

/** 鱼竿：当前竿一行，下一把竿一个按钮。 */
function renderRodPanel(ui) {
  const fishing = ui.view.fishing
  const body = el('div', 'dp-fish-rod-panel')
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
  return body
}

/** 自动仓与背包分开，行程中也能收；旧背包不受仓容量限制。 */
export function renderAutoStock(ui, parent) {
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

/** 自动钓鱼：入口收起，点开才看到鱼饵、鱼篓、出发和升级。 */
function renderAutoPanel(ui, baitState) {
  const automation = ui.view.fishing.automation
  const body = el('div', 'dp-fish-auto')
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
    go.appendChild(el('b', null, minutes + ' 分钟'))
    go.appendChild(el('small', null, boxed ? '自动补饵' : '鱼饵 ' + need + ' 个'))
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
  const upgrades = automation?.upgrades ?? []
  if (upgrades.length > 0) body.appendChild(el('div', 'dp-fish-auto-head', '升级'))
  for (const upgrade of upgrades) {
    const buy = button('dp-fish-buy', { 'data-fish-upgrade': upgrade.kind }, () => ui.send('fishAutomation', { kind: upgrade.kind }))
    buy.appendChild(el('span', null, upgrade.label))
    buy.appendChild(el('b', null, '🪙 ' + upgrade.price))
    buy.disabled = (ui.view.pig?.coins ?? 0) < upgrade.price
    if (buy.disabled) blockedUpgrades.push(upgrade.label + '要 ' + upgrade.price + ' 金币')
    body.appendChild(buy)
  }
  if (reasons.length > 0) body.appendChild(el('span', 'dp-fish-why', '点不了：' + reasons[0] + '。'))
  else if (blockedUpgrades.length > 0) body.appendChild(el('span', 'dp-fish-why', '金币不够：' + blockedUpgrades[0] + '。'))
  return body
}

function gearButton(ui, key, emoji, label) {
  const active = openGear === key
  const btn = button('dp-fish-gear-btn', {
    'data-fish-gear': key,
    'aria-pressed': String(active),
    'aria-expanded': String(active),
    'aria-label': label,
  }, function () {
    const scroller = ui.scrollContent ?? ui.content
    const wasOpen = openGear !== null
    if (!wasOpen) gearScrollBefore = scroller.scrollTop
    openGear = active ? null : key
    ui.renderContent()
    if (active) scroller.scrollTop = gearScrollBefore
    else {
      const panel = scroller.querySelector('[data-fish-gear-panel]')
      if (panel && typeof panel.scrollIntoView === 'function') panel.scrollIntoView({ block: 'nearest' })
    }
  })
  btn.appendChild(el('span', 'dp-fish-gear-icon', emoji))
  btn.appendChild(el('span', 'dp-fish-gear-label', label))
  return btn
}

function gearPanel(ui, key, baitState) {
  const titles = { spot: '换钓点', rod: '鱼竿', auto: '自动钓鱼' }
  const panel = el('section', 'dp-fish-gear-panel')
  panel.id = 'dp-fish-gear-panel'
  panel.setAttribute('data-fish-gear-panel', key)
  const head = el('div', 'dp-fish-gear-head')
  head.appendChild(el('b', null, titles[key]))
  const close = button('dp-fish-gear-close', { 'data-fish-gear-close': 'true' }, function () {
    openGear = null
    ui.renderContent()
    const scroller = ui.scrollContent ?? ui.content
    scroller.scrollTop = gearScrollBefore
  })
  close.textContent = '收起'
  head.appendChild(close)
  panel.appendChild(head)
  if (key === 'spot') panel.appendChild(renderSpotPanel(ui))
  else if (key === 'rod') panel.appendChild(renderRodPanel(ui))
  else panel.appendChild(renderAutoPanel(ui, baitState))
  return panel
}

function renderGear(ui, baitState) {
  const row = el('div', 'dp-fish-gear')
  row.appendChild(gearButton(ui, 'spot', '📍', '钓点'))
  row.appendChild(gearButton(ui, 'rod', '🎣', '鱼竿'))
  row.appendChild(gearButton(ui, 'auto', '🐷', '自动'))
  ui.content.appendChild(row)
  if (openGear !== null) ui.content.appendChild(gearPanel(ui, openGear, baitState))
}

export function renderFishingReady(ui) {
  const scroller = ui.content
  const content = el('div', 'dp-fish')
  scroller.appendChild(content)
  const view = { ...ui, content, scrollContent: scroller }
  renderHero(view)
  const baitState = currentBaitState(view)
  renderDock(view, baitState)
  renderGear(view, baitState)
}
