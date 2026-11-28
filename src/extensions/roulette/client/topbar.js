// @ts-check
/**
 * 合并后的牌桌顶栏：标题/金币/右上角入口，以及可折叠的本局设置条。
 * 旧大厅的「好友联机 / 4 人桌 / 规则」都收进右上角「⋯」浮层，
 * 「进入牌桌」不再需要单独一步：扩展默认打开就是这张牌桌。
 */

import { AI_STRATEGIES, money } from './game.js'
import { settingsBlock } from './settings.js'
import { action, coinPill } from './ui.js'

const AI_LABEL = Object.fromEntries(AI_STRATEGIES.map(strategy => [strategy.key, strategy.label]))

export function renderTop(app, game, data) {
  const match = data.match
  const head = app.el('header', 'rt-head rt-top')
  const brand = app.el('div', 'rt-brand')
  brand.appendChild(app.el('div', 'rt-title', 'AI 对战'))
  brand.appendChild(app.el('div', 'rt-sub', match === null
    ? 'AI 对战 · 先看设置再开局'
    : 'AI 对战 · 第 ' + match.round + ' 局 · ' + (data.settings.format === 'bestOf3' ? '三局两胜' : '单局')))
  head.appendChild(brand)
  head.appendChild(coinPill(app, data))
  const more = action(app, 'rt-more', {
    'data-op': 'more',
    'aria-label': '更多入口',
    'aria-expanded': game.ui.menu ? 'true' : 'false',
  }, '⋯', function () { game.toggleMenu() })
  head.appendChild(more)
  return head
}

function menuItem(app, name, note, op, onClick, options = {}) {
  const node = app.button('rt-menu-item' + (options.locked ? ' rt-menu-locked' : '') + (options.danger ? ' rt-menu-danger' : ''), {
    'data-op': op,
    'aria-label': name + '，' + note,
    'aria-disabled': options.locked ? 'true' : 'false',
  }, onClick)
  const copy = app.el('span', 'rt-menu-copy')
  copy.appendChild(app.el('b', null, name))
  copy.appendChild(app.el('span', null, note))
  node.appendChild(copy)
  if (options.locked) node.appendChild(app.el('span', 'rt-menu-lock'))
  return node
}

/** 右上角浮层；点某一项后由动作自己关掉菜单。 */
export function renderMore(app, game, data) {
  if (!game.ui.menu) return null
  const match = data.match
  const pop = app.el('div', 'rt-menu-pop')
  pop.setAttribute('role', 'menu')
  pop.setAttribute('aria-label', '更多入口')
  pop.appendChild(app.el('span', 'rt-menu-title', '更多'))
  pop.appendChild(menuItem(app, '好友联机', '1v1 · 房主开局', 'friend-mode', function () {
    game.toggleMenu()
    // 房间通道只在桌面版大窗口里给；面板里先开大窗口。
    if (!app.room && typeof app.openBig === 'function') { app.openBig(); return }
    game.showPage('online')
  }))
  pop.appendChild(menuItem(app, '4 人桌', '下一阶段接入', 'four-mode', function () {
    game.notify('4 人桌需要宿主房间接口，下一阶段接入')
  }, { locked: true }))
  pop.appendChild(menuItem(app, '规则', '装弹 / 转轮 / 让枪 / 结算', 'rules', function () {
    game.openRules('table')
  }))
  if (match !== null && match.stage !== 'matchOver') {
    pop.appendChild(menuItem(app, '认输离开', '本场底池归 AI', 'forfeit', function () {
      game.closeMenu()
      game.requestLeave()
    }, { danger: true }))
  }
  return pop
}

/** 未开局时的顶栏设置条：一行摘要 + 展开完整设置；开局后不再显示。 */
export function renderSettingsBar(app, game, data) {
  if (data.match !== null) return null
  const box = app.el('div', 'rt-setbar-wrap')
  const bar = app.el('div', 'rt-setbar')
  const s = data.settings
  const summary = [
    '命数 ' + s.lives,
    s.format === 'bestOf3' ? '三局两胜' : '单局',
    '装弹 ' + s.loadCount + ' 发',
    '底注 ' + money(s.stake),
    AI_LABEL[s.ai] ?? s.ai,
  ]
  summary.forEach(function (text) {
    bar.appendChild(app.el('span', 'rt-set-pill', text))
  })
  const toggle = app.button('rt-set-toggle', {
    'data-op': 'settings-toggle',
    'aria-expanded': game.ui.settingsOpen ? 'true' : 'false',
    'aria-label': game.ui.settingsOpen ? '收起设置' : '展开设置',
  }, function () { game.toggleSettings() })
  toggle.textContent = game.ui.settingsOpen ? '收起' : '设置'
  bar.appendChild(toggle)
  box.appendChild(bar)
  if (game.ui.settingsOpen) box.appendChild(settingsBlock(app, game, data))
  return box
}
