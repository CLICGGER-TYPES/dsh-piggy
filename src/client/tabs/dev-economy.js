// @ts-check
/**
 * 调试页「经济」：钱从哪来、花到哪去（宿主 core/economy.js 的账本；设计 docs/design/economy.md）。
 * 扩展的来源显示成「扩展名 · 来源」，扩展删掉了也照样列出来、标「已删除」。
 * @module dsh-piggy/client/tabs/dev-economy
 */
import { el } from '../dom.js'

/** 一个来源的中文名：游戏本身的有固定名字，扩展的显示成「扩展名 · 来源」，删掉的标出来。 */
export function sourceLabel(ui, entry) {
  if (entry.label) return entry.label
  var match = /^ext\.([a-z0-9-]+)\.(.+)$/.exec(entry.source)
  if (match === null) return entry.source
  var extension = (ui.view.extensions ?? []).find(function (item) { return item.key === match[1] })
  return (extension ? extension.emoji + ' ' + extension.label : match[1] + '（已删除）') + ' · ' + match[2]
}

export function renderEconomy(ui, body) {
  var economy = ui.view.economy
  if (!economy) { body.appendChild(el('div', 'dp-dev-note', '宿主太旧，没有账本')); return }
  var head = el('div', 'dp-title')
  head.appendChild(el('b', null, '最近几天'))
  body.appendChild(head)
  for (var d = economy.days.length - 1; d >= 0; d -= 1) {
    var day = el('div', 'dp-row')
    day.appendChild(el('span', null, economy.days[d].day))
    day.appendChild(el('b', null, '+' + economy.days[d].in + ' / -' + economy.days[d].out))
    body.appendChild(day)
  }
  var title = el('div', 'dp-title')
  title.appendChild(el('b', null, '按来源（累计）'))
  body.appendChild(title)
  if (economy.sources.length === 0) body.appendChild(el('div', 'dp-dev-note', '还没有收支'))
  for (var i = 0; i < economy.sources.length; i += 1) {
    var row = el('div', 'dp-row')
    row.setAttribute('data-economy-source', economy.sources[i].source)
    row.appendChild(el('span', null, sourceLabel(ui, economy.sources[i])))
    row.appendChild(el('b', null, (economy.sources[i].in ? '+' + economy.sources[i].in : '') + (economy.sources[i].out ? ' -' + economy.sources[i].out : '')))
    body.appendChild(row)
  }
}
