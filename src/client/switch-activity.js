// @ts-check
/**
 * 猪在外面时直接去做别的事（rc.1 反馈）：打工、上学、旅行、自动钓鱼的按钮照样能点，
 * 点了先在页面顶上问一句「结束 xxx，改去 yyy 吗？」，确认后先叫回来再出发。
 * 叫回来的规矩不变：打工到一半没有这一班的工钱，上学、旅行退钱，自动钓鱼退鱼饵。
 * @module dsh-piggy/client/switch-activity
 */
import { button, el } from './dom.js'

/** 现在能不能出发：在家能直接去；只是人在外面也算能去（会先问）。 */
export function canStart(ui) {
  return ui.view.canGoOut === true || (ui.view.awayBlocked === 'away' && ui.view.activity !== null)
}

/**
 * 出发：在家直接发；在外面就记下来，页面顶上问一句。
 * @param {any} ui
 * @param {string} label - 「去旅行：海边」这样的话，问的时候用
 * @param {string} action
 * @param {object} payload
 */
export function startOrSwitch(ui, label, action, payload) {
  if (ui.view.activity === null) { ui.send(action, payload); return }
  ui.switchAsk = { label: label, action: action, payload: payload }
  ui.renderContent()
  const scroller = ui.scrollContent ?? ui.content
  if (scroller) scroller.scrollTop = 0
}

/** 叫回来会损失什么。 */
function lossOf(activity) {
  if (activity.kind === 'work') return '打工到一半叫回来，这一班的工钱就没了'
  if (activity.kind === 'fishing') return '鱼饵会退回来'
  return activity.cost > 0 ? '花的钱会退回来' : ''
}

/** 各个出发页最上面调一下：有要问的就画出来。 */
export function renderSwitchAsk(ui) {
  var ask = ui.switchAsk
  var activity = ui.view.activity
  if (!ask) return
  if (activity === null) { ui.switchAsk = null; return }
  var box = el('div', 'dp-alert dp-switch-ask')
  var left = Math.max(1, Math.ceil(activity.secondsLeft / 60))
  box.appendChild(el('b', null, '猪正在' + activity.label.replace(/^兴趣·/, '学') + '（还有 ' + left + ' 分钟）'))
  var loss = lossOf(activity)
  box.appendChild(el('div', null, '要结束它，改去' + ask.label + '吗？' + (loss ? loss + '。' : '')))
  var row = el('div', 'dp-switch-ask-row')
  var go = button('dp-mini', { 'data-switch-go': ask.action }, function () {
    ui.switchAsk = null
    Promise.resolve(ui.send('calloff')).then(function () { return ui.send(ask.action, ask.payload) })
  })
  go.textContent = '改去' + ask.label
  var no = button('dp-mini dp-mini-plain', { 'data-switch-cancel': 'true' }, function () { ui.switchAsk = null; ui.renderContent() })
  no.textContent = '算了'
  row.appendChild(go)
  row.appendChild(no)
  box.appendChild(row)
  ui.content.appendChild(box)
}
