// @ts-check
/**
 * 合并预览（设计 4.5）：结果摘要、四组身份选择、扩展冲突二选一、副本警告、备份说明。
 *
 * 预览数字全部来自桌面端；这里只负责显示和把用户的选择整理好。
 * 「改…」只在桌面端给了可选项时出现；没给就只让用户整组跟一边，不假装能改。
 * @module dsh-piggy/client/external-preview
 */
import { button, el } from './dom.js'
import { NAME_MAX, formatNumber, pigKind, reasonText, sideKnown, sideValues, validateChoices } from './external-rules.js'
import { actions, checkList, choiceRow, field, heading, note, row, select } from './external-ui.js'

const GROUPS = [
  { key: 'look', label: '样子', fields: ['form', 'skin', 'worn'] },
  { key: 'personality', label: '性格', fields: ['personality', 'catchphrase', 'motto', 'birthday'] },
  { key: 'preferences', label: '偏好', fields: ['ownerName', 'quiet', 'isOfflineFeedEnabled', 'timeScale', 'spot'] },
]

const pickLabel = (group, pick) => (pick === 'source' ? '跟内嵌猪' : pick === 'custom' ? '自己改' : '跟桌宠')

/** 后端 `editors` 里的候选本身带中文 label；找不到时返回空串，由调用方用通用描述。 */
function labelOf(list, key) {
  if (!Array.isArray(list)) return ''
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue
    if (String(entry.key ?? '') !== key) continue
    return typeof entry.label === 'string' ? entry.label : ''
  }
  return ''
}

/** 内置字典的 label 不会等于技术 key；相等说明后端只回填了 key，按没字典处理。 */
function knownLabel(list, key) {
  const label = labelOf(list, key)
  return label !== key ? label : ''
}

/** 把选中的一边显示成中文；技术 key 只在确实没有字典时换成通用描述。 */
export function lookLine(preview, values) {
  const editors = preview.editors ?? {}
  const parts = []
  if (values.form !== '') {
    const label = knownLabel(editors.look?.form, values.form)
    parts.push(label === '' ? '形态未知' : '形态 ' + label)
  }
  if (values.skin !== '') {
    // 自定义皮肤的名字就是玩家起的 label，不能因为不在内置字典里就丢掉。
    const label = labelOf(editors.look?.skin, values.skin)
    const skin = label !== '' ? label : values.skin === 'default' ? '默认' : ''
    parts.push(skin === '' ? '皮肤未知' : '皮肤 ' + skin)
  }
  if (values.worn.length > 0) parts.push('穿戴 ' + values.worn.map(key => knownLabel(editors.look?.worn, key) || '未知装扮').join('、'))
  return parts.length === 0 ? '默认样子' : parts.join(' · ')
}

export function personalityLine(preview, values) {
  const parts = []
  if (values.personality !== '') parts.push(knownLabel(preview.editors?.personality?.personality, values.personality) || '未知性格')
  if (values.catchphrase !== '') parts.push('「' + values.catchphrase + '」')
  if (values.birthday !== '') parts.push('生日 ' + values.birthday)
  return parts.length === 0 ? '默认性格' : parts.join(' · ')
}

export function preferenceLine(preview, values) {
  const parts = []
  if (values.ownerName !== '') parts.push('称呼 ' + values.ownerName)
  parts.push('免打扰' + (values.quiet ? '开' : '关'))
  parts.push('离线喂食' + (values.isOfflineFeedEnabled === false ? '关' : '开'))
  parts.push('×' + values.timeScale)
  if (values.spot !== '') parts.push('钓点 ' + (knownLabel(preview.editors?.preferences?.spot, values.spot) || '未知'))
  return parts.join(' · ')
}

function optionsOf(list) {
  return Array.isArray(list) ? list.map(entry => (typeof entry === 'string' ? { key: entry, label: entry } : { key: String(entry?.key ?? ''), label: String(entry?.label ?? entry?.key ?? '') })).filter(option => option.key !== '') : []
}

