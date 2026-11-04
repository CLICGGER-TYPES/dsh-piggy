// @ts-check
/**
 * 设置页「局域网联机」分区。
 *
 * 两种角色放在同一块里：
 * - 本机开服：地址只能从主进程枚举结果里选；邀请是一条 60 秒有效、用一次作废的串。
 * - 加入另一台：粘贴同一条邀请串，只有只读预览（名字/阶段），不发动作。
 *
 * 面板每 4 秒重绘一次，所以状态、地址、加入状态都有缓存与单飞；输入期间由
 * `ownerNetworkDraftOpen()` 让 panel.js 跳过整轮重绘，避免丢焦点。
 */
import { el } from './dom.js'
import { resolveOwnerNetworkBinding } from './owner-network-bridge.js'
import {
  normalizeAddresses, normalizeStatus, reasonText, renderIdle, renderJoin, renderRunning, selectedAddress,
} from './owner-network-view.js'

const STATUS_TTL_MS = 8_000
const ADDRESS_TTL_MS = 30_000
const JOIN_TTL_MS = 8_000
const INVITE_TTL_MS = 60_000

const state = {
  /** @type {any} */
  ui: null,
  generation: 0,
  /** @type {any} */
  status: null,
  statusAt: 0,
  /** @type {Promise<any>|null} */
  statusPromise: null,
  /** @type {{ok:boolean, addresses:Array<any>, lanAvailable?:boolean, reason?:string}|null} */
  addresses: null,
  addressesAt: 0,
  /** @type {Promise<any>|null} */
  addressesPromise: null,
  /** @type {string} */
  address: '',
  /** @type {{link:string, code:string, host:string, port:number, protocol:string, expiresAt:number}|null} */
  invite: null,
  /** @type {{peer:any, address:string, port:number, connected:boolean, reason?:string}|null} */
  join: null,
  joinAt: 0,
  /** @type {Promise<any>|null} */
  joinPromise: null,
  /** @type {''|'start'|'stop'|'invite'|'join'|'leave'} */
  busy: '',
  draft: '',
  inputFocused: false,
  error: '',
  notice: '',
}

function now() { return Date.now() }

function rerender() {
  state.ui?.renderContent?.()
}

function shortReason(error, fallback) {
  const message = error instanceof Error ? error.message : ''
  return message !== '' && message.length <= 200 ? message : fallback
}

function clearFeedback() {
  state.error = ''
  state.notice = ''
}

async function requestStatus(ui) {
  if (state.statusPromise !== null) return
  const binding = resolveOwnerNetworkBinding()
  if (binding === null) return
  const generation = state.generation
  const promise = (async () => {
    try { return normalizeStatus(await binding.api.status()) }
    catch (error) { return normalizeStatus({ ok: false, reason: shortReason(error, '本机联机状态读取失败') }) }
  })()
  state.statusPromise = promise
  const status = await promise
  if (state.statusPromise === promise) state.statusPromise = null
  if (generation !== state.generation) return
  state.status = status
  state.statusAt = now()
  if (status.available !== true) {
    state.invite = null
    if (state.join !== null) {
      // 本机完整档暂时不可用时也不把加入 token 留在 worker 里。
      state.join = null
      try { await binding.api.leave() } catch { /* 对端不可达也要清掉本地引用 */ }
    }
  }
  if (state.ui === ui) rerender()
}

async function requestAddresses(ui) {
  if (state.addressesPromise !== null) return
  const binding = resolveOwnerNetworkBinding()
  if (binding === null) return
  const generation = state.generation
  const promise = (async () => {
    try { return normalizeAddresses(await binding.api.addresses()) }
    catch (error) { return { ok: false, addresses: [], reason: shortReason(error, '无法读取本机网络地址') } }
  })()
  state.addressesPromise = promise
  const addresses = await promise
  if (state.addressesPromise === promise) state.addressesPromise = null
  if (generation !== state.generation) return
  state.addresses = addresses
  state.addressesAt = now()
  if (state.ui === ui) rerender()
}

