// @ts-check
/**
 * 商店页签（B8：动森手机式方块）。
 *
 * 第一层：六个货架方块。第二层：这个货架的货，点方块就是买。
 * @module dsh-piggy/client/tabs/shop
 */

import { KIND_ORDER, KIND_TITLE, shelfOf } from '../constants.js'
import { animatePurchase } from '../interaction-motion.js'
import { button, el } from '../dom.js'
import { num } from '../values.js'
import { drillHeader, drillTo, pagedTiles, tile } from '../widgets.js'
import { attachItemHover } from '../item-hover.js'

/** One colour per shelf, so the inner layer still says which shelf it is. */
export var SHELF_COLOR = { food: 'red', bath: 'teal', toy: 'yellow', bait: 'blue', medicine: 'green', revive: 'purple', promotion: 'blue' }

/** 只保留有明确衣服落点的四个槽；neck/back 旧物品先停用，存档数据不删。 */
export var ACTIVE_DRESS_SLOTS = Object.freeze(['head', 'face', 'body', 'feet'])

/** A shelf title 「<emoji> 食物」 split into its emoji and its name. */
export function shelfParts(kind) {
  var title = KIND_TITLE[kind] ?? kind
  var space = title.indexOf(' ')
  return space < 0 ? ['🛒', title] : [title.slice(0, space), title.slice(space + 1)]
}

export function renderShopTab(ui) {
  const extShelves = ui.view.extShelves ?? []
  if (ui.view.shop.length === 0 && extShelves.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '宿主还没提供货架。'))
    return
  }
  var coins = '🪙 ' + ui.view.pig.coins
  var shelf = ui.drill.shop
  const extShelf = extShelves.find(entry => 'ext:' + entry.extension === shelf)
  if (extShelf) { renderExtShelf(ui, extShelf); return }
  if (shelf === null || KIND_ORDER.indexOf(shelf) < 0) {
    renderShelves(ui)
    return
  }
  var parts = shelfParts(shelf)
  drillHeader(ui, 'shop', parts[0] + ' ' + parts[1], coins)
  var tiles = []
  var items = ui.view.shop.filter(function (item) { return shelfOf(item.kind) === shelf })
  if (shelf === 'dress') items = items.filter(function (item) { return ACTIVE_DRESS_SLOTS.indexOf(item.slot) >= 0 })
  var boughtTile = null
  for (var i = 0; i < items.length; i += 1) {
    var node = itemTile(ui, items[i], SHELF_COLOR[shelf])
    tiles.push(node)
    if (items[i].key === ui.justBought) boughtTile = node
  }
  ui.content.appendChild(pagedTiles(ui, 'shop:' + shelf, tiles))
  if (boughtTile !== null) animatePurchase(boughtTile)
}

/** The top layer; its title row (with the money) is the app header. */
function renderShelves(ui) {
  var tiles = []
  for (var k = 0; k < KIND_ORDER.length; k += 1) {
    (function (kind) {
      var items = ui.view.shop.filter(function (item) { return shelfOf(item.kind) === kind })
      if (items.length === 0) return
      var parts = shelfParts(kind)
      var needed = items.some(function (item) { return item.needed })
      tiles.push(tile({
        emoji: parts[0], label: parts[1], color: SHELF_COLOR[kind] ?? 'blue',
        tag: needed ? '需要' : '',
        data: { 'data-shelf': kind },
        onPick: function () { drillTo(ui, 'shop', kind) },
      }))
    })(KIND_ORDER[k])
  }
  for (const shelf of ui.view.extShelves ?? []) {
    tiles.push(tile({ emoji: shelf.emoji, label: shelf.label, color: shelf.color || 'orange',
      // 跟内置货架一样只写名字；不用金币买的才在下面注明货币。
      note: shelf.currency && shelf.currency.label !== '金币' ? shelf.currency.label : undefined, data: { 'data-shelf': 'ext:' + shelf.extension },
      onPick: function () { drillTo(ui, 'shop', 'ext:' + shelf.extension) } }))
  }
  ui.content.appendChild(pagedTiles(ui, 'shop', tiles, { rows: 3 }))
}