function canEdit(preview, group) {
  const editors = preview.editors ?? {}
  const hasLists = group === 'look'
    ? optionsOf(editors.look?.form).length > 0 || optionsOf(editors.look?.skin).length > 0 || optionsOf(editors.look?.worn).length > 0
    : group === 'personality'
      ? optionsOf(editors.personality?.personality).length > 0
      : optionsOf(editors.preferences?.spot).length > 0
  // 契约暂时没给候选表，但 choices[].editable 说明了可改字段；
  // 这时用文本输入，让后端按真实数据校验，不假装有下拉候选。
  const choice = preview.choices.find(entry => entry.key === group)
  return hasLists || (choice !== undefined && choice.editable.length > 0)
}

function sideLine(preview, group, pick) {
  const side = pick === 'source' ? 'source' : 'target'
  const values = sideValues(preview, side)
  if (!sideKnown(preview, side)) return pick === 'source' ? '跟内嵌猪' : '跟桌宠'
  if (group === 'name') return values.name === '' ? '未命名' : values.name
  if (group === 'look') return lookLine(preview, values)
  return group === 'personality' ? personalityLine(preview, values) : preferenceLine(preview, values)
}

function errorFor(errors, group) {
  return Object.keys(errors).filter(key => group === 'look' ? key === 'look' : group === 'personality' ? key === 'personality' : key === 'preferences').map(key => errors[key])[0] ?? ''
}

/** 三选一 + 「改…」入口；选边会丢弃自定义值（4.5）。 */
function pickerGroup(dialog, state, handlers, preview, group, label) {
  const choices = state.choices[group]
  const wrap = el('div', 'dp-ext-group')
  const head = el('div', 'dp-ext-group-head')
  head.appendChild(el('b', null, label))
  head.appendChild(el('small', 'dp-dim', choices.pick === 'custom' ? '自己改' : sideLine(preview, group, choices.pick)))
  const editable = canEdit(preview, group)
  if (editable) {
    const edit = button('dp-mini' + (choices.pick === 'custom' ? '' : ' dp-mini-plain'), { 'data-external-edit': group, 'aria-pressed': String(choices.pick === 'custom') }, function () {
      if (choices.pick !== 'custom') {
        const from = sideValues(preview, choices.pick)
        for (const key of GROUPS.find(entry => entry.key === group).fields) choices[key] = from[key]
        choices.pick = 'custom'
      } else {
        choices.pick = 'target'
      }
      handlers.refresh()
    })
    edit.textContent = '改…'
    head.appendChild(edit)
  }
  wrap.appendChild(head)
  const line = el('div', 'dp-ext-inline')
  for (const pick of ['target', 'source']) {
    choiceRow(line, {
      key: pick, label: pick === 'target' ? '跟桌宠' : '跟内嵌猪', checked: choices.pick === pick,
      onPick: () => { choices.pick = pick; handlers.refresh() },
    })
  }
  wrap.appendChild(line)
  if (choices.pick === 'custom') renderEditor(wrap, preview, state, handlers, group)
  const error = errorFor(validateChoices(preview, state.choices).errors, group)
  const flag = el('span', 'dp-ext-flag', error)
  flag.setAttribute('data-external-flag-for', group)
  wrap.appendChild(flag)
  dialog.appendChild(wrap)
}

