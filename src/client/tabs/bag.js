// @ts-check
/**
 * 背包页签（B8：动森手机式方块，跟商店一个样子）。
 *
 * 第一层：消耗品 / 日记 / 纪念品 / 鱼篓，右上角写件数，空的变灰。
 * 第二层：道具点一下就用；日记和纪念品点一下，下面显示全文 / 故事。
 * @module dsh-piggy/client/tabs/bag
 */

import { KIND_ORDER, shelfOf } from '../constants.js'
import { button, el } from '../dom.js'
import { num } from '../values.js'
import { careEffectLine, drillHeader, drillTo, statStrip, tile, tileGrid } from '../widgets.js'
import { SHELF_COLOR, shelfParts } from './shop.js'
import { walletBar } from '../wallet.js'

/** The consumable shelves, in shop order. */
var CONSUMABLES = KIND_ORDER

/** 这三个货架的东西用了就是一次照料（喂食 / 洗澡 / 玩耍），和状态页原来的按钮一样。 */
var CARE_ACTION = { food: 'feed', bath: 'bathe', toy: 'play' }

/** 打开时顶上显示状态条的货架。 */
var STAT_SHELVES = ['food', 'bath', 'toy', 'medicine']

/** The non-shelf categories: what they are called and how they look. */
var EXTRA = {
  worn: { emoji: '👕', label: '已穿戴', color: 'pink' },
  diary: { emoji: '📔', label: '日记', color: 'brown' },
  souvenir: { emoji: '🎁', label: '纪念品', color: 'blue' },
  fish: { emoji: '🐟', label: '鱼篓', color: 'teal' },
  wallet: { emoji: '👛', label: '钱包', color: 'yellow' },
}

/** 「2026-10-01」 → 「10-01」: the tile only has room for the month and day. */
function shortDay(day) {
  return day.length >= 10 ? day.slice(5) : day
}

export function renderBagTab(ui) {
  var open = ui.drill.bag
  if (open === 'worn') renderWorn(ui)
  else if (open === 'diary') renderDiary(ui)
  else if (open === 'souvenir') renderSouvenirs(ui)
  else if (open === 'fish') renderFish(ui)
  else if (open === 'wallet') renderWallets(ui)
  else if (open !== null && CONSUMABLES.indexOf(open) >= 0) renderItems(ui, open)
  else renderCategories(ui)
}

/** What the pig owns of one shelf, with counts. 照料货架用宿主给的 care 列表（含免费的小皮球）。 */
function ownedOf(ui, kind) {
  var action = CARE_ACTION[kind]
  if (action !== undefined && Array.isArray(ui.view.care[action]) && ui.view.care[action].length > 0) return ui.view.care[action]
  return ui.view.shop.filter(function (item) {
    return shelfOf(item.kind) === kind && num(ui.view.inventory[item.key], 0) > 0
  })
}

function renderCategories(ui) {
  var grid = tileGrid()
  for (var k = 0; k < CONSUMABLES.length; k += 1) {
    (function (kind) {
      var items = ownedOf(ui, kind)
      var count = items.reduce(function (sum, item) { return sum + num(ui.view.inventory[item.key], 0) }, 0)
      var hasFree = items.some(function (item) { return item.default === true })
      var parts = shelfParts(kind)
      grid.appendChild(tile({
        emoji: parts[0], label: parts[1], color: SHELF_COLOR[kind] ?? 'blue',
        badge: count > 0 ? String(count) : '', dim: count === 0 && !hasFree,
        tag: items.some(function (item) { return item.needed }) ? '需要' : '',
        data: { 'data-bag': kind },
        onPick: function () { drillTo(ui, 'bag', kind) },
      }))
    })(CONSUMABLES[k])
  }
  var counts = {
    worn: ui.view.dress.filter(function (item) { return item.worn }).length,
    diary: ui.view.diary.length,
    souvenir: ui.view.pig.souvenirs.length,
    fish: ui.view.fishing.bag.length,
    wallet: (ui.view.wallets || []).length,
  }
  for (var key in EXTRA) {
    (function (category) {
      if ((category === 'worn' || category === 'wallet') && counts[category] === 0) return
      var spec = EXTRA[category]
      grid.appendChild(tile({
        emoji: spec.emoji, label: spec.label, color: spec.color,
        badge: counts[category] > 0 ? String(counts[category]) : '', dim: counts[category] === 0,
        data: { 'data-bag': category },
        onPick: function () { drillTo(ui, 'bag', category) },
      }))
    })(key)
  }
  ui.content.appendChild(grid)
}

