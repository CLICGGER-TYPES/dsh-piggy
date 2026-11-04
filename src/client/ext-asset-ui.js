// @ts-check
/**
 * 扩展卡片上的只读素材包摘要与试播/试听（M3 收尾）。
 *
 * `/state` 的 `extensions[].assetPacks` 只有计数和包名；这里只格式化展示，
 * 不改扩展开关、不写存档。试播/试听仍然走公开事件：
 * `dsh-piggy:action` / `dsh-piggy:sound`，detail.key 由动作/音效运行时给出。
 * @module dsh-piggy/client/ext-asset-ui
 */
import { button, el } from './dom.js'
import { arr, num, str } from './values.js'

/** @type {Record<string, string>} */
const EVENTS = { actions: 'dsh-piggy:action', sounds: 'dsh-piggy:sound' }

const GROUPS = [
  { kind: 'actions', label: '动作包', playLabel: '试播' },
  { kind: 'sounds', label: '音效包', playLabel: '试听' },
]

/** @param {any} pack */
function packName(pack) {
  return str(pack?.pack, '') || str(pack?.namespace, '')
}

/** @param {any} group */
function summaryText(group) {
  if (group.kind === 'actions') {
    return group.label + ' ' + group.count + ' 个 · ' + group.entries + ' 个动作 · ' + group.frames + ' 帧'
  }
  return group.label + ' ' + group.count + ' 个 · ' + group.entries + ' 条'
}

/** @param {any} group */
function namesText(group) {
  const shown = group.packs.slice(0, 3).map((/** @type {any} */ pack) => {
    const name = packName(pack)
    return !group.unavailable && pack.available === false ? name + '（不可用）' : name
  }).filter((/** @type {string} */ name) => name !== '')
  const more = group.packs.length - shown.length
  return shown.join(' · ') + (more > 0 ? ' +' + more : '')
}

/**
 * 一张卡片要展示的素材包分组。没有包、旧快照或坏字段都返回空数组。
 * @param {any} extension
 * @returns {any[]}
 */
export function assetPackGroups(extension) {
  if (extension === null || typeof extension !== 'object') return []
  const packs = extension.assetPacks
  if (packs === null || typeof packs !== 'object') return []
  const enabled = extension.on !== false
  const out = []
  for (const spec of GROUPS) {
    const list = arr(packs[spec.kind]).filter((/** @type {any} */ pack) => pack !== null && typeof pack === 'object')
    if (list.length === 0) continue
    const entries = list.reduce((sum, pack) => sum + num(pack.entries, 0), 0)
    const frames = spec.kind === 'actions' ? list.reduce((sum, pack) => sum + num(pack.frames, 0), 0) : 0
    const available = list.some(pack => pack.available !== false)
    out.push({
      kind: spec.kind,
      label: spec.label,
      playLabel: spec.playLabel,
      packs: list,
      count: list.length,
      entries: entries,
      frames: frames,
      summary: summaryText({ kind: spec.kind, label: spec.label, count: list.length, entries: entries, frames: frames }),
      playable: enabled && available,
      unavailable: !enabled || !available,
    })
  }
  return out
}

/**
 * Dispatch one public extension event. Missing DOM/CustomEvent is a no-op so
 * old shells and the node test harness never throw.
 * @param {string} type
 * @param {string} key
 */
export function dispatchExtensionEvent(type, key) {
  if (typeof document === 'undefined' || typeof document.dispatchEvent !== 'function') return false
  const detail = { key: key }
  /** @type {any} */
  let event
  try {
    event = typeof CustomEvent === 'function' ? new CustomEvent(type, { detail: detail }) : { type: type, detail: detail }
  } catch {
    event = { type: type, detail: detail }
  }
  try {
    document.dispatchEvent(event)
    return true
  } catch {
    return false
  }
}

/**
 * 试播/试听：取第一个可用包，让动作/音效运行时解析第一个 handle。
 * 失败静默，按钮本身不改变任何状态。
 * @param {any} ui
 * @param {any} extension
 * @param {any} group
 */
export function previewAssetPack(ui, extension, group) {
  if (extension === null || typeof extension !== 'object' || extension.on === false) return Promise.resolve('')
  const pack = group.packs.find((/** @type {any} */ item) => item.available !== false)
  if (pack === undefined) return Promise.resolve('')
  const runtime = ui?.extAssets?.[group.kind]
  if (runtime === null || typeof runtime !== 'object' || typeof runtime.previewKey !== 'function') return Promise.resolve('')
  return Promise.resolve(runtime.previewKey(extension, pack)).then((/** @type {any} */ key) => {
    if (typeof key !== 'string' || key === '') return ''
    dispatchExtensionEvent(EVENTS[group.kind], key)
    return key
  }).catch(() => '')
}

/**
 * 已安装扩展卡片里的素材包区域；没有素材包时返回 null，整块隐藏。
 * @param {any} ui
 * @param {any} extension
 */
export function renderAssetPacks(ui, extension) {
  const groups = assetPackGroups(extension)
  if (groups.length === 0) return null
  const box = el('div', 'dp-ext-assets')
  box.setAttribute('data-ext-assets', str(extension.key, ''))
  for (const group of groups) {
    const row = el('div', 'dp-ext-asset')
    row.setAttribute('data-ext-asset', group.kind)
    row.appendChild(el('span', 'dp-ext-asset-line', group.summary))
    if (group.unavailable) {
      row.appendChild(el('span', 'dp-ext-asset-off', '不可用'))
    } else if (group.playable) {
      const play = button('dp-mini dp-mini-plain dp-ext-asset-play', {
        'data-ext-asset-play': group.kind,
        'aria-label': group.playLabel + ' ' + str(extension.label, ''),
      }, function () { previewAssetPack(ui, extension, group) })
      play.textContent = group.playLabel
      row.appendChild(play)
    }
    const names = el('span', 'dp-ext-asset-packs', namesText(group))
    names.title = group.packs.map(packName).filter((/** @type {string} */ name) => name !== '').join(' · ')
    row.appendChild(names)
    box.appendChild(row)
  }
  return box
}
