// @ts-check
/**
 * 背包 / 商店物品格的悬停卡。
 *
 * 只负责画：数据来自当前快照里的物品格 + 静态商店效果表。
 * 卡片按场景分：商店看价格/能否买/买后去哪；背包看持有数/用掉几个/剩几个。
 * 效果只写物品自身的加/减值，到上限就地标注；说明只补充效果区没有的信息。
 * @module dsh-piggy/client/item-hover
 */
import { DRESS_SLOTS, KIND_LABEL, SHOP } from '../../packages/pet-core/src/data/shop.js'
import { ILLNESS_CHAINS } from '../../packages/pet-core/src/data/illness.js'
import { el } from './dom.js'
import { num } from './values.js'

var SHOP_BY_KEY = new Map(SHOP.map(item => [item.key, item]))
var SLOT_LABEL = new Map(DRESS_SLOTS.map(slot => [slot.key, slot.label]))
var CURE_LABEL = new Map()
ILLNESS_CHAINS.forEach(function (chain) {
  chain.stages.forEach(function (stage) { CURE_LABEL.set(stage.cure.key, stage.name) })
})

function isConsumable(kind) {
  return kind === 'food' || kind === 'bath' || kind === 'toy' || kind === 'bait' ||
    kind === 'medicine' || kind === 'body' || kind === 'promotion' || kind === 'revive'
}

function kindText(item) {
  var base = KIND_LABEL[item.kind] || item.kind || ''
  if (item.default === true) return base + ' · 默认'
  if (item.kind === 'dress') return base + ' · 永久'
  return isConsumable(item.kind) ? base + ' · 消耗品' : base
}

/** 收起当前卡，取消等待中的 1.2s 定时器。 */
export function isHoverCardActive(ui) {
  var hover = ui && ui.itemHover
  return !!hover && (hover.__pending === true || hover.__shown === true)
}

export function hideItemHover(ui) {
  var hover = ui && ui.itemHover
  if (!hover) return
  if (hover.__timer) {
    clearTimeout(hover.__timer)
    hover.__timer = null
  }
  hover.hidden = true
  if (hover.classList && typeof hover.classList.remove === 'function') hover.classList.remove('show')
  else hover.className = String(hover.className || '').replace(/\bshow\b/g, '').trim()
  hover.__node = null
  hover.__hoverId = null
  hover.__render = null
  hover.__pending = false
  hover.__shown = false
}

function positionItemHover(ui, node) {
  var hover = ui && ui.itemHover
  if (!hover || !node) return
  var cardRect = ui.card.getBoundingClientRect()
  var rect = node.getBoundingClientRect()
  var w = hover.offsetWidth || 258
  var h = hover.offsetHeight || 210
  var left = rect.left - cardRect.left + rect.width / 2 - w / 2
  var top = rect.top - cardRect.top - h - 6
  left = Math.max(6, Math.min(cardRect.width - w - 6, left))
  if (top < 6) top = rect.bottom - cardRect.top + 6
  top = Math.max(6, Math.min(cardRect.height - h - 6, top))
  hover.style.left = left + 'px'
  hover.style.top = top + 'px'
}

function addItemEffect(box, ui, label, key, delta) {
  var change = Number(delta)
  if (!Number.isFinite(change) || change === 0) return
  var row = el('div', 'dp-ih-line')
  row.appendChild(el('b', null, label))
  var mark = el('span', change > 0 ? 'up' : 'down')
  mark.textContent = (change > 0 ? '+' : '') + change
  var pig = ui.view.pig
  if (pig !== null && pig !== undefined) {
    var current = Number(pig[key])
    var max = key === 'health' ? (Number(ui.view.maxHealth) || 5) : 100
    if (Number.isFinite(current)) {
      if (current + change > max) mark.appendChild(el('i', 'dp-ih-cap', '到上限'))
      else if (current + change < 0) mark.appendChild(el('i', 'dp-ih-cap', '到下限'))
    }
  }
  row.appendChild(mark)
  box.appendChild(row)
}

