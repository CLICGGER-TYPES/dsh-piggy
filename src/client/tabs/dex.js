// @ts-check
/** C4 图鉴。形态/皮肤用小闪卡，其余收藏按动森博物馆与目录呈现。 */

import { offParts } from '../extensions.js'
import { shelfOf } from '../constants.js'
import { artSource } from '../art-path.js'
import { button, el, sideScroller } from '../dom.js'
import { drillHeader, drillTo, tile, tileGrid } from '../widgets.js'
import { renderAchievements } from './achievements.js'
import { renderHoloSection } from './dex-holo.js'

const SECTIONS = []
const ITEM_KINDS = [
  ['all', '全部'], ['food', '食物'], ['bath', '洗浴'], ['toy', '玩具'], ['medicine', '药品'],
  ['promotion', '晋升'], ['dress', '装扮'],
]

/** Register or replace one collection category. */
export function registerDexSection(section) {
  if (section === null || typeof section !== 'object' || typeof section.key !== 'string') return
  const index = SECTIONS.findIndex(entry => entry.key === section.key)
  if (index >= 0) SECTIONS[index] = section
  else SECTIONS.push(section)
}

for (const section of [
  { key: 'achievements', label: '成就', emoji: '🏆', color: 'teal' },
  { key: 'forms', label: '形态', emoji: '🐷', color: 'pink' },
  { key: 'skins', label: '皮肤', emoji: '🎨', color: 'purple' },
  { key: 'fish', label: '鱼类', emoji: '🐟', color: 'blue' },
  { key: 'items', label: '道具', emoji: '🎒', color: 'orange' },
  { key: 'souvenirs', label: '纪念品', emoji: '🧳', color: 'teal' },
]) registerDexSection(section)

export function renderDexTab(ui) {
  const picked = ui.drill.dex
  if (picked === null) return renderSections(ui)
  const ext = (ui.view.extDex ?? []).find(entry => picked === 'ext:' + entry.extension + ':' + entry.key)
  if (ext && ext.style === 'holo') { renderHoloSection(ui, ext); return }
  if (ext) { renderExtPlain(ui, ext); return }
  const section = SECTIONS.find(entry => entry.key === picked)
  if (section === undefined) return drillTo(ui, 'dex', null)
  const entries = ui.view.dex[section.key] ?? []
  if (section.key === 'achievements') return renderAchievements(ui, entries)
  const detail = entries.find(entry => entry.key === ui.drill.pick)
  if (detail !== undefined) return renderDetail(ui, section, detail)
  renderEntries(ui, section, entries)
}

/** 不是闪卡的扩展分区（作物、矿石）：跟纪念品一样的展柜格子，详情页也共用。 */
function renderExtPlain(ui, ext) {
  const section = { key: 'ext:' + ext.extension + ':' + ext.key, label: ext.label, emoji: ext.emoji }
  const entries = (ext.entries ?? []).map(entry => ({
    key: entry.key, emoji: entry.emoji, label: entry.label, acquired: entry.acquired === true,
    description: entry.blurb, foot: '',
  }))
  const detail = entries.find(entry => entry.key === ui.drill.pick)
  if (detail !== undefined) return renderDetail(ui, section, detail)
  renderEntries(ui, section, entries)
}

function renderSections(ui) {
  const grid = tileGrid()
  grid.className += ' dp-dex-sections'
  const off = offParts(ui.view).dexSections
  for (const section of SECTIONS) {
    if (off.has(section.key)) continue // 扩展关掉了（比如钓鱼）：这一页先不出现，收集记录保留
    const entries = ui.view.dex[section.key] ?? []
    const got = entries.filter(entry => entry.acquired).length
    const node = tile({
      emoji: section.emoji, label: section.label, color: section.color,
      note: entries.length === 0 ? '等待收录' : got + '/' + entries.length,
      data: { 'data-dex-section': section.key },
      onPick: function () { drillTo(ui, 'dex', section.key) },
    })
    const progress = el('span', 'dp-dex-progress')
    const fill = el('i')
    fill.style.width = (entries.length === 0 ? 0 : Math.round(got / entries.length * 100)) + '%'
    progress.appendChild(fill)
    node.appendChild(progress)
    grid.appendChild(node)
  }
  for (const section of ui.view.extDex ?? []) {
    const entries = section.entries ?? []
    const got = entries.filter(entry => entry.acquired).length
    const key = 'ext:' + section.extension + ':' + section.key
    const node = tile({ emoji: section.emoji, label: section.label, color: section.color || 'orange',
      note: got + '/' + entries.length, data: { 'data-dex-section': key },
      onPick: function () { drillTo(ui, 'dex', key) } })
    const progress = el('span', 'dp-dex-progress')
    const fill = el('i')
    fill.style.width = (entries.length === 0 ? 0 : Math.round(got / entries.length * 100)) + '%'
    progress.appendChild(fill); node.appendChild(progress); grid.appendChild(node)
  }
  ui.content.appendChild(grid)
}

