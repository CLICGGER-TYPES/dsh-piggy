// @ts-check
/**
 * 旅行页签。
 *
 * 只列目的地；纪念品放在背包和图鉴。
 * @module dsh-piggy/client/tabs/travel
 */

import { el } from '../dom.js'
import { attachActivityHover } from '../item-hover.js'
import { formatMinutes } from '../format.js'
import { canStart, renderSwitchAsk, startOrSwitch } from '../switch-activity.js'
import { pagedTiles, tile } from '../widgets.js'

/** One colour per destination, so the grid still reads like a map. */
var TRIP_COLOR = {
  park: 'green', funfair: 'pink', zoo: 'orange', suburb: 'lime',
  aquarium: 'blue', bambooforest: 'teal', mountain: 'brown', hotspring: 'red',
  snowpeak: 'blue', sea: 'teal', desert: 'yellow', oldtown: 'brown',
}

function tripHoverConfig(trip) {
  var chips = []
  if (trip.locked) chips.push({ text: '🔒 未解锁', tone: 'warm' })
  else if (!trip.affordable) chips.push({ text: '金币不足', tone: 'red' })
  else if (!trip.available) chips.push({ text: '不在家', tone: 'warm' })
  else chips.push({ text: '可出发', tone: 'mint' })
  return {
    emoji: trip.emoji, label: trip.label, kind: '旅行',
    rows: [
      { label: '时长', value: formatMinutes(trip.minutes) },
      { label: '花费', value: trip.cost + ' 🪙' },
      { label: '心情', value: '+' + trip.happiness },
      { label: '纪念品', value: trip.souvenirCount + ' 件 · 最高 ' + trip.bestRarityEmoji + trip.bestRarity },
    ],
    desc: trip.locked ? ('解锁条件：' + trip.locked) : '出门走走，回来会带回纪念品。',
    chips: chips,
  }
}

export function renderTravelTab(ui) {
  renderSwitchAsk(ui)
  if (ui.view.trips.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '宿主还没提供目的地。'))
    return
  }
  var tiles = []
  for (var i = 0; i < ui.view.trips.length; i += 1) {
    (function (trip) {
      var node = tile({
        emoji: trip.emoji, label: trip.label, color: TRIP_COLOR[trip.key] ?? 'blue', soft: true,
        tag: trip.locked ? '🔒' : '',
        dim: trip.locked !== '' || !trip.affordable,
        disabled: !canStart(ui) || !trip.affordable || trip.locked !== '',
        data: { 'data-trip': trip.key },
        onPick: function () { startOrSwitch(ui, '旅行（' + trip.label + '）', 'trip', { trip: trip.key }) },
      })
      attachActivityHover(ui, node, tripHoverConfig(trip), 'trip:' + trip.key)
      tiles.push(node)
    })(ui.view.trips[i])
  }
  ui.content.appendChild(pagedTiles(ui, 'travel', tiles, { rows: 3 }))
}