function addInfoRow(box, label, value, tone) {
  if (value === '') return
  var row = el('div', 'dp-ih-line')
  row.appendChild(el('b', null, label))
  row.appendChild(el('span', tone || null, value))
  box.appendChild(row)
}

function descriptionFor(item, full) {
  if (item.kind === 'bait') {
    return Number(full.rarityBoost) > 0 ? '钓鱼时自动消耗，更容易钓到稀有鱼' : '钓鱼时自动消耗'
  }
  if (item.kind === 'dress' || item.kind === 'body' || item.kind === 'promotion') {
    if (typeof full.blurb === 'string' && full.blurb !== '') return full.blurb
    if (typeof item.blurb === 'string' && item.blurb !== '') return item.blurb
  }
  if (item.kind === 'revive') return '只在死亡时可用，治好所有疾病。'
  return ''
}

/**
 * 底部只留一条“接下来会怎样”：商店说买后去哪、余额够不够；
 * 背包说用掉几个、剩几个；装扮说穿在哪、会不会替换。
 */
function actionFor(ui, item, full, context, count) {
  var price = Number(item.price !== undefined && item.price !== null ? item.price : full.price)
  var coins = ui.view.pig ? Number(ui.view.pig.coins) : NaN
  if (context === 'shop') {
    var tail = ''
    if (Number.isFinite(price) && price > 0 && Number.isFinite(coins)) {
      tail = coins >= price ? ' · 买后剩 ' + (coins - price) : ' · 还差 ' + (price - coins)
    } else if (item.affordable === false) {
      tail = ' · 金币不足'
    }
    if (item.kind === 'dress') {
      if (item.owned) return item.worn ? '已拥有 · 正在穿戴' : '已拥有 · 可穿戴'
      if (item.unlocked === false) return 'Lv.' + item.level + ' 解锁后才能买'
      return '购买后永久拥有' + tail
    }
    if (item.owned) return '已拥有 · 无需再买'
    return '购买后放入背包' + tail
  }
  if (item.default === true) return '默认物品 · 不消耗'
  if (item.kind === 'dress') {
    if (item.worn) return '正在穿戴 · 不消耗'
    var slot = SLOT_LABEL.get(full.slot) || full.slot || ''
    return slot === '' ? '穿戴后替换当前装扮' : '穿戴后替换当前' + slot + '装扮'
  }
  if (item.kind === 'bait') return count > 0 ? '钓鱼时消耗 · 剩 ' + count : '未持有'
  if (!isConsumable(item.kind)) return ''
  if (count <= 0) return '未持有'
  return '使用 1 个 · 剩余 ' + (count - 1)
}

