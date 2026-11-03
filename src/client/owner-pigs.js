// @ts-check
/** Desktop-only local owner pig roster controls. */
import { button, el } from './dom.js'
import { desktopShell } from './desktop-shell.js'

/** @typedef {{ok?:boolean, available?:boolean, mode?:string, activePigId?:string, reason?:string}} OwnerPigStatus */
/** @typedef {{pigId:string, name?:unknown, hatched?:unknown, dead?:unknown, stage?:unknown, selected?:unknown}} OwnerPigEntry */
/** @typedef {{ok:boolean, pigs?:OwnerPigEntry[], reason?:string}} OwnerPigRoster */

const STAGE_LABELS = Object.freeze({ box: '纸盒', piglet: '幼年猪', young: '青年猪', middle: '成年猪' })
const LOADING_STATUS = '正在读取本机小猪…'
const LOADING_ROSTER = '正在读取小猪列表…'
const UNAVAILABLE = '本机多猪管理暂不可用'
const SAVE_SWITCH = '正在保存并切换…'
const SAVE_RESTART = '正在保存并重启…'

const state = {
  /** @type {OwnerPigStatus|null} */
  status: null,
  /** @type {Promise<OwnerPigStatus>|null} */
  statusPromise: null,
  /** @type {OwnerPigRoster|null} */
  roster: null,
  /** @type {Promise<OwnerPigRoster>|null} */
  rosterPromise: null,
  /** @type {''|'select'|'add'} */
  busy: '',
  /** @type {string|null} */
  busyPigId: null,
  restarting: false,
  /** @type {string} */
  restartText: '',
  /** @type {string} */
  error: '',
  /** @type {any} */
  ui: null,
  generation: 0,
}

/** The panel bridge exposes ownerPigs only in the desktop shell; DSH has no roster. */
function ownerPigsApi() {
  const api = desktopShell()?.ownerPigs
  return api !== null && typeof api === 'object' &&
    typeof api.status === 'function' && typeof api.list === 'function' &&
    typeof api.select === 'function' && typeof api.addAndSelect === 'function' ? api : null
}

function rerender() {
  state.ui?.renderContent?.()
}

/** Keep IPC failures short enough for one settings row. */
function messageOf(error, fallback) {
  const message = error instanceof Error ? error.message : ''
  return message !== '' && message.length <= 200 ? message : fallback
}

function reasonOf(result) {
  return typeof result?.reason === 'string' && result.reason !== '' ? result.reason : '请稍后重试'
}

function normalizeStatus(result) {
  if (result?.ok === true && result.available === true) return result
  return {
    ok: false,
    available: false,
    mode: typeof result?.mode === 'string' ? result.mode : 'owner',
    reason: typeof result?.reason === 'string' && result.reason !== '' ? result.reason : UNAVAILABLE,
  }
}

/** Cache the status: the panel repaints every few seconds and must not refetch it each time. */
async function requestStatus(ui) {
  if (state.statusPromise !== null) return
  const api = ownerPigsApi()
  if (api === null) return
  const generation = state.generation
  const promise = (async () => {
    try {
      return normalizeStatus(await api.status())
    } catch (error) {
      return normalizeStatus({ ok: false, reason: messageOf(error, UNAVAILABLE) })
    }
  })()
  state.statusPromise = promise
  const status = await promise
  if (state.statusPromise === promise) state.statusPromise = null
  if (generation !== state.generation || state.restarting) return
  state.status = status
  if (state.ui === ui) rerender()
}