function renderEntries(ui, section, entries) {
  const acquired = entries.filter(entry => entry.acquired).length
  drillHeader(ui, 'dex', section.emoji + ' ' + section.label, acquired + '/' + entries.length)
  if (entries.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '这一页还没有收录内容'))
    return
  }
  if (section.key === 'forms' || section.key === 'skins') renderFlashShelf(ui, section, entries)
  else if (section.key === 'items') renderCatalogue(ui, entries)
  else renderMuseum(ui, section, entries)
}

function renderFlashShelf(ui, section, entries) {
  const grid = el('div', 'dp-dex-flash-grid')
  for (const entry of entries) grid.appendChild(flashCard(ui, section, entry))
  ui.content.appendChild(grid)
}

function flashCard(ui, section, entry) {
  const classes = ['dp-dex-card']
  if (entry.acquired) classes.push('dp-dex-card-foil')
  else classes.push('dp-dex-card-locked')
  const card = button(classes.join(' '), { 'data-dex-entry': entry.key }, function () { openDetail(ui, entry.key) })
  const art = el('span', 'dp-dex-artbox')
  appendArt(art, entry, true)
  if (!entry.acquired) art.appendChild(el('span', 'dp-dex-lock', '🔒'))
  card.appendChild(art)
  card.appendChild(el('span', 'dp-dex-caption', entry.acquired ? entry.label : '未知' + section.label))
  if (entry.acquired) tilt(card)
  return card
}

function renderMuseum(ui, section, entries) {
  const grid = el('div', 'dp-dex-museum')
  for (const entry of entries) {
    const card = button('dp-dex-museum-item' + (entry.acquired ? '' : ' dp-dex-museum-locked'),
      { 'data-dex-entry': entry.key }, function () { openDetail(ui, entry.key) })
    const art = el('span', 'dp-dex-museum-art')
    appendArt(art, entry, false)
    if (!entry.acquired) art.appendChild(el('span', 'dp-dex-museum-lock', '🔒'))
    card.appendChild(art)
    card.appendChild(el('span', 'dp-dex-museum-name', entry.acquired ? entry.label : '未知' + section.label))
    grid.appendChild(card)
  }
  ui.content.appendChild(grid)
}

function renderCatalogue(ui, entries) {
  const controls = el('div', 'dp-dex-catalog-tools')
  const search = /** @type {HTMLInputElement} */ (el('input', 'dp-input dp-dex-search'))
  search.type = 'search'
  search.placeholder = '搜索已发现的道具'
  search.value = ui.drill.dexQuery ?? ''
  search.setAttribute('data-dex-search', 'items')
  controls.appendChild(search)
  const filters = el('div', 'dp-dex-filters')
  const active = ui.drill.dexFilter ?? 'all'
  const available = new Set(entries.map(entry => shelfOf(entry.kind)))
  for (const [key, label] of ITEM_KINDS) {
    if (key !== 'all' && !available.has(key)) continue
    const filter = button('dp-dex-filter', { 'data-dex-filter': key }, function () {
      ui.drill.dexFilter = key
      ui.drill.pick = null
      ui.renderContent()
    })
    filter.textContent = label
    filter.setAttribute('data-active', active === key ? 'true' : 'false')
    filters.appendChild(filter)
  }
  controls.appendChild(filters)
  ui.content.appendChild(controls)
  sideScroller(filters, filters.querySelector ? filters.querySelector('[data-active="true"]') : null)

  const query = String(ui.drill.dexQuery ?? '').trim().toLowerCase()
  const list = el('div', 'dp-dex-catalog')
  for (const entry of entries) {
    if (active !== 'all' && shelfOf(entry.kind) !== active) continue
    const searchable = entry.acquired ? entry.label.toLowerCase() : ('未知' + entry.kindLabel).toLowerCase()
    if (query !== '' && !searchable.includes(query)) continue
    list.appendChild(catalogueRow(ui, entry))
  }
  ui.content.appendChild(list)
  search.addEventListener('input', function () {
    ui.drill.dexQuery = search.value
    const needle = search.value.trim().toLowerCase()
    for (const row of list.children) {
      const hidden = needle !== '' && !String(row.getAttribute('data-search-text') ?? '').includes(needle)
      if (hidden) row.setAttribute('data-search-hidden', 'true')
      else row.removeAttribute('data-search-hidden')
    }
  })
}