function renderWorn(ui) {
  var worn = ui.view.dress.filter(function (item) { return item.worn })
  drillHeader(ui, 'bag', '👕 已穿戴', worn.length + ' 件')
  if (worn.length === 0) { ui.content.appendChild(el('div', 'dp-empty', '现在没有穿戴装扮')); return }
  for (var i = 0; i < worn.length; i += 1) {
    (function (item) {
      var row = el('div', 'dp-item')
      row.appendChild(el('span', 'dp-item-emoji', item.emoji))
      row.appendChild(el('span', 'dp-grow', item.label + (item.slotLabel ? ' · ' + item.slotLabel : '')))
      var off = button('dp-mini', { 'data-take-off': item.key }, function () {
        ui.send('wear', { item: item.key, on: false })
      })
      off.textContent = '脱下'
      row.appendChild(off)
      ui.content.appendChild(row)
    })(worn[i])
  }
}

function renderFish(ui) {
  const list = ui.view.fishing.bag
  drillHeader(ui, 'bag', '🐟 鱼篓', list.length + ' 条')
  if (list.length === 0) { ui.content.appendChild(el('div', 'dp-empty', '鱼篓还是空的')); return }
  for (var i = 0; i < list.length; i += 1) {
    (function (fish) {
      var card = el('div', 'dp-pick dp-tile-card')
      card.appendChild(el('div', 'dp-pick-head', fish.emoji + ' ' + fish.label))
      card.appendChild(el('div', null, fish.sizeCm.toFixed(1) + ' cm · 🪙 ' + fish.price))
      var actions = el('div', 'dp-dev-row')
      var feed = button('dp-mini', { 'data-fish-feed': fish.id }, function () { ui.send('fishFeed', { id: fish.id }) })
      feed.textContent = '🍽 喂'
      var sell = button('dp-mini', { 'data-fish-sell': fish.id }, function () { ui.send('fishSell', { id: fish.id }) })
      sell.textContent = '🪙 卖'
      actions.appendChild(feed); actions.appendChild(sell); card.appendChild(actions); ui.content.appendChild(card)
    })(list[i])
  }
}

/** A consumable shelf: tap an item to use it. */
function renderItems(ui, kind) {
  var parts = shelfParts(kind)
  drillHeader(ui, 'bag', parts[0] + ' ' + parts[1], '点一下就用')
  // 只有用了会改状态的货架才看状态（G 批次反馈：背包首页不要状态条）。
  if (STAT_SHELVES.indexOf(kind) >= 0) statStrip(ui)
  var items = ownedOf(ui, kind)
  var action = CARE_ACTION[kind]
  if (items.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '空的'))
    // 状态页的喂食 / 洗澡 / 玩耍跳过来时如果空了，给一个直接去商店对应货架的入口。
    if (action !== undefined) {
      var buy = button('dp-btn dp-btn-wide', { 'data-bag-shop': kind }, function () {
        ui.select('shop')
        drillTo(ui, 'shop', kind)
      })
      buy.textContent = '🛒 去商店买一点'
      ui.content.appendChild(buy)
    }
    return
  }
  var grid = tileGrid()
  for (var i = 0; i < items.length; i += 1) {
    (function (item) {
      grid.appendChild(tile({
        emoji: item.emoji, label: item.label, color: SHELF_COLOR[kind] ?? 'blue', soft: true,
        badge: item.default === true ? '免费' : '×' + num(ui.view.inventory[item.key], 0), tag: item.needed ? '需要' : '',
        note: action !== undefined ? careEffectLine(action, item) : item.kind === 'promotion' ? item.useLabel : '',
        data: { 'data-use': item.key },
        // 照料货架发喂食 / 洗澡 / 玩耍本身（猪的动作和台词都对得上），其他货架照旧「使用」。
        onPick: function () { ui.send(action ?? 'use', { item: item.key }) },
      }))
    })(items[i])
  }
  ui.content.appendChild(grid)
}

