// @ts-check
/**
 * 大堂设置：命数、赛制、装弹、底注、AI 策略和 AI 金库。
 * 所有修改都发给服务端校验，客户端只负责画选中态。
 */

import { AI_STRATEGIES, LIVES_OPTIONS, LOAD_MAX, LOAD_MIN, STAKE_LEVELS, STAKE_MAX, STAKE_MIN, money } from './game.js'
import { action, chip, vaultPill } from './ui.js'

export function settingsBlock(app, game, data) {
  const box = app.el('div', 'rt-settings')
  const s = data.settings

  const lives = app.el('div', 'rt-setting')
  lives.appendChild(app.el('span', 'rt-setting-label', '命数'))
  const livesRow = app.el('div', 'rt-chips')
  LIVES_OPTIONS.forEach(function (value) {
    livesRow.appendChild(chip(app, value + ' 条', s.lives === value, function () {
      game.config({ lives: value })
    }, { 'data-op': 'lives-' + value }))
  })
  lives.appendChild(livesRow)
  box.appendChild(lives)

  const format = app.el('div', 'rt-setting')
  format.appendChild(app.el('span', 'rt-setting-label', '赛制'))
  const formatRow = app.el('div', 'rt-chips')
  formatRow.appendChild(chip(app, '单局', s.format === 'single', function () {
    game.config({ format: 'single' })
  }, { 'data-op': 'format-single' }))
  formatRow.appendChild(chip(app, '三局两胜', s.format === 'bestOf3', function () {
    game.config({ format: 'bestOf3' })
  }, { 'data-op': 'format-bestOf3' }))
  format.appendChild(formatRow)
  box.appendChild(format)

  const load = app.el('div', 'rt-setting')
  load.appendChild(app.el('span', 'rt-setting-label', '装弹'))
  const loadRow = app.el('div', 'rt-chips rt-chips-5')
  for (let value = LOAD_MIN; value <= LOAD_MAX; value += 1) {
    loadRow.appendChild(chip(app, value + ' 发', s.loadCount === value, function () {
      game.config({ loadCount: value })
    }, { 'data-op': 'load-' + value }))
  }
  load.appendChild(loadRow)
  box.appendChild(load)

  const stake = app.el('div', 'rt-setting')
  stake.appendChild(app.el('span', 'rt-setting-label', '底注'))
  const stakeRow = app.el('div', 'rt-chips rt-chips-4')
  STAKE_LEVELS.forEach(function (value) {
    stakeRow.appendChild(chip(app, money(value), s.stake === value, function () {
      game.config({ stake: value })
    }, { 'data-op': 'stake-' + value }))
  })
  stake.appendChild(stakeRow)

  const custom = app.el('div', 'rt-stake-custom')
  const input = app.el('input', 'rt-stake-input')
  input.setAttribute('type', 'number')
  input.setAttribute('min', String(STAKE_MIN))
  input.setAttribute('max', String(STAKE_MAX))
  input.setAttribute('step', '100')
  input.setAttribute('inputmode', 'numeric')
  input.setAttribute('aria-label', '自定义底注')
  input.setAttribute('placeholder', '自定义 ' + money(STAKE_MIN) + '–' + money(STAKE_MAX))
  if (!STAKE_LEVELS.includes(s.stake)) input.value = String(s.stake)
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') game.setStake(input.value)
  })
  custom.appendChild(input)
  custom.appendChild(action(app, 'dp-mini rt-chip', { 'data-op': 'stake-custom' }, '设定', function () {
    game.setStake(input.value)
  }))
  stake.appendChild(custom)
  box.appendChild(stake)

  const ai = app.el('div', 'rt-setting')
  ai.appendChild(app.el('span', 'rt-setting-label', 'AI'))
  const select = app.el('select', 'rt-select')
  select.setAttribute('aria-label', 'AI 策略')
  AI_STRATEGIES.forEach(function (strategy) {
    const option = app.el('option', null, strategy.label)
    option.value = strategy.key
    select.appendChild(option)
  })
  select.value = s.ai
  select.addEventListener('change', function () {
    game.config({ ai: select.value })
  })
  ai.appendChild(select)
  box.appendChild(ai)

  const vault = app.el('div', 'rt-setting rt-vault-line')
  vault.appendChild(app.el('span', 'rt-setting-label', '金库'))
  vault.appendChild(vaultPill(app, data))
  box.appendChild(vault)
  return box
}