async function requestJoinStatus(ui) {
  if (state.joinPromise !== null || state.join === null) return
  const binding = resolveOwnerNetworkBinding()
  if (binding === null) return
  const generation = state.generation
  const promise = (async () => {
    try { return await binding.api.joinStatus() }
    catch (error) { return { ok: true, joining: true, connected: false, reason: shortReason(error, 'unreachable') } }
  })()
  state.joinPromise = promise
  const result = await promise
  if (state.joinPromise === promise) state.joinPromise = null
  if (generation !== state.generation || state.join === null) return
  state.joinAt = now()
  if (result?.joining === false) {
    const reason = typeof result.reason === 'string' ? result.reason : ''
    state.join = null
    if (reason !== '') state.error = reasonText(reason, '连接已断开')
  } else {
    const peer = result?.peer
    if (peer !== null && typeof peer === 'object') state.join.peer = peer
    state.join.connected = result?.connected !== false
    if (state.join.connected) state.join.reason = ''
    else state.join.reason = reasonText(result?.reason, '连接已断开')
  }
  if (state.ui === ui) rerender()
}

/** 输入中的邀请串：panel.js 据此跳过整轮重绘，不丢焦点。 */
export function ownerNetworkDraftOpen() {
  return state.draft.trim() !== '' || state.inputFocused
}

function inviteLink(host, port, code) {
  return `piggy://${host}:${port}#${code}`
}

async function startHost(ui) {
  if (state.busy !== '') return
  const binding = resolveOwnerNetworkBinding()
  const address = selectedAddress(state)
  if (binding === null || address === '') return
  state.busy = 'start'
  clearFeedback()
  rerender()
  let result = null
  try {
    result = await binding.api.start({ listenAddress: address })
  } catch (error) {
    state.error = reasonText(shortReason(error, ''), '开启失败，请稍后重试')
  }
  state.busy = ''
  if (result !== null) {
    if (result?.ok === true) {
      state.status = { ...normalizeStatus({ ok: true, available: true, ...state.status, ...result }) }
      state.statusAt = now()
      state.notice = '联机已开启；把邀请串发给同一局域网的另一台设备'
    } else {
      state.error = reasonText(result?.reason, '开启失败，请稍后重试')
    }
  }
  state.statusAt = 0
  rerender()
}

async function stopHost(ui) {
  if (state.busy !== '') return
  const binding = resolveOwnerNetworkBinding()
  if (binding === null) return
  state.busy = 'stop'
  clearFeedback()
  rerender()
  let result = null
  try { result = await binding.api.stop() }
  catch (error) { state.error = shortReason(error, '停止失败，请稍后重试') }
  state.busy = ''
  state.invite = null
  if (result !== null) {
    if (result?.ok === true) {
      state.status = { ...normalizeStatus({ ok: true, available: true, ...state.status }), running: false, pairedClients: 0 }
      state.notice = '联机已停止；端口会释放，重新开启后需要新的邀请串'
    } else {
      state.error = reasonText(result?.reason, '停止失败，请稍后重试')
    }
  }
  state.statusAt = 0
  rerender()
}

async function createInvite(ui) {
  if (state.busy !== '' || state.status === null) return
  const binding = resolveOwnerNetworkBinding()
  if (binding === null) return
  const pigId = typeof state.status.pigId === 'string' ? state.status.pigId : ''
  if (pigId === '') { state.error = '当前完整档没有可用的小猪'; rerender(); return }
  state.busy = 'invite'
  clearFeedback()
  state.invite = null
  rerender()
  let result = null
  try { result = await binding.api.invite(pigId) }
  catch (error) { state.error = shortReason(error, '无法生成邀请') }
  state.busy = ''
  if (result !== null) {
    if (result?.ok === true && typeof result.invitation === 'string') {
      const host = typeof result.host === 'string' && result.host !== '' ? result.host : state.status.host
      const port = Number.isSafeInteger(result.port) ? result.port : state.status.port
      const expiresAt = Number.isFinite(result.expiresAt) ? result.expiresAt : now() + INVITE_TTL_MS
      state.invite = {
        link: inviteLink(host, port, result.invitation),
        code: result.invitation,
        host,
        port,
        protocol: typeof result.protocol === 'string' ? result.protocol : state.status.protocol,
        expiresAt,
      }
    } else {
      state.error = reasonText(result?.reason, '无法生成邀请')
    }
  }
  rerender()
}

async function copyInvite(ui) {
  if (state.invite === null) return
  const text = state.invite.link
  let copied = false
  try {
    const clipboard = typeof navigator === 'undefined' ? null : navigator.clipboard
    if (clipboard !== undefined && clipboard !== null && typeof clipboard.writeText === 'function') {
      await clipboard.writeText(text)
      copied = true
    }
  } catch { copied = false }
  state.notice = copied ? '邀请串已复制' : '复制失败：请选中邀请串手动复制（Ctrl+C）'
  state.error = ''
  rerender()
}