function renderItemHover(ui, item, context) {
  var hover = ui && ui.itemHover
  if (!hover) return
  var full = SHOP_BY_KEY.get(item.key) || item
  var pig = ui.view.pig
  var count = num(ui.view.inventory[item.key], 0)
  var price = item.price !== undefined && item.price !== null ? item.price : full.price
  context = context === 'shop' ? 'shop' : 'bag'
  hover.textContent = ''

  var head = el('div', 'dp-ih-head')
  head.appendChild(el('span', 'dp-ih-emoji', item.emoji || full.emoji || '📦'))
  var title = el('div', 'dp-ih-title')
  title.appendChild(el('b', null, item.label || full.label || item.key))
  title.appendChild(el('span', null, kindText(item)))
  head.appendChild(title)
  var right = ''
  if (context === 'shop') {
    if (item.owned) right = '已拥有'
    else if (Number(price) > 0) right = price + ' 🪙'
  } else if (item.kind === 'dress' && item.owned) {
    right = '已拥有'
  } else if (item.default === true) {
    right = '默认'
  } else {
    right = count > 0 ? '持有 ×' + count : '未持有'
  }
  if (right !== '') head.appendChild(el('span', 'dp-ih-price', right))
  hover.appendChild(head)

  var stats = el('div', 'dp-ih-stats')
  if (pig !== null && pig !== undefined) {
    if (item.kind === 'food') {
      addItemEffect(stats, ui, '饱食', 'satiety', full.satiety)
      addItemEffect(stats, ui, '心情', 'happiness', full.happiness)
    } else if (item.kind === 'bath') {
      addItemEffect(stats, ui, '清洁', 'cleanliness', full.cleanliness)
      addItemEffect(stats, ui, '心情', 'happiness', full.happiness)
      addItemEffect(stats, ui, '饱食', 'satiety', full.satiety)
    } else if (item.kind === 'toy') {
      addItemEffect(stats, ui, '心情', 'happiness', full.happiness)
      addItemEffect(stats, ui, '饱食', 'satiety', full.satiety)
      addItemEffect(stats, ui, '清洁', 'cleanliness', full.cleanliness)
    }
  }
  if (item.kind === 'bait') {
    addInfoRow(stats, '稀有度', Number(full.rarityBoost) > 0 ? '+' + full.rarityBoost : '不提升', Number(full.rarityBoost) > 0 ? 'up' : '')
  } else if (item.kind === 'medicine') {
    addInfoRow(stats, '治疗', (full.cureAll || item.cureAll) ? '所有疾病' : (CURE_LABEL.get(item.key) || '对应疾病'))
  } else if (item.kind === 'revive') {
    addInfoRow(stats, '效果', '复活')
  } else if (item.kind === 'body' || item.kind === 'promotion') {
    addInfoRow(stats, '用途', full.useLabel || item.useLabel || '使用')
  } else if (item.kind === 'dress') {
    var level = item.level !== null && item.level !== undefined ? item.level : full.level
    addInfoRow(stats, '部位', SLOT_LABEL.get(full.slot || item.slot) || '装扮')
    if (level !== null && level !== undefined) {
      addInfoRow(stats, '等级', 'Lv.' + level + (item.unlocked === false ? ' 解锁' : ' 可穿'))
    }
  }
  if (stats.childNodes.length > 0) hover.appendChild(stats)

  var desc = descriptionFor(item, full)
  var chips = el('div', 'dp-ih-chips')
  if (item.needed) chips.appendChild(el('span', 'dp-ih-chip warm', '当前需要'))
  var foot = el('div', 'dp-ih-foot')
  if (desc !== '') foot.appendChild(el('div', 'dp-ih-desc-plain', desc))
  if (chips.childNodes.length > 0) foot.appendChild(chips)
  var action = actionFor(ui, item, full, context, count)
  if (action !== '') foot.appendChild(el('div', 'dp-ih-action', action))
  if (foot.childNodes.length > 0) hover.appendChild(foot)
}

/**
 * 通用活动卡：工作 / 旅行 / 兴趣课共用同一张悬停面板。
 * `rows` 是「字段：值」，`chips` 是底部状态小胶囊。
 */
export function renderActivityHover(ui, config) {
  var hover = ui && ui.itemHover
  if (!hover) return
  hover.textContent = ''
  var head = el('div', 'dp-ih-head')
  head.appendChild(el('span', 'dp-ih-emoji', config.emoji || '📋'))
  var title = el('div', 'dp-ih-title')
  title.appendChild(el('b', null, config.label || ''))
  title.appendChild(el('span', null, config.kind || ''))
  head.appendChild(title)
  if (config.price) head.appendChild(el('span', 'dp-ih-price', config.price))
  hover.appendChild(head)

  var rows = el('div', 'dp-ih-stats')
  for (var i = 0; i < (config.rows || []).length; i += 1) {
    var row = el('div', 'dp-ih-line')
    row.appendChild(el('b', null, config.rows[i].label))
    row.appendChild(el('span', null, config.rows[i].value))
    rows.appendChild(row)
  }
  if (rows.childNodes.length > 0) hover.appendChild(rows)
  if (config.desc) hover.appendChild(el('div', 'dp-ih-desc', config.desc))
  var chips = el('div', 'dp-ih-chips')
  for (var c = 0; c < (config.chips || []).length; c += 1) {
    var chip = config.chips[c]
    chips.appendChild(el('span', 'dp-ih-chip' + (chip.tone ? ' ' + chip.tone : ''), chip.text))
  }
  if (chips.childNodes.length > 0) hover.appendChild(chips)
}

