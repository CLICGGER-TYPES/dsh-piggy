// @ts-check
/** DOM for the complete-owner-archive cloud preview and history. */
import { button, el } from './dom.js'

const IMPORTING = '正在保存并切换…'

/** @param {HTMLElement} parent @param {string} label @param {string} value */
function summaryRow(parent, label, value) {
  const row = el('div', 'dp-set-head')
  row.appendChild(el('b', null, label))
  row.appendChild(el('small', 'dp-dim', value))
  parent.appendChild(row)
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

function gardenSummary(garden) {
  if (!garden || typeof garden !== 'object') return '未包含菜园数据'
  const unlocked = count(garden.unlocked), planted = count(garden.planted)
  if (unlocked === null && planted === null) return '已包含菜园资料'
  return `已开垦 ${unlocked ?? '—'} 块 · 种植中 ${planted ?? '—'} 块`
}

/**
 * Same summary structure as the local complete-archive import preview.
 * @param {HTMLElement} box
 * @param {{preview:{summary:any,warnings:string[]}, acknowledgeWarnings:boolean, switching:boolean, busy:string,
 *   onToggleWarnings:(checked:boolean)=>void, onCancel:()=>void, onImport:()=>void}} options
 */
export function renderOwnerCloudPreview(box, options) {
  const { preview, acknowledgeWarnings, switching, busy } = options
  box.appendChild(el('b', 'dp-shelf', '云端完整档预览'))
  const summary = preview.summary ?? {}
  const pigs = Array.isArray(summary.pigs) ? summary.pigs : []
  const pigCount = count(summary.pigCount) ?? pigs.length
  const pigTitle = el('b', 'dp-set-head', `包含 ${pigCount} 只小猪`)
  box.appendChild(pigTitle)
  for (const [index, pig] of pigs.entries()) {
    const name = typeof pig?.name === 'string' && pig.name.trim() ? pig.name : `小猪 ${index + 1}`
    const details = []
    const ageMs = typeof pig?.ageMs === 'number' && Number.isFinite(pig.ageMs) && pig.ageMs >= 0 ? pig.ageMs : null
    const xp = count(pig?.xp)
    const weight = typeof pig?.weightG === 'number' && Number.isFinite(pig.weightG) && pig.weightG >= 0 ? pig.weightG : null
    if (ageMs !== null) details.push(`成长 ${(ageMs / 86_400_000).toFixed(1)} 天`)
    if (xp !== null) details.push(`经验 ${xp}`)
    if (weight !== null) details.push(`体重 ${weight} 克`)
    if (count(pig?.wornCount) !== null) details.push(`穿戴 ${pig.wornCount} 件`)
    summaryRow(box, name, details.length ? details.join(' · ') : '包含独立成长与数值')
  }
  if (pigCount > pigs.length) box.appendChild(el('p', 'dp-dim', `列表显示前 ${pigs.length} 只；其余 ${pigCount - pigs.length} 只也包含在完整档中。`))
  box.appendChild(el('b', 'dp-set-head', '共享资产'))
  const shared = summary.shared ?? {}
  const coins = typeof shared.coins === 'number' && Number.isFinite(shared.coins)
    ? new Intl.NumberFormat('zh-CN').format(shared.coins) : '未记录'
  summaryRow(box, '金币', coins)
  const inventoryCount = count(shared.inventoryCount)
  summaryRow(box, '背包', inventoryCount === null ? '未记录' : `${inventoryCount} 件物品`)
  summaryRow(box, '菜园', gardenSummary(shared.garden))
  box.appendChild(el('p', 'dp-dim', '本机显示与声音偏好保留在此设备，不随云端存档覆盖。'))
  box.appendChild(el('p', 'dp-dim', '恢复会建立独立存档副本并切换到新副本；当前存档保留，完成后应用会重启。'))
  for (const warning of preview.warnings) {
    box.appendChild(el('div', 'dp-alert dp-legacy', warning))
  }
  if (preview.warnings.length > 0) {
    const label = el('label', 'dp-dim')
    const check = /** @type {HTMLInputElement} */ (el('input'))
    check.type = 'checkbox'
    check.style.cssText = 'width:auto;margin:0 6px 0 0;accent-color:var(--animal-primary)'
    check.checked = acknowledgeWarnings
    check.disabled = switching || busy !== ''
    check.setAttribute('data-owner-cloud-warnings', 'true')
    check.addEventListener('change', () => {
      options.onToggleWarnings(check.checked === true)
    })
    label.appendChild(check)
    label.appendChild(el('span', null, '我已阅读提示，仍要恢复'))
    box.appendChild(label)
  }

  const actions = el('div', 'dp-actions')
  const cancel = button('dp-btn', { 'data-owner-cloud-preview-cancel': 'true' }, () => { options.onCancel() })
  cancel.textContent = '取消'
  cancel.disabled = switching || busy !== ''
  actions.appendChild(cancel)
  const confirm = button('dp-mini', { 'data-owner-cloud-import': 'true' }, () => { options.onImport() })
  confirm.textContent = switching || busy === 'import' ? IMPORTING : '恢复并切换'
  confirm.disabled = switching || busy !== '' ||
    (preview.warnings.length > 0 && !acknowledgeWarnings)
  actions.appendChild(confirm)
  box.appendChild(actions)
}

function shortHash(value) {
  return typeof value === 'string' && value !== '' ? value.slice(0, 7) : '未记录'
}

function shortTime(value) {
  if (typeof value !== 'string' || value === '') return '未记录'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '未记录'
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Read-only history: the host has no per-commit restore route, so rows have no action.
 * @param {HTMLElement} box
 * @param {{ok:boolean, manual?:any, auto?:any[], reason?:string}|null} history
 */
export function renderOwnerCloudHistory(box, history) {
  box.appendChild(el('b', 'dp-shelf', '云端历史'))
  if (history === null) {
    box.appendChild(el('p', 'dp-dim', '正在读取云端历史…'))
    return
  }
  if (history.ok !== true) {
    box.appendChild(el('p', 'dp-dim', history.reason || '云端历史暂时无法读取'))
    return
  }
  const items = []
  if (history.manual) items.push(history.manual)
  for (const item of history.auto ?? []) items.push(item)
  if (items.length === 0) {
    box.appendChild(el('p', 'dp-dim', '云端还没有可显示的存档历史'))
    return
  }
  const list = el('div', 'dp-list')
  for (const item of items) {
    const row = el('div', 'dp-item')
    row.setAttribute('data-owner-cloud-history', 'true')
    const grow = el('div', 'dp-grow')
    grow.appendChild(el('div', null, item.subject || '未命名存档'))
    grow.appendChild(el('div', 'dp-dim', `${shortTime(item.at)} · ${shortHash(item.hash)}`))
    row.appendChild(grow)
    if (item.manual) row.appendChild(el('span', 'dp-dim', '手动'))
    list.appendChild(row)
  }
  box.appendChild(list)
}
