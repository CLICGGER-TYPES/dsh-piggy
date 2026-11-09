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
import { drillHeader, drillTo, pagedTiles, statStrip, tile } from '../widgets.js'
import { SHELF_COLOR, shelfParts } from './shop.js'
import { walletBar } from '../wallet.js'
import { attachItemHover } from '../item-hover.js'

/** 所有消耗品货架，子页和首页共用。 */
var CONSUMABLES = KIND_ORDER

/** 这三个货架的东西用了就是一次照料（喂食 / 洗澡 / 玩耍），和状态页原来的按钮一样。 */
var CARE_ACTION = { food: 'feed', bath: 'bathe', toy: 'play' }

/** 打开时顶上显示状态条的货架。 */
var STAT_SHELVES = ['food', 'bath', 'toy', 'medicine']

/** The non-shelf categories: what they are called and how they look. */
var EXTRA = {
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
  if (open === 'diary') renderDiary(ui)
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
  var tiles = []
  // 前 9 格是 6 个消耗品货架 + 日记 / 纪念品 / 鱼篓；钱包多出来，
  // 跟主屏一样翻到第 2 页。
  CONSUMABLES.forEach(function (kind) {
    var items = ownedOf(ui, kind)
    var count = items.reduce(function (sum, item) { return sum + num(ui.view.inventory[item.key], 0) }, 0)
    var hasFree = items.some(function (item) { return item.default === true })
    var parts = shelfParts(kind)
    tiles.push(tile({
      emoji: parts[0], label: parts[1], color: SHELF_COLOR[kind] ?? 'blue',
      badge: count > 0 ? String(count) : '', dim: count === 0 && !hasFree,
      tag: items.some(function (item) { return item.needed }) ? '需要' : '',
      data: { 'data-bag': kind },
      onPick: function () { drillTo(ui, 'bag', kind) },
    }))
  })
  var counts = bagCounts(ui)
  ;['diary', 'souvenir', 'fish', 'wallet'].forEach(function (key) {
    var spec = EXTRA[key]
    tiles.push(tile({
      emoji: spec.emoji, label: spec.label, color: spec.color,
      badge: counts[key] > 0 ? String(counts[key]) : '', dim: counts[key] === 0,
      data: { 'data-bag': key },
      onPick: function () { drillTo(ui, 'bag', key) },
    }))
  })
  ui.content.appendChild(pagedTiles(ui, 'bag', tiles, { rows: 3 }))
}

function bagCounts(ui) {
  return {
    diary: ui.view.diary.length,
    souvenir: ui.view.pig.souvenirs.length,
    fish: ui.view.fishing.bag.length,
    wallet: (ui.view.wallets || []).length,
  }
}

var FISH_STARS = { common: 1, uncommon: 2, rare: 3, legend: 4 }

/** 和 feedFish 的结算一致：最多 +60 饱食；写成玩家一眼能算的加值。 */
function fishGain(price) {
  var gain = Math.min(60, num(price, 0) / 2)
  return Number.isInteger(gain) ? String(gain) : gain.toFixed(1)
}