function catalogueRow(ui, entry) {
  const row = button('dp-dex-row' + (entry.acquired ? '' : ' dp-dex-row-locked'),
    { 'data-dex-entry': entry.key, 'data-search-text': entry.acquired ? entry.label.toLowerCase() : ('未知' + entry.kindLabel).toLowerCase() },
    function () { openDetail(ui, entry.key) })
  row.appendChild(el('span', 'dp-dex-row-emoji', entry.acquired ? entry.emoji : '◆'))
  const copy = el('span', 'dp-dex-row-text')
  copy.appendChild(el('b', null, entry.acquired ? entry.label : '未知道具'))
  copy.appendChild(el('small', null, entry.kindLabel || '其他'))
  row.appendChild(copy)
  row.appendChild(el('span', 'dp-dex-row-count', entry.acquired ? '×' + entry.count : '🔒'))
  return row
}

function renderDetail(ui, section, entry) {
  const header = el('div', 'dp-drill')
  const back = button('dp-drill-back', { 'data-dex-detail-back': section.key }, function () {
    ui.drill.pick = null
    ui.renderContent()
    ui.content.scrollTop = 0
  })
  back.textContent = '‹'
  header.appendChild(back)
  header.appendChild(el('b', 'dp-drill-title', section.emoji + ' ' + section.label))
  header.appendChild(el('span', 'dp-drill-info', entry.acquired ? '已收录' : '未解锁'))
  ui.content.appendChild(header)

  const flash = section.key === 'forms' || section.key === 'skins'
  const wrap = el('div', 'dp-dex-detail')
  wrap.setAttribute('data-dex-detail', entry.key)
  const card = el('div', flash
    ? 'dp-dex-big' + (entry.acquired ? ' dp-dex-big-foil' : ' dp-dex-big-locked')
    : 'dp-dex-info' + (entry.acquired ? '' : ' dp-dex-info-locked'))
  const art = el('div', flash ? 'dp-dex-big-art' : 'dp-dex-info-art')
  appendArt(art, entry, flash)
  if (!entry.acquired) art.appendChild(el('span', 'dp-dex-lock', '🔒'))
  card.appendChild(art)
  card.appendChild(el('div', 'dp-dex-big-title', entry.acquired ? entry.emoji + ' ' + entry.label : '🔒 未知' + section.label))
  if (entry.acquired) {
    card.appendChild(el('div', 'dp-dex-story', entry.description || '这段故事还没有写进图鉴。'))
    if (typeof entry.foot === 'string') { if (entry.foot) card.appendChild(el('div', 'dp-dex-foot', entry.foot)) }
    else card.appendChild(el('div', 'dp-dex-foot', firstSeen(entry.firstAt) + ' · 获得 ' + entry.count + ' 次'
      + (typeof entry.maxSizeCm === 'number' ? ' · 最大 ' + entry.maxSizeCm.toFixed(1) + ' cm' : '')))
    if (section.key === 'skins') {
      const current = ui.view.skins.current === entry.key
      const pick = button('dp-mini', { 'data-dex-skin': entry.key }, function () { ui.send('skin', { skin: entry.key }) })
      pick.textContent = current ? '使用中' : '使用这款皮肤'
      pick.disabled = current
      const action = el('div', 'dp-dex-skin-action')
      action.appendChild(pick)
      card.appendChild(action)
    }
  } else {
    const riddle = el('div', 'dp-dex-riddle')
    riddle.appendChild(el('b', null, '解锁谜面'))
    riddle.appendChild(el('span', null, entry.hint || '它藏在一次尚未启程的相遇里。'))
    card.appendChild(riddle)
  }
  wrap.appendChild(card)
  ui.content.appendChild(wrap)
  if (flash && entry.acquired) tilt(card)
}

function openDetail(ui, key) {
  ui.drill.pick = key
  ui.renderContent()
  ui.content.scrollTop = 0
}

function appendArt(parent, entry, large) {
  if (entry.art) {
    const img = /** @type {HTMLImageElement} */ (el('img', 'dp-dex-art'))
    img.src = artSource(entry.art)
    img.alt = entry.acquired ? entry.label : ''
    parent.appendChild(img)
  } else {
    parent.appendChild(el('span', large ? 'dp-dex-emoji dp-dex-emoji-large' : 'dp-dex-emoji', entry.emoji))
  }
}

function firstSeen(value) {
  if (typeof value !== 'number') return '首次发现时间未知'
  return '首次发现 ' + new Date(value).toLocaleDateString('zh-CN')
}

function tilt(node) {
  node.addEventListener('pointermove', function (event) {
    const box = node.getBoundingClientRect()
    const x = ((event.clientX ?? box.left + box.width / 2) - box.left) / Math.max(1, box.width) - .5
    const y = ((event.clientY ?? box.top + box.height / 2) - box.top) / Math.max(1, box.height) - .5
    node.style.setProperty('--dex-rx', (-y * 5).toFixed(2) + 'deg')
    node.style.setProperty('--dex-ry', (x * 7).toFixed(2) + 'deg')
  })
  node.addEventListener('pointerleave', function () {
    node.style.removeProperty('--dex-rx')
    node.style.removeProperty('--dex-ry')
  })
}