function renderEditor(wrap, preview, state, handlers, group) {
  const choices = state.choices[group]
  const editors = preview.editors ?? {}
  if (group === 'look') {
    const forms = optionsOf(editors.look?.form)
    const skins = optionsOf(editors.look?.skin)
    const wornOptions = optionsOf(editors.look?.worn)
    if (forms.length > 0) select(wrap, { key: 'form', label: '形态', value: choices.form, options: forms, onChange: value => { choices.form = value; handlers.refresh() } })
    else field(wrap, { key: 'form', label: '形态 key（留空＝默认形态）', value: choices.form, onInput: value => { choices.form = value; handlers.sync?.() } })
    if (skins.length > 0) select(wrap, { key: 'skin', label: '皮肤', value: choices.skin, options: skins, onChange: value => { choices.skin = value; handlers.refresh() } })
    else field(wrap, { key: 'skin', label: '皮肤 key（默认 default）', value: choices.skin, onInput: value => { choices.skin = value; handlers.sync?.() } })
    if (wornOptions.length > 0) {
      checkList(wrap, {
        label: '穿戴', value: choices.worn, options: wornOptions,
        onToggle: key => {
          choices.worn = choices.worn.includes(key) ? choices.worn.filter(entry => entry !== key) : choices.worn.concat([key])
          handlers.refresh()
        },
      })
    } else {
      field(wrap, {
        key: 'worn', label: '穿戴 key（逗号分隔，留空＝不穿）', value: choices.wornText ?? choices.worn.join(','),
        onInput: value => { choices.wornText = value; choices.worn = value.split(',').map(entry => entry.trim()).filter(Boolean); handlers.sync?.() },
      })
    }
    return
  }
  if (group === 'personality') {
    const people = optionsOf(editors.personality?.personality)
    if (people.length > 0) select(wrap, { key: 'personality', label: '性格', value: choices.personality, options: people, onChange: value => { choices.personality = value; handlers.refresh() } })
    else field(wrap, { key: 'personality', label: '性格 key', value: choices.personality, onInput: value => { choices.personality = value; handlers.sync?.() } })
    field(wrap, { key: 'catchphrase', label: '口头禅（最多 6 字）', value: choices.catchphrase, maxLength: 6, onInput: value => { choices.catchphrase = value; handlers.sync?.() } })
    field(wrap, { key: 'motto', label: '签名（最多 24 字）', value: choices.motto, maxLength: 24, onInput: value => { choices.motto = value; handlers.sync?.() } })
    field(wrap, { key: 'birthday', label: '生日（月/日）', value: choices.birthday, onInput: value => { choices.birthday = value; handlers.sync?.() } })
    return
  }
  field(wrap, { key: 'ownerName', label: '称呼（最多 12 字）', value: choices.ownerName, maxLength: 12, onInput: value => { choices.ownerName = value; handlers.sync?.() } })
  const quiet = choiceRow(wrap, { key: 'quiet', label: '免打扰', note: choices.quiet ? '开' : '关', checked: choices.quiet, onPick: () => { choices.quiet = !choices.quiet; handlers.refresh() } })
  quiet.setAttribute('data-external-check', 'quiet')
  const feed = choiceRow(wrap, { key: 'offlineFeed', label: '离线喂食', note: choices.isOfflineFeedEnabled ? '开' : '关', checked: choices.isOfflineFeedEnabled, onPick: () => { choices.isOfflineFeedEnabled = !choices.isOfflineFeedEnabled; handlers.refresh() } })
  feed.setAttribute('data-external-check', 'offlineFeed')
  field(wrap, { key: 'timeScale', label: '时间倍率（0–365）', value: String(choices.timeScale), type: 'number', min: 0, max: 365, onInput: value => { choices.timeScale = Number(value); handlers.sync?.() } })
  const spots = optionsOf(editors.preferences?.spot)
  if (spots.length > 0) select(wrap, { key: 'spot', label: '钓点', value: choices.spot, options: spots, onChange: value => { choices.spot = value; handlers.refresh() } })
  else field(wrap, { key: 'spot', label: '钓点 key', value: choices.spot, onInput: value => { choices.spot = value; handlers.sync?.() } })
}

/** 名字组：桌宠 / 内嵌猪 / 自己改（1-16 字，实时字数）。 */
function nameGroup(dialog, state, handlers, preview) {
  const choices = state.choices.name
  const wrap = el('div', 'dp-ext-group')
  const head = el('div', 'dp-ext-group-head')
  head.appendChild(el('b', null, '名字'))
  wrap.appendChild(head)
  const line = el('div', 'dp-ext-inline')
  for (const pick of ['target', 'source', 'custom']) {
    choiceRow(line, {
      key: pick, label: pick === 'target' ? '跟桌宠' : pick === 'source' ? '跟内嵌猪' : '自己改',
      checked: choices.pick === pick,
      onPick: () => {
        choices.pick = pick
        if (pick !== 'custom') choices.value = sideValues(preview, pick).name
        handlers.refresh()
      },
    })
  }
  wrap.appendChild(line)
  if (choices.pick === 'custom') {
    field(wrap, { key: 'name', label: '名字', value: choices.value, maxLength: NAME_MAX, onInput: value => { choices.value = value; handlers.sync?.() } })
  }
  const flag = el('span', 'dp-ext-flag', validateChoices(preview, state.choices).errors.name ?? '')
  flag.setAttribute('data-external-flag-for', 'name')
  wrap.appendChild(flag)
  dialog.appendChild(wrap)
}

