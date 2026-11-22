// @ts-check
/**
 * 面板里反复用的小零件：标题栏、金库、菜单行、按钮、页脚和图片。
 * 这里不碰状态，只把游戏对象给的回调接到按钮上。
 */

import { money } from './game.js'

export function assetImage(app, name, className) {
  const node = app.el('img', className)
  node.src = typeof app.asset === 'function' ? app.asset(name) : ''
  node.alt = ''
  return node
}

export function coin() {
  const node = document.createElement('span')
  node.className = 'rt-coin'
  node.setAttribute('aria-hidden', 'true')
  return node
}

export function vaultPill(app, state) {
  const pill = app.el('div', 'rt-vault')
  pill.setAttribute('aria-label', 'AI 金库 ' + money(state.vault))
  pill.appendChild(coin())
  pill.appendChild(app.el('small', null, '金库'))
  pill.appendChild(app.el('b', null, money(state.vault)))
  return pill
}

export function coinPill(app, state) {
  const pill = app.el('div', 'rt-vault rt-wallet')
  pill.setAttribute('aria-label', '金币 ' + money(state.coins))
  pill.appendChild(coin())
  pill.appendChild(app.el('b', null, money(state.coins)))
  return pill
}

/**
 * 子页标题：可选的返回按钮 + 标题 + 副标题 + 金币。
 */
export function pageHead(app, state, title, sub, backLabel, onBack) {
  const head = app.el('header', 'rt-head')
  if (typeof onBack === 'function') {
    const back = app.button('rt-back', { 'aria-label': backLabel || '返回' }, onBack)
    back.textContent = '返回'
    head.appendChild(back)
  }
  const brand = app.el('div', 'rt-brand')
  brand.appendChild(app.el('div', 'rt-title', title))
  if (sub) brand.appendChild(app.el('div', 'rt-sub', sub))
  head.appendChild(brand)
  head.appendChild(coinPill(app, state))
  return head
}

/** 按钮统一走宿主给的 app.button；测试里的假 DOM 没有 stopPropagation 也不影响。 */
export function action(app, className, attrs, label, onClick) {
  const node = app.button(className, attrs || {}, onClick)
  if (label !== undefined) node.textContent = label
  return node
}

/** 设置/装弹用的单选小胶囊。 */
export function chip(app, label, active, onClick, attrs) {
  const node = action(app, 'dp-mini rt-chip' + (active ? ' rt-chip-on' : ''), attrs || {}, label, onClick)
  node.setAttribute('aria-pressed', active ? 'true' : 'false')
  return node
}


/**
 * 大厅玩法行。locked 的行仍然可点，只负责提示需要宿主房间接口。
 */
export function modeRow(app, options) {
  let className = 'rt-mode'
  if (options.primary) className += ' rt-mode-primary'
  if (options.locked) className += ' rt-mode-locked'
  const node = app.button(className, {
    'data-op': options.op,
    'aria-disabled': options.locked ? 'true' : 'false',
    'aria-label': options.name + '，' + options.note,
  }, options.onClick)
  const medal = app.el('span', options.grid ? 'rt-medal rt-medal-grid' : 'rt-medal')
  if (options.grid) {
    for (let index = 0; index < 4; index += 1) medal.appendChild(app.el('i'))
  } else if (options.asset) {
    medal.appendChild(assetImage(app, options.asset, 'rt-medal-img'))
  } else if (options.emoji) {
    medal.textContent = options.emoji
  }
  node.appendChild(medal)
  const copy = app.el('span', 'rt-mode-copy')
  copy.appendChild(app.el('span', 'rt-mode-name', options.name))
  copy.appendChild(app.el('span', 'rt-mode-note', options.note))
  node.appendChild(copy)
  const side = app.el('span', 'rt-mode-side')
  side.appendChild(app.el('span', options.locked ? 'rt-lock' : 'rt-chev'))
  node.appendChild(side)
  return node
}

/** 规则入口和右下角的小字；loading / table / lobby 共用。 */
export function footer(app, options) {
  const row = app.el('div', 'rt-foot')
  const rules = app.button('rt-link', { 'data-op': 'rules', 'aria-label': '看规则' }, options.onRules)
  rules.textContent = '规则'
  row.appendChild(rules)
  if (typeof options.extra === 'function') row.appendChild(options.extra())
  row.appendChild(app.el('span', 'rt-spacer'))
  row.appendChild(app.el('span', 'rt-tiny', options.note || '单局底池'))
  return row
}