/** 日记: one tile per day, newest first; the picked day's page opens below. */
function renderDiary(ui) {
  drillHeader(ui, 'bag', '📔 日记', ui.view.diary.length + ' 篇')
  if (ui.view.diary.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '还没有日记'))
    return
  }
  var grid = tileGrid()
  var picked = null
  for (var d = 0; d < ui.view.diary.length; d += 1) {
    (function (entry) {
      var active = ui.drill.pick === entry.day
      if (active) picked = entry
      grid.appendChild(tile({
        emoji: '📔', label: shortDay(entry.day), color: EXTRA.diary.color, soft: true, active: active,
        data: { 'data-diary': entry.day },
        onPick: function () {
          ui.drill.pick = active ? null : entry.day
          ui.renderContent()
        },
      }))
    })(ui.view.diary[d])
  }
  ui.content.appendChild(grid)
  if (picked !== null) {
    var page = el('div', 'dp-pick dp-tile-card dp-diary-page')
    page.appendChild(el('div', 'dp-pick-head', picked.day))
    page.appendChild(el('div', null, picked.text))
    ui.content.appendChild(page)
  }
}

/** 纪念品: tap one for its story, and sell it from there. */
function renderSouvenirs(ui) {
  var list = ui.view.pig.souvenirs
  drillHeader(ui, 'bag', '🎁 纪念品', list.length + ' 件')
  if (list.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '收藏册还空着'))
    return
  }
  var grid = tileGrid()
  var picked = null
  for (var s = 0; s < list.length; s += 1) {
    (function (entry, index) {
      var id = entry.key + '#' + index
      var active = ui.drill.pick === id
      if (active) picked = entry
      grid.appendChild(tile({
        emoji: entry.emoji, label: entry.label, color: EXTRA.souvenir.color, soft: true, active: active,
        note: entry.rarityEmoji + entry.rarityLabel,
        data: { 'data-souvenir': id },
        onPick: function () {
          ui.drill.pick = active ? null : id
          ui.renderContent()
        },
      }))
    })(list[s], s)
  }
  ui.content.appendChild(grid)
  if (picked === null) return
  var story = el('div', 'dp-pick dp-tile-card')
  story.appendChild(el('div', 'dp-pick-head', picked.emoji + ' ' + picked.label
    + (picked.fromLabel === '' ? '' : ' · ' + picked.fromLabel)))
  story.appendChild(el('div', null, picked.story === '' ? '（旧版本带回来的，没有故事）' : '「' + picked.story + '」'))
  if (picked.price > 0) {
    var sold = picked
    var sell = button('dp-mini', { 'data-sell': sold.key }, function () {
      ui.drill.pick = null
      ui.send('sell', { souvenir: sold.key })
    })
    sell.textContent = '卖掉 +' + sold.price + ' 🪙'
    sell.style.marginTop = '6px'
    story.appendChild(sell)
  }
  ui.content.appendChild(story)
}

/** 扩展币钱包（规则 1）：每种币一条，都展开着，在这里换成金币或用金币换。 */
function renderWallets(ui) {
  var wallets = ui.view.wallets || []
  drillHeader(ui, 'bag', '👛 钱包', '🪙 ' + ui.view.pig.coins)
  if (wallets.length === 0) { ui.content.appendChild(el('div', 'dp-empty', '还没有扩展币')); return }
  for (var i = 0; i < wallets.length; i += 1) ui.content.appendChild(walletBar(ui, wallets[i], { open: true }))
  ui.content.appendChild(el('div', 'dp-dim', '删掉一个扩展时，它的币会按汇率自动换成金币。'))
}