function conflictGroup(dialog, state, handlers, conflict) {
  const wrap = el('div', 'dp-ext-group')
  wrap.setAttribute('data-external-conflict', conflict.key)
  const head = el('div', 'dp-ext-group-head')
  head.appendChild(el('b', null, '扩展「' + conflict.label + '」'))
  head.appendChild(el('small', 'dp-dim', conflict.message === '' ? '两边都有记录' : conflict.message))
  wrap.appendChild(head)
  const line = el('div', 'dp-ext-inline')
  for (const pick of conflict.options.length > 0 ? conflict.options : ['target', 'source']) {
    choiceRow(line, {
      key: pick, label: pick === 'target' ? '保留桌宠' : '用内嵌猪', checked: state.choices.conflicts[conflict.key] === pick,
      onPick: () => { state.choices.conflicts[conflict.key] = pick; handlers.refresh() },
    })
  }
  wrap.appendChild(line)
  dialog.appendChild(wrap)
}

function unknownSourceGroup(dialog, state, handlers, conflict) {
  const wrap = el('div', 'dp-ext-group')
  wrap.setAttribute('data-external-unknown-source', 'true')
  wrap.appendChild(el('b', 'dp-ext-group-head', '内嵌存档有当前版本不认识的字段'))
  note(wrap, (conflict.message === '' ? '这些字段在新版里没有对应的合并规则；丢弃会把它们从合并结果里去掉，中止则不做这次合并。' : conflict.message), true)
  if (conflict.paths.length > 0) note(wrap, '字段：' + conflict.paths.join('、'))
  const line = el('div', 'dp-ext-inline')
  for (const option of conflict.options.length > 0 ? conflict.options : ['discard', 'abort']) {
    choiceRow(line, {
      key: option, label: option === 'discard' ? '丢弃这些字段' : option === 'abort' ? '中止合并' : option,
      checked: state.choices.unknownSource === option,
      onPick: () => { state.choices.unknownSource = option; handlers.refresh() },
    })
  }
  wrap.appendChild(line)
  dialog.appendChild(wrap)
}

function duplicateGroup(dialog, state, handlers, preview) {
  const wrap = el('div', 'dp-ext-group')
  wrap.setAttribute('data-external-duplicate', 'true')
  wrap.appendChild(el('b', 'dp-ext-group-head', '疑似同一份存档的副本'))
  note(wrap, '这两只猪看起来是同一份存档的副本。合并会把两边的金币、物品和徽章相加，可能出现重复的资产。建议只保留一边，不要相加。', true)
  const line = el('div', 'dp-ext-inline')
  for (const pick of ['target', 'source', 'merge']) {
    choiceRow(line, {
      key: pick,
      label: pick === 'target' ? '只保留桌宠' : pick === 'source' ? '只保留内嵌猪' : '仍然合并',
      checked: state.choices.duplicate === pick,
      onPick: () => { state.choices.duplicate = pick; handlers.refresh() },
    })
  }
  wrap.appendChild(line)
  dialog.appendChild(wrap)
}

function backupNote(dialog, preview) {
  dialog.appendChild(el('p', 'dp-ext-note', '合并前分别备份两只猪；只保留最新一份合并备份。手动备份不会被清理。'))
  dialog.appendChild(el('p', 'dp-ext-note', '合并后内嵌猪收进备份并退役，不再长大。'))
  const names = preview.backups ?? {}
  if (typeof names.target === 'string' && names.target !== '') row(dialog, '桌面备份', names.target)
  if (typeof names.source === 'string' && names.source !== '') row(dialog, '内嵌备份', names.source)
  if (preview.sourceBackup !== '') row(dialog, '内嵌备份', preview.sourceBackup)
}

