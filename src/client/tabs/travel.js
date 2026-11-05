// @ts-check
/**
 * 旅行页签。
 *
 * 只列目的地；纪念品放在背包和图鉴。
 * @module dsh-piggy/client/tabs/travel
 */

import { el } from '../dom.js'
import { formatMinutes } from '../format.js'
import { canStart, renderSwitchAsk, startOrSwitch } from '../switch-activity.js'
import { pagedTiles, tile } from '../widgets.js'

/** One colour per destination, so the grid still reads like a map. */
var TRIP_COLOR = {
  park: 'green', funfair: 'pink', zoo: 'orange', suburb: 'lime',
  aquarium: 'blue', bambooforest: 'teal', mountain: 'brown', hotspring: 'red',
  snowpeak: 'blue', sea: 'teal', desert: 'yellow', oldtown: 'brown',
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
      tiles.push(tile({
        emoji: trip.emoji, label: trip.label, color: TRIP_COLOR[trip.key] ?? 'blue', soft: true,
        note: formatMinutes(trip.minutes) + ' · ' + trip.cost + '🪙',
        tag: trip.locked ? '🔒' : '',
        dim: trip.locked !== '' || !trip.affordable,
        disabled: !canStart(ui) || !trip.affordable || trip.locked !== '',
        data: { 'data-trip': trip.key },
        onPick: function () { startOrSwitch(ui, '旅行（' + trip.label + '）', 'trip', { trip: trip.key }) },
      }))
    })(ui.view.trips[i])
  }
  ui.content.appendChild(pagedTiles(ui, 'travel', tiles, { rows: 3 }))
}