/** The roster is cached for the same reason; a failed read stays visible until retry. */
async function requestRoster(ui) {
  if (state.rosterPromise !== null || state.restarting) return
  const api = ownerPigsApi()
  if (api === null) return
  const generation = state.generation
  const promise = (async () => {
    try {
      const result = await api.list()
      if (result?.ok !== true) return { ok: false, reason: reasonOf(result) }
      if (!Array.isArray(result.pigs)) return { ok: false, reason: '小猪列表格式不正确' }
      const pigs = result.pigs.filter(pig => pig !== null && typeof pig === 'object' && typeof pig.pigId === 'string')
      if (pigs.length === 0) return { ok: false, reason: '当前完整存档没有可用的小猪' }
      return { ok: true, pigs }
    } catch (error) {
      return { ok: false, reason: messageOf(error, '小猪列表读取失败') }
    }
  })()
  state.rosterPromise = promise
  const roster = await promise
  if (state.rosterPromise === promise) state.rosterPromise = null
  if (generation !== state.generation || state.restarting) return
  state.roster = roster
  if (state.ui === ui) rerender()
}

/** Drop both caches so the next paint asks the host again. */
function retry(ui) {
  state.generation += 1
  state.status = null
  state.roster = null
  state.statusPromise = null
  state.rosterPromise = null
  state.error = ''
  if (state.ui === ui) rerender()
}

/** Restarting is terminal for this page: never poll the host that is shutting down. */
function enterRestarting(ui, text) {
  state.restarting = true
  state.restartText = text
  state.busy = ''
  state.busyPigId = null
  state.error = ''
  state.status = null
  state.roster = null
  state.generation += 1
  if (state.ui === ui) rerender()
}

async function selectPig(ui, pigId) {
  if (state.busy !== '' || state.restarting) return
  const api = ownerPigsApi()
  if (api === null) return
  state.busy = 'select'
  state.busyPigId = pigId
  state.error = ''
  rerender()
  let result = null
  try {
    result = await api.select(pigId)
  } catch (error) {
    state.error = '没有切换：' + messageOf(error, '请稍后重试')
  }
  if (result !== null) {
    if (result?.ok !== true) state.error = '没有切换：' + reasonOf(result)
    else if (result?.restarting === true) { enterRestarting(ui, SAVE_SWITCH); return }
  }
  state.busy = ''
  state.busyPigId = null
  if (result?.ok === true) {
    state.status = null
    state.roster = null
  }
  rerender()
}

async function addPig(ui) {
  if (state.busy !== '' || state.restarting) return
  const api = ownerPigsApi()
  if (api === null || typeof api.addAndSelect !== 'function') return
  state.busy = 'add'
  state.busyPigId = null
  state.error = ''
  rerender()
  let result = null
  try {
    result = await api.addAndSelect()
  } catch (error) {
    state.error = '没有新增：' + messageOf(error, '请稍后重试')
  }
  if (result !== null) {
    if (result?.ok !== true) {
      state.error = '没有新增：' + reasonOf(result)
      if (result?.pigCreated === true) {
        state.status = null
        state.roster = null
      }
    } else if (result?.restarting === true) { enterRestarting(ui, SAVE_RESTART); return }
  }
  state.busy = ''
  state.busyPigId = null
  if (result?.ok === true) {
    state.status = null
    state.roster = null
  }
  rerender()
}

function pigName(pig) {
  return typeof pig?.name === 'string' && pig.name.trim() !== '' ? pig.name : '未命名小猪'
}

function pigDetail(pig) {
  if (pig?.dead === true) return '已离开'
  if (pig?.hatched !== true) return '未孵化'
  const stage = typeof pig?.stage === 'string' ? STAGE_LABELS[pig.stage] : ''
  return stage || '成长中'
}

function retryAction(ui, box) {
  const retryButton = button('dp-mini', { 'data-owner-pig-retry': 'true' }, () => { retry(ui) })
  retryButton.textContent = '重新读取'
  const actions = el('div', 'dp-actions')
  actions.appendChild(retryButton)
  box.appendChild(actions)
}

function renderRestarting(ui, section) {
  const box = section(ui, '小猪', '完整档多猪 · 正在重启')
  box.box.appendChild(el('p', 'dp-dim', state.restartText))
  box.box.appendChild(el('p', 'dp-dim', '应用会自动重启；完成后这里会显示新的当前小猪。'))
}