/** 下载扩展自己的商品，购买仍由扩展的 buy 动作结算。
 *  和内置商店同一套 3×3 分页 + 悬停卡；新增扩展只要声明 shelf 就自动复用。 */
function renderExtShelf(ui, shelf) {
  const currency = shelf.currency ?? { label: '货币', emoji: '🪙', balance: 0 }
  drillHeader(ui, 'shop', shelf.emoji + ' ' + shelf.label, currency.emoji + ' ' + currency.balance)
  ui.content.appendChild(el('div', 'dp-ext-shelf-note', '用' + currency.label + '买 · ' + currency.emoji + ' 余额 ' + currency.balance))
  const items = Array.isArray(shelf.items) ? shelf.items : []
  if (items.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '这个货架还空着。'))
    return
  }
  const tiles = []
  for (const item of items) {
    const hasPick = Array.isArray(item.pick)
    const node = tile({
      emoji: item.emoji || '📦', label: item.label, color: shelf.color || 'orange', soft: true,
      note: item.price + ' ' + currency.emoji,
      badge: hasPick ? '可选' : '',
      dim: item.disabled === true,
      disabled: item.disabled === true,
      data: { 'data-ext-buy': item.key, 'data-ext-item': item.key, 'aria-disabled': String(item.disabled === true) },
      onPick: function () {
        if (hasPick) {
          ui.drill.pick = ui.drill.pick === item.key ? null : item.key
          ui.renderContent()
          return
        }
        ui.send('ext', { key: shelf.extension, op: 'buy', data: { item: item.key, pick: null } })
      },
    })
    attachItemHover(ui, node, {
      ...item, kind: 'ext', kindLabel: shelf.label,
      currency, balance: currency.balance,
    }, 'shop')
    tiles.push(node)
  }
  ui.content.appendChild(pagedTiles(ui, 'ext:' + shelf.extension, tiles, { rows: 3 }))
  const picked = items.find(item => Array.isArray(item.pick) && ui.drill.pick === item.key)
  if (picked !== undefined) {
    const box = el('div', 'dp-pick dp-ext-pick-box')
    box.appendChild(el('div', 'dp-pick-head', '选择要兑换的' + picked.label))
    const row = el('div', 'dp-ext-picks')
    for (const choice of picked.pick) {
      const choose = button('dp-mini dp-mini-plain', { 'data-ext-pick': choice.key }, function () {
        ui.drill.pick = null
        ui.send('ext', { key: shelf.extension, op: 'buy', data: { item: picked.key, pick: choice.key } })
      })
      choose.textContent = (choice.emoji ? choice.emoji + ' ' : '') + choice.label
      row.appendChild(choose)
    }
    box.appendChild(row)
    ui.content.appendChild(box)
  }
}

/** A thing on the shelf: tap to buy. 家当 says 已拥有 or the level it waits for. */
function itemTile(ui, item, color) {
  var owned = num(ui.view.inventory[item.key], 0)
  var note = item.price + ' 🪙'
  if (item.owned) note = '已拥有'
  else if (item.kind === 'dress' && item.unlocked === false) note = '🔒 Lv.' + item.level
  const node = tile({
    emoji: item.emoji, label: item.label, color: color, soft: true, note: note,
    badge: owned > 0 ? '×' + owned : '',
    tag: item.needed ? '需要' : (item.owned && item.worn ? '穿着' : ''),
    dim: !item.owned && (!item.affordable || (item.kind === 'dress' && item.unlocked === false)),
    disabled: item.owned === true,
    data: { 'data-buy': item.key },
    onPick: function () { ui.send('buy', { item: item.key }) },
  })
  if (item.kind === 'body') node.setAttribute('aria-description', item.blurb)
  attachItemHover(ui, node, item, 'shop')
  return node
}
