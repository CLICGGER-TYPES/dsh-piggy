// @ts-check
/** 成就图鉴的筛选、排序和详情；浏览状态只属于当前面板，不进入游戏存档。 */
import { artSource } from '../art-path.js'
import { button, el } from '../dom.js'
import { drillHeader } from '../widgets.js'

/** @param {any} ui @param {any[]} entries */
export function renderAchievements(ui, entries) {
  const browser = ui.achievementBrowser ??= { filter: 'all', sort: 'group', scrollTop: 0 }
  const selected = entries.find(entry => entry.key === ui.drill.pick)
  const earned = entries.filter(entry => entry.acquired).length
  drillHeader(ui, 'dex', '🏆 小猪成就', earned + '/' + entries.length)
  if (selected !== undefined) return renderAchievementDetail(ui, selected)
  ui.content.appendChild(el('div', 'dp-ach-intro', '每一枚小猪徽章，都记着一段一起经历的日常。'))
  renderControls(ui, browser)
  const visible = entries.filter(entry => browser.filter === 'all' || entry.acquired === (browser.filter === 'earned'))
  const count = el('div', 'dp-ach-count', '显示 ' + visible.length + ' / ' + entries.length + ' 项')
  count.setAttribute('role', 'status')
  ui.content.appendChild(count)
  if (visible.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', browser.filter === 'earned' ? '还没有获得成就，慢慢积累吧' : browser.filter === 'locked' ? '当前成就都已获得' : '暂无成就'))
    return
  }
  if (browser.sort === 'progress') {
    // 跨分类比较完成比例；已获得的放最后，同进度保持原来的顺序。
    visible.sort((a, b) => Number(a.acquired) - Number(b.acquired) || (a.acquired ? 0 : progressRatio(b) - progressRatio(a)))
    const grid = el('div', 'dp-ach-grid')
    for (const entry of visible) grid.appendChild(achievementCard(ui, entry))
    ui.content.appendChild(grid)
    return
  }
  for (const group of [...new Set(visible.map(entry => entry.group))]) {
    ui.content.appendChild(el('div', 'dp-ach-group', group))
    const grid = el('div', 'dp-ach-grid')
    for (const entry of visible.filter(item => item.group === group)) grid.appendChild(achievementCard(ui, entry))
    ui.content.appendChild(grid)
  }
}

function progressRatio(entry) {
  if (!Number.isFinite(entry.progress) || !Number.isFinite(entry.target) || entry.target <= 0) return 0
  return Math.max(0, Math.min(1, entry.progress / entry.target))
}

function renderControls(ui, browser) {
  const controls = el('div', 'dp-ach-controls')
  /** @type {Array<[string, string, Array<[string, string]>]>} */
  const rows = [
    ['filter', '成就筛选', [['all', '全部'], ['earned', '已获得'], ['locked', '未获得']]],
    ['sort', '成就排序', [['group', '分类排列'], ['progress', '快达成优先']]],
  ]
  for (const [field, label, options] of rows) {
    const row = el('div', 'dp-seg dp-ach-options')
    row.setAttribute('role', 'group')
    row.setAttribute('aria-label', label)
    for (const [key, text] of options) {
      const attr = 'data-achievement-' + field
      const pick = button('dp-seg-btn', { [attr]: key, 'aria-pressed': String(browser[field] === key) }, function () {
        if (browser[field] === key) return
        browser[field] = key
        browser.scrollTop = 0
        ui.renderContent()
        ui.content.scrollTop = 0
        ui.content.querySelector('[' + attr + '="' + key + '"]')?.focus({ preventScroll: true })
      })
      pick.textContent = text
      row.appendChild(pick)
    }
    controls.appendChild(row)
  }
  ui.content.appendChild(controls)
}

function achievementCard(ui, entry) {
  const card = button('dp-ach-card', { 'data-achievement': entry.key, 'data-earned': String(entry.acquired) }, function () {
    ui.achievementBrowser.scrollTop = ui.content.scrollTop
    ui.drill.pick = entry.key
    ui.renderContent()
    ui.content.scrollTop = 0
  })
  card.appendChild(badge(entry))
  card.appendChild(el('b', null, entry.label))
  card.appendChild(el('small', null, entry.acquired ? '已获得' : entry.progress + '/' + entry.target + ' ' + entry.unit))
  return card
}

function badge(entry) {
  const image = /** @type {HTMLImageElement} */ (el('img', 'dp-ach-badge'))
  image.src = artSource(entry.art)
  image.alt = entry.label + ' · 小猪徽章'
  return image
}

function dateLabel(entry) {
  if (entry.recovered || entry.firstAt === null) return '旧存档补录 · 完成日期未知'
  return '获得于 ' + new Date(entry.firstAt).toLocaleDateString('zh-CN')
}

function renderAchievementDetail(ui, entry) {
  const back = button('dp-ach-back', { 'data-achievement-back': 'true' }, function () {
    ui.drill.pick = null
    ui.renderContent()
    ui.content.scrollTop = ui.achievementBrowser.scrollTop
    ui.content.querySelector('[data-achievement="' + entry.key + '"]')?.focus({ preventScroll: true })
  })
  back.textContent = '‹ 返回成就列表'
  ui.content.appendChild(back)
  const card = el('div', 'dp-ach-detail')
  card.setAttribute('data-earned', String(entry.acquired))
  card.setAttribute('data-achievement-detail', entry.key)
  card.appendChild(badge(entry))
  card.appendChild(el('h3', null, entry.label))
  card.appendChild(el('p', null, entry.description))
  card.appendChild(el('b', null, entry.acquired ? '已获得' : entry.progress + ' / ' + entry.target + ' ' + entry.unit))
  card.appendChild(el('small', null, entry.acquired ? dateLabel(entry) : entry.availability === 'update-required' ? '更新对应扩展后可记录这项成就' : entry.availability === 'not-installed' ? '重新安装对应扩展后可继续积累' : entry.availability === 'off' ? '启用对应扩展后可继续积累' : '解锁后永久保留这枚小猪徽章'))
  ui.content.appendChild(card)
}