function renderRoster(ui, section, pigs) {
  const current = pigs.find(pig => pig.selected === true)
  const note = '本机完整档 · 多猪可用' + (current ? ' · 当前使用 ' + pigName(current) : '')
  const box = section(ui, '小猪', note)
  if (state.error !== '') box.box.appendChild(el('div', 'dp-alert dp-dead', state.error))
  if (state.busy !== '') box.box.appendChild(el('p', 'dp-dim', state.busy === 'select' ? SAVE_SWITCH : SAVE_RESTART))

  const list = el('div', 'dp-list')
  for (const pig of pigs) {
    const row = el('div', 'dp-item')
    row.setAttribute('data-owner-pig-row', pig.pigId)
    const grow = el('div', 'dp-grow')
    grow.appendChild(el('div', null, pigName(pig)))
    grow.appendChild(el('div', 'dp-dim', pigDetail(pig)))
    row.appendChild(grow)
    if (pig.selected === true) {
      row.appendChild(el('span', 'dp-dim', '当前'))
    } else {
      const selecting = state.busy === 'select' && state.busyPigId === pig.pigId
      const switchButton = button('dp-mini', { 'data-owner-pig-switch': pig.pigId }, () => { void selectPig(ui, pig.pigId) })
      switchButton.textContent = selecting ? SAVE_SWITCH : '切换'
      switchButton.disabled = state.busy !== ''
      row.appendChild(switchButton)
    }
    list.appendChild(row)
  }
  box.box.appendChild(list)
  if (pigs.length === 0) box.box.appendChild(el('div', 'dp-empty', '这个完整档里还没有小猪'))

  const actions = el('div', 'dp-actions')
  const addButton = button('dp-mini', { 'data-owner-pig-add': 'true' }, () => { void addPig(ui) })
  addButton.textContent = state.busy === 'add' ? SAVE_RESTART : '新增小猪'
  addButton.disabled = state.busy !== ''
  actions.appendChild(addButton)
  box.box.appendChild(actions)
  box.box.appendChild(el('p', 'dp-dim', '切换前会先保存当前小猪；金币、背包和菜园是整份完整档共用的。'))
}

/**
 * Called on each settings paint. Module state keeps the roster stable between
 * the panel's timed repaints, so the section does not flicker or spam IPC.
 * @param {any} ui @param {(ui:any,title:string,note:string)=>{box:HTMLElement,head:HTMLElement}} section
 */
export function renderOwnerPigSettings(ui, section) {
  state.ui = ui
  // DSH, the web page, and older shells have no ownerPigs bridge: hide the whole section.
  if (ownerPigsApi() === null) return
  if (state.restarting) { renderRestarting(ui, section); return }
  if (state.status === null) {
    void requestStatus(ui)
    const loading = section(ui, '小猪', '完整档多猪')
    loading.box.appendChild(el('p', 'dp-dim', LOADING_STATUS))
    return
  }
  if (state.status.available !== true) {
    // A legacy single-pig save has no roster; showing a dead section only confuses.
    if (state.status.mode === 'legacy') return
    const box = section(ui, '小猪', '完整档多猪')
    box.box.appendChild(el('p', 'dp-dim', state.status.reason || UNAVAILABLE))
    retryAction(ui, box.box)
    return
  }
  if (state.roster === null) {
    void requestRoster(ui)
    const loading = section(ui, '小猪', '完整档多猪')
    loading.box.appendChild(el('p', 'dp-dim', LOADING_ROSTER))
    return
  }
  if (state.roster.ok !== true) {
    const box = section(ui, '小猪', '完整档多猪')
    box.box.appendChild(el('p', 'dp-dim', state.roster.reason || '小猪列表读取失败'))
    retryAction(ui, box.box)
    return
  }
  renderRoster(ui, section, state.roster.pigs || [])
}