function renderFish(ui) {
  const list = ui.view.fishing.bag
  const total = list.reduce(function (sum, fish) { return sum + num(fish.price, 0) }, 0)
  drillHeader(ui, 'bag', '🐟 鱼篓', list.length + ' 条' + (list.length > 0 ? ' · 🪙 ' + total : ''))
  if (list.length === 0) { ui.content.appendChild(el('div', 'dp-empty', '鱼篓还是空的')); return }
  var rows = el('div', 'dp-fish-list')
  for (var i = 0; i < list.length; i += 1) {
    (function (fish) {
      var row = el('div', 'dp-fish-row')
      row.setAttribute('data-rarity', fish.rarity || 'common')
      row.appendChild(el('span', 'dp-fish-row-emoji', fish.emoji || '🐟'))
      var main = el('div', 'dp-fish-row-main')
      var nameLine = el('div', 'dp-fish-name')
      nameLine.appendChild(el('b', null, fish.label))
      var stars = FISH_STARS[fish.rarity] ?? 1
      nameLine.appendChild(el('span', 'dp-fish-mini-stars', '★'.repeat(stars) + '☆'.repeat(4 - stars)))
      main.appendChild(nameLine)
      var facts = el('div', 'dp-fish-facts')
      facts.appendChild(el('span', 'dp-fish-size', fish.sizeCm.toFixed(1) + ' cm'))
      if (Number(fish.maxCm) > 0 && fish.sizeCm >= fish.maxCm * 0.85) facts.appendChild(el('span', 'dp-fish-big', '大个的！'))
      main.appendChild(facts)
      var actions = el('div', 'dp-fish-actions')
      var feed = button('dp-mini dp-fish-feed', {
        'data-fish-feed': fish.id,
        title: '喂食，饱食 +' + fishGain(fish.price),
      }, function () { ui.send('fishFeed', { id: fish.id }) })
      feed.textContent = '🍽 喂 +' + fishGain(fish.price)
      var sell = button('dp-mini dp-fish-sell', {
        'data-fish-sell': fish.id,
        title: '卖出，得到 ' + fish.price + ' 金币',
      }, function () { ui.send('fishSell', { id: fish.id }) })
      sell.textContent = '🪙 卖 +' + fish.price
      actions.appendChild(feed); actions.appendChild(sell); main.appendChild(actions)
      row.appendChild(main)
      rows.appendChild(row)
    })(list[i])
  }
  ui.content.appendChild(rows)
}

/** A consumable shelf: tap an item to use it. */
function renderItems(ui, kind) {
  var parts = shelfParts(kind)
  var target = ui.careTarget ?? null
  drillHeader(ui, 'bag', parts[0] + ' ' + parts[1], target === null ? '点一下就用' : '给 ' + target.name)
  // 只有用了会改状态的货架才看状态（G 批次反馈：背包首页不要状态条）。
  if (STAT_SHELVES.indexOf(kind) >= 0) statStrip(ui)
  var items = ownedOf(ui, kind)
  var action = CARE_ACTION[kind]
  var hungry = target === null && kind === 'toy' && ui.view.actions.play?.blocked === 'hungry'
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
  var tiles = []
  for (var i = 0; i < items.length; i += 1) {
    (function (item) {
      var node = tile({
        emoji: item.emoji, label: item.label, color: SHELF_COLOR[kind] ?? 'blue', soft: true,
        badge: item.default === true ? '免费' : '×' + num(ui.view.inventory[item.key], 0),
        tag: target !== null && target.illness && target.illness.cureKey === item.key ? '对症' : (item.needed ? '需要' : ''),
        note: hungry ? '太饿了，先吃点东西' : item.kind === 'promotion' || item.kind === 'body' ? item.useLabel : '',
        disabled: hungry,
        data: { 'data-use': item.key },
        // 朋友的猪：走联机照顾；自己的猪：和以前一样发喂食/洗澡/玩耍。
        onPick: function () {
          if (target !== null) careFriend(ui, target, action ?? (kind === 'medicine' ? 'medicine' : 'use'), item.key)
          else ui.send(action ?? 'use', { item: item.key })
        },
      })
      attachItemHover(ui, node, { ...item, kind: item.kind ?? kind }, 'bag')
      tiles.push(node)
    })(items[i])
  }
  ui.content.appendChild(pagedTiles(ui, 'bag:' + kind, tiles))
}

/** 用自己背包里的东西照顾朋友的猪；成功后回朋友状态页。 */
function careFriend(ui, target, action, itemKey) {
  var shell = typeof window !== 'undefined' ? (/** @type {any} */ (window)).piggyShell : null
  if (!shell || !shell.friend || typeof shell.friend.care !== 'function') {
    ui.toast('联机照顾暂不可用')
    return
  }
  Promise.resolve(shell.friend.care(target.id, action, itemKey)).then(function (result) {
    if (result && result.ok === true) {
      ui.careTarget = null
      ui.toast(result.message || '照顾成功')
      ui.select('status')
      if (typeof ui.refresh === 'function') ui.refresh()
    } else {
      ui.toast(result && typeof result.reason === 'string' ? result.reason : '照顾没送出去')
    }
  }).catch(function () { ui.toast('照顾没送出去') })
}