/** 画整个预览页。 */
export function renderPreview(dialog, state, handlers) {
  const preview = state.preview
  if (preview === null) { heading(dialog, '合并预览'); note(dialog, '还没拿到预览，请重新连接。', true); actions(dialog, [{ key: 'preview-close', label: '关闭', onPick: handlers.close }]); return }
  heading(dialog, mergeTitle(state.status))
  if (preview.expiresAt > 0) {
    const left = Math.max(0, Math.round((preview.expiresAt - Date.now()) / 1000))
    note(dialog, '预览 ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + ' 后过期；过期会自动取消并恢复内嵌猪。')
  }
  const result = preview.result
  const resultNode = el('span', 'dp-ext-result', result.name === '' ? '合并后：—' : '合并后：' + result.name)
  resultNode.appendChild(el('small', null,
    'Lv.' + result.level + ' · ' + result.days + ' 天 · 🪙' + formatNumber(result.coins)
    + ' · 🎒' + result.items + ' · 🏅' + result.badges))
  dialog.appendChild(resultNode)

  nameGroup(dialog, state, handlers, preview)
  pickerGroup(dialog, state, handlers, preview, 'look', '样子')
  pickerGroup(dialog, state, handlers, preview, 'personality', '性格')
  pickerGroup(dialog, state, handlers, preview, 'preferences', '偏好')

  const unknownConflict = preview.conflicts.find(conflict => conflict.key === 'unknownSource')
  if (preview.conflicts.length > 0) {
    dialog.appendChild(el('b', 'dp-ext-group-head', '需要你决定'))
    for (const conflict of preview.conflicts) {
      if (conflict.key === 'unknownSource') continue
      if (conflict.level === 'warning') note(dialog, conflict.label + '：' + conflict.message, true)
      else conflictGroup(dialog, state, handlers, conflict)
    }
  }
  if (unknownConflict !== undefined) unknownSourceGroup(dialog, state, handlers, unknownConflict)
  if (preview.duplicate !== null) duplicateGroup(dialog, state, handlers, preview)

  if (preview.autoMerge.length > 0) {
    dialog.appendChild(el('b', 'dp-ext-group-head', '自动合并'))
    const list = el('ul', 'dp-ext-list')
    for (const line of preview.autoMerge.slice(0, 20)) list.appendChild(el('li', null, line))
    dialog.appendChild(list)
  }
  if (result.newBadges + result.newDex + result.newDiary > 0) {
    note(dialog, '徽章新增 ' + result.newBadges + ' 枚；图鉴新增 ' + result.newDex + ' 种；日记新增 ' + result.newDiary + ' 篇。')
  }
  for (const warning of preview.warnings) note(dialog, warning, true)
  if (validateChoices(preview, state.choices).errors.unknownSource !== undefined && unknownConflict === undefined) {
    note(dialog, validateChoices(preview, state.choices).errors.unknownSource, true)
  }
  if (state.error !== '') note(dialog, reasonText(state.error), true)
  backupNote(dialog, preview)
  const submitted = el('button', 'dp-mini', actionsLabel(state))
  submitted.setAttribute('data-external-submit', 'true')
  submitted.disabled = !validateChoices(preview, state.choices).ok || state.busy === true
  handlers.sync = function syncValidity() {
    const found = validateChoices(preview, state.choices)
    submitted.disabled = !found.ok || state.busy === true
    for (const key of ['name', 'look', 'personality', 'preferences']) {
      const node = dialog.querySelector?.('[data-external-flag-for="' + key + '"]')
      if (node) node.textContent = found.errors[key] ?? ''
    }
  }
  submitted.addEventListener('click', function (event) { event.stopPropagation(); handlers.submit() })
  const cancel = el('button', 'dp-btn', '取消')
  cancel.setAttribute('data-external-action', 'preview-cancel')
  cancel.addEventListener('click', function (event) { event.stopPropagation(); handlers.cancelPreview() })
  const grid = el('div', 'dp-actions dp-ext-actions')
  grid.appendChild(cancel)
  grid.appendChild(submitted)
  dialog.appendChild(grid)
}

function actionsLabel(state) {
  if (state.busy) return '正在提交…'
  return state.preview !== null && pigKind(state.status?.local) === 'alive' && pigKind(state.status?.target) !== 'alive' ? '开始搬' : '开始合并'
}

function mergeTitle(status) {
  return pigKind(status?.local) === 'alive' && pigKind(status?.target) !== 'alive' ? '搬到桌宠' : '合并预览'
}