function showHoverCard(ui, node, render) {
  var hover = ui && ui.itemHover
  if (!hover || !node || node.isConnected === false) return
  hover.hidden = false
  hover.__pending = false
  hover.__shown = true
  hover.__node = node
  render()
  positionItemHover(ui, node)
  requestAnimationFrame(function () {
    if (hover.__node !== node) return
    if (hover.classList && typeof hover.classList.add === 'function') hover.classList.add('show')
    else if (!String(hover.className || '').includes('show')) hover.className = String(hover.className || '') + ' show'
  })
}

function resumePolling(ui) {
  if (!ui || typeof ui.refresh !== 'function') return
  if (ui.__hoverResumeTimer) clearTimeout(ui.__hoverResumeTimer)
  ui.__hoverResumeTimer = setTimeout(function () {
    ui.__hoverResumeTimer = null
    ui.refresh()
  }, 300)
}

function bindHoverNode(ui, node, hoverId, render) {
  if (!node || node.__hoverBound === true) return
  node.__hoverBound = true
  node.setAttribute('data-hover-id', hoverId)
  node.addEventListener('pointerenter', function () {
    var hover = ui.itemHover
    hideItemHover(ui)
    hover.__hoverId = hoverId
    hover.__render = render
    hover.__node = node
    hover.__pending = true
    hover.__timer = setTimeout(function () {
      hover.__timer = null
      if (hover.__pending && hover.__node && hover.__node.isConnected !== false) {
        showHoverCard(ui, hover.__node, hover.__render)
      }
    }, 1200)
  })
  node.addEventListener('pointerleave', function () {
    var hover = ui.itemHover
    // 轮询重绘时旧节点会被移走；旧节点的 leave 不能收掉新节点上的卡。
    if (hover && hover.__node === node) {
      hideItemHover(ui)
      resumePolling(ui)
    }
  })
  node.addEventListener('pointerdown', function () { hideItemHover(ui) })
}

/** Rebind/restore the hover card after a 4s poll rebuilds the content DOM. */
export function restoreItemHover(ui) {
  var hover = ui && ui.itemHover
  if (!hover || !hover.__hoverId || (!hover.__pending && !hover.__shown)) return
  var node = null
  try { node = ui.content.querySelector('[data-hover-id=' + JSON.stringify(hover.__hoverId) + ']') } catch { node = null }
  if (!node) { hideItemHover(ui); return }
  bindHoverNode(ui, node, hover.__hoverId, hover.__render)
  hover.__node = node
  if (hover.__shown) {
    hover.hidden = false
    hover.__render()
    positionItemHover(ui, node)
    if (hover.classList && typeof hover.classList.add === 'function') hover.classList.add('show')
    else if (!String(hover.className || '').includes('show')) hover.className = String(hover.className || '') + ' show'
  }
}

/** Attach the 1.2s hover behavior to any tile; `render` fills the shared card. */
export function attachHoverCard(ui, node, render, hoverId) {
  if (!ui || !ui.itemHover || !node) return
  bindHoverNode(ui, node, hoverId || ('tile:' + String(Math.random())), render)
}

/** Attach the item hover card (shop/bag). */
export function attachItemHover(ui, node, item, context) {
  attachHoverCard(ui, node, function () { renderItemHover(ui, item, context) }, 'item:' + item.key)
}

/** Attach a work / travel / interest / school activity card. */
export function attachActivityHover(ui, node, config, hoverId) {
  attachHoverCard(ui, node, function () { renderActivityHover(ui, config) }, hoverId || ('activity:' + (config.label || '')))
}