/** 照料记录的展开状态挂在 ui.drill 上：只是这一屏的样子，不发送、不存档。 */
function careOpen(ui, day) {
  return !!(ui.drill.diaryCare && ui.drill.diaryCare[day])
}

function toggleCare(ui, day) {
  var open = careOpen(ui, day)
  if (!ui.drill.diaryCare) ui.drill.diaryCare = Object.create(null)
  if (open) delete ui.drill.diaryCare[day]
  else ui.drill.diaryCare[day] = true
  ui.renderContent()
}

/** 正文只认 body：空串就是空页（可能只剩照料记录），绝不回退到 text。 */
function diaryBody(entry) {
  return typeof entry.body === 'string' ? entry.body : ''
}

function diaryCareNotes(entry) {
  return Array.isArray(entry.careNotes)
    ? entry.careNotes.filter(note => typeof note === 'string')
    : []
}

/** 日记: one tile per day, newest first; the picked day's page opens below. */
function renderDiary(ui) {
  drillHeader(ui, 'bag', '📔 日记', ui.view.diary.length + ' 篇')
  if (ui.view.diary.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '还没有日记'))
    return
  }
  var tiles = []
  var picked = null
  for (var d = 0; d < ui.view.diary.length; d += 1) {
    (function (entry) {
      var active = ui.drill.pick === entry.day
      if (active) picked = entry
      tiles.push(tile({
        emoji: '📔', label: shortDay(entry.day), color: EXTRA.diary.color, soft: true, active: active,
        data: { 'data-diary': entry.day },
        onPick: function () {
          ui.drill.pick = active ? null : entry.day
          ui.renderContent()
        },
      }))
    })(ui.view.diary[d])
  }
  ui.content.appendChild(pagedTiles(ui, 'bag:diary', tiles))
  if (picked === null) return
  var body = diaryBody(picked)
  var notes = diaryCareNotes(picked)
  var page = el('div', 'dp-pick dp-tile-card dp-diary-page')
  page.appendChild(el('div', 'dp-pick-head', picked.day))
  if (body !== '') page.appendChild(el('div', 'dp-diary-body', body))
  // 只有明细的一页：说清楚这里是什么，不拿别的东西补正文。
  if (body === '' && notes.length > 0) page.appendChild(el('div', 'dp-diary-note', '这页只有照料记录。'))
  if (notes.length > 0) {
    var open = careOpen(ui, picked.day)
    var panelId = 'dp-diary-care-' + picked.day.replace(/[^\w-]/g, '_')
    var toggle = button('dp-diary-care-toggle', {
      'data-diary-care': picked.day,
      'aria-expanded': open ? 'true' : 'false',
      'aria-controls': panelId,
    }, function () { toggleCare(ui, picked.day) })
    toggle.appendChild(el('span', null, '照料记录（' + notes.length + ' 条）'))
    toggle.appendChild(el('span', 'dp-diary-care-arrow', open ? '▴' : '▾'))
    page.appendChild(toggle)
    if (open) {
      var panel = el('div', 'dp-diary-care')
      panel.id = panelId
      for (var n = 0; n < notes.length; n += 1) panel.appendChild(el('div', 'dp-diary-care-row', notes[n]))
      page.appendChild(panel)
    }
  }
  ui.content.appendChild(page)
}

/** 纪念品: tap one for its story, and sell it from there. */
function renderSouvenirs(ui) {
  var list = ui.view.pig.souvenirs
  drillHeader(ui, 'bag', '🎁 纪念品', list.length + ' 件')
  if (list.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '收藏册还空着'))
    return
  }
  var tiles = []
  var picked = null
  for (var s = 0; s < list.length; s += 1) {
    (function (entry, index) {
      var id = entry.key + '#' + index
      var active = ui.drill.pick === id
      if (active) picked = entry
      tiles.push(tile({
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
  ui.content.appendChild(pagedTiles(ui, 'bag:souvenir', tiles))
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
