// @ts-check
/**
 * 设置页「最近投递」：最近 7 天按来源聚合的只读收据。
 *
 * 旧外壳没有 workEventSources、主进程读取失败、或 worker 返回失败时整块隐藏；
 * 只有明确拿到空列表才显示「还没有 agent 投递」。这里不提供停用、删除或点击操作。
 * 面板每 4 秒重绘一次，所以结果按 API 缓存 10 秒；相对时间每次重绘重新算。
 */
import { el } from './dom.js'

const REFRESH_MS = 10_000
const MAX_TYPES = 2

/** 每个 workEventSources 函数一份缓存；不跨窗口共用。 */
const states = new WeakMap()

/**
 * 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前。
 * @param {number} lastAt
 * @param {number} [now]
 */
export function relativeTime(lastAt, now = Date.now()) {
  if (!Number.isFinite(lastAt) || !Number.isFinite(now)) return ''
  const minutes = Math.floor(Math.max(0, now - lastAt) / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

/**
 * 主要类型按条数从多到少，最多两个；同数按名称排，结果稳定。
 * @param {Record<string, number> | null | undefined} types
 * @param {number} [limit]
 * @returns {Array<[string, number]>}
 */
export function topTypes(types, limit = MAX_TYPES) {
  if (types === null || typeof types !== 'object') return []
  /** @type {Array<[string, number]>} */
  const entries = []
  for (const name of Object.keys(types)) {
    const count = types[name]
    if (name === '' || !Number.isInteger(count) || count <= 0) continue
    entries.push([name, count])
  }
  return entries
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
}

/** 只渲染主进程已经校验过的形状；坏行跳过。 */
function accept(value) {
  if (value === null || typeof value !== 'object' || value.ok !== true || !Array.isArray(value.sources)) return null
  const sources = []
  for (const entry of value.sources) {
    if (entry === null || typeof entry !== 'object') continue
    if (typeof entry.source !== 'string' || entry.source === '') continue
    if (!Number.isFinite(entry.lastAt) || !Number.isInteger(entry.count) || entry.count <= 0) continue
    sources.push({
      source: entry.source,
      count: entry.count,
      lastAt: entry.lastAt,
      types: entry.types !== null && typeof entry.types === 'object' ? entry.types : {},
    })
  }
  return sources
}

function redraw(state) {
  if (state.ui?.tab === 'settings') state.ui.renderContent()
}

function load(state, api) {
  state.loading = true
  Promise.resolve()
    .then(() => api())
    .then(value => {
      const sources = accept(value)
      state.failed = sources === null
      state.sources = sources ?? []
      state.loadedAt = Date.now()
    })
    .catch(() => {
      state.failed = true
      state.sources = []
      state.loadedAt = Date.now()
    })
    .finally(() => {
      state.loading = false
      redraw(state)
    })
}

function metaText(entry) {
  const parts = [`${entry.count} 条`]
  const types = topTypes(entry.types)
  if (types.length > 0) parts.push(types.map(([name, count]) => `${name} ${count}`).join(' · '))
  return parts.join(' · ')
}

function renderBlock(box, sources) {
  const block = el('div', 'dp-work-sources')
  block.setAttribute('data-work-sources', 'true')
  const head = el('div', 'dp-work-sources-head')
  head.appendChild(el('b', null, '最近投递'))
  head.appendChild(el('small', null, '最近 7 天'))
  block.appendChild(head)
  if (sources.length === 0) {
    block.appendChild(el('small', 'dp-work-sources-empty', '还没有 agent 投递'))
    box.appendChild(block)
    return
  }
  const list = el('div', 'dp-work-sources-list')
  for (const entry of sources) {
    const row = el('div', 'dp-work-source')
    row.setAttribute('data-work-source', entry.source)
    const name = el('div', 'dp-work-source-name')
    name.appendChild(el('b', null, entry.source))
    name.appendChild(el('small', null, relativeTime(entry.lastAt)))
    row.appendChild(name)
    row.appendChild(el('small', 'dp-work-source-meta', metaText(entry)))
    list.appendChild(row)
  }
  block.appendChild(list)
  box.appendChild(block)
}

/**
 * 在「外部连接」卡片底部追加最近投递；没有可用 API 或读取失败时不追加任何节点。
 * @param {any} ui
 * @param {any} box
 * @param {(() => Promise<any>) | null | undefined} api
 */
export function renderWorkSources(ui, box, api) {
  if (typeof api !== 'function') return
  let state = states.get(api)
  if (state === undefined) {
    state = { ui, sources: [], failed: false, loadedAt: 0, loading: false }
    states.set(api, state)
  }
  state.ui = ui
  if (!state.loading && Date.now() - state.loadedAt >= REFRESH_MS) load(state, api)
  if (state.failed || state.loadedAt === 0) return
  renderBlock(box, state.sources)
}
