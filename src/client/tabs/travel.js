// @ts-check
/**
 * 旅行页签。
 *
 * 只列目的地；纪念品放在背包和图鉴。
 * @module dsh-piggy/client/tabs/travel
 */

import { button, el } from '../dom.js'
import { formatMinutes } from '../format.js'
import { canStart, renderSwitchAsk, startOrSwitch } from '../switch-activity.js'

export function renderTravelTab(ui) {
  renderSwitchAsk(ui)
  if (ui.view.trips.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '宿主还没提供目的地。'))
    return
  }
  var list = el('div', 'dp-list')
  for (var i = 0; i < ui.view.trips.length; i += 1) {
    (function (trip) {
      var row = el('div', 'dp-item')
      row.appendChild(el('span', null, trip.emoji))
      var grow = el('div', 'dp-grow')
      grow.appendChild(el('div', null, trip.label))
      grow.appendChild(el('div', 'dp-dim', formatMinutes(trip.minutes) + ' · ' + trip.cost + ' 🪙'
        + (trip.bestRarity ? ' · 可带回 ' + trip.bestRarityEmoji + trip.bestRarity : '')))
      if (trip.locked) grow.appendChild(el('div', 'dp-dim', '🔒 ' + trip.locked + '才能去'))
      row.appendChild(grow)
      var go = button('dp-mini', { 'data-trip': trip.key }, function () { startOrSwitch(ui, '旅行（' + trip.label + '）', 'trip', { trip: trip.key }) })
      go.textContent = '出发'
      go.disabled = !canStart(ui) || !trip.affordable || trip.locked !== ''
      row.appendChild(go)
      list.appendChild(row)
    })(ui.view.trips[i])
  }
  ui.content.appendChild(list)

}