async function joinPeer(ui) {
  if (state.busy !== '' || state.join !== null) return
  const link = state.draft.trim()
  if (link === '') return
  const binding = resolveOwnerNetworkBinding()
  if (binding === null) return
  state.busy = 'join'
  clearFeedback()
  rerender()
  let result = null
  try { result = await binding.api.join(link) }
  catch (error) { state.error = reasonText(shortReason(error, ''), '加入失败，请稍后重试') }
  state.busy = ''
  if (result !== null) {
    if (result?.ok === true) {
      const peer = result.peer !== null && typeof result.peer === 'object' ? result.peer : {}
      const endpoint = result.endpoint !== null && typeof result.endpoint === 'object' ? result.endpoint : {}
      state.join = {
        peer,
        address: typeof endpoint.address === 'string' ? endpoint.address : '',
        port: Number.isSafeInteger(endpoint.port) ? endpoint.port : 0,
        connected: true,
      }
      state.joinAt = now()
      state.draft = ''
      state.inputFocused = false
      state.notice = '已连接；第一版只读，不会操作对方的猪'
    } else {
      state.error = reasonText(result?.reason, '加入失败，请稍后重试')
    }
  }
  rerender()
}

async function leavePeer(ui) {
  if (state.busy !== '') return
  const binding = resolveOwnerNetworkBinding()
  state.busy = 'leave'
  clearFeedback()
  rerender()
  try { await binding?.api.leave() } catch { /* 本地状态优先 */ }
  state.busy = ''
  state.join = null
  state.notice = '已在本机断开'
  rerender()
}

/**
 * Called on each settings paint. Module state keeps the section stable between
 * the panel's timed repaints, so it does not flicker or spam IPC.
 * @param {any} ui @param {(ui:any,title:string,note:string)=>{box:HTMLElement,head:HTMLElement}} section
 */
export function renderOwnerNetworkSettings(ui, section) {
  state.ui = ui
  // DSH 网页版、旧外壳和整屏舞台没有 ownerNetwork 能力：整段隐藏。
  if (resolveOwnerNetworkBinding() === null) return

  if (state.status === null || now() - state.statusAt > STATUS_TTL_MS) void requestStatus(ui)
  if (state.status === null) {
    const loading = section(ui, '局域网联机', '同一局域网的另一台设备可以只读查看这只猪')
    loading.box.appendChild(el('p', 'dp-dim', '正在读取本机联机状态…'))
    return
  }
  if (state.status.available !== true) {
    const box = section(ui, '局域网联机', '同一局域网的另一台设备可以只读查看这只猪')
    box.box.appendChild(el('p', 'dp-dim', state.status.reason || '本机联机暂不可用'))
    return
  }

  const running = state.status.running === true
  if (!running) state.invite = null
  if (state.invite !== null && state.invite.expiresAt <= now()) state.invite = null
  if (state.status.available === true && (state.addresses === null || now() - state.addressesAt > ADDRESS_TTL_MS)) {
    void requestAddresses(ui)
  }
  if (state.join !== null && state.join.connected && now() - state.joinAt > JOIN_TTL_MS) void requestJoinStatus(ui)

  const note = running
    ? `运行中 · 已配对 ${state.status.pairedClients} 台`
    : '同一局域网的另一台设备可以只读查看这只猪；默认关闭，需要手动开启'
  const box = section(ui, '局域网联机', note)
  const badge = el('small', 'dp-lan-badge', running ? '运行中' : '未开启')
  box.head.appendChild(badge)

  if (state.notice !== '') box.box.appendChild(el('div', 'dp-lan-status', state.notice))
  if (state.error !== '') {
    const alert = el('div', 'dp-lan-error', state.error)
    alert.setAttribute('data-lan-error', 'true')
    box.box.appendChild(alert)
  }

  const handlers = {
    start: () => startHost(ui),
    stop: () => stopHost(ui),
    invite: () => createInvite(ui),
    copyInvite: () => copyInvite(ui),
    join: () => joinPeer(ui),
    leave: () => leavePeer(ui),
    setAddress: value => { state.address = value },
    setDraft: value => { state.draft = value },
    setInputFocused: value => { state.inputFocused = value },
    retryAddresses: () => {
      state.addresses = null
      state.addressesAt = 0
      rerender()
    },
  }

  if (running) renderRunning(box, state, handlers)
  else renderIdle(box, state, handlers)
  renderJoin(box, state, handlers)
}
