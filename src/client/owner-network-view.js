// @ts-check
/**
 * 「局域网联机」分区的 DOM 渲染与展示文案。
 *
 * 状态机、缓存与 IPC 调用留在 owner-network.js；这里只接收当前 state 和事件
 * 处理器，保持不读写模块状态，方便单独调整文案与布局。
 */
import { button, el } from './dom.js'

const STAGE_LABELS = Object.freeze({ box: '纸盒', piglet: '幼年猪', young: '青年猪', middle: '成年猪' })

const REASON_TEXT = Object.freeze({
  'invite-format-invalid': '邀请串格式不对：应为 piggy://IP:端口#邀请码',
  'invite-address-invalid': '邀请串里的地址不是 IPv4',
  'invite-address-not-private': '只能加入局域网私有地址（192.168.x.x、10.x.x.x、172.16–31.x.x）',
  'invite-port-invalid': '邀请串里的端口无效（1–65535）',
  'invite-code-invalid': '邀请码应为 64 位小写十六进制，请重新复制',
  'join-https-unsupported': '第一版不能加入加密主机；请让对方关闭 TLS 后用局域网地址连接',
  'join-self': '不能加入自己：这条邀请来自本机',
  'unreachable': '连接已断开：对方可能已停止联机或更换了地址',
  'session-expired': '连接空闲过期，请让对方重新生成邀请串',
  'invitation-invalid-or-expired': '邀请码无效或已过期，请让对方重新生成',
  'pair-rate-limited': '尝试太频繁，请等一分钟再试',
  'session-limit': '对方已连满 8 台设备',
  'invited-target-unavailable': '被邀请的小猪已不在对方的完整档里',
  'forbidden': '地址和对方的监听地址不一致（Host 校验未通过）',
  'pig-target-not-found': '所选小猪不在当前完整档',
  'owner-network-not-running': '请先开启本机联机',
  'owner-network-disabled': '当前配置未允许联机',
})

/** 错误码到可操作文案；未知码原样显示，网络类错误统一指向局域网与防火墙。 */
export function reasonText(reason, fallback) {
  const code = typeof reason === 'string' ? reason.trim() : ''
  if (code === '') return fallback
  if (Object.hasOwn(REASON_TEXT, code)) return REASON_TEXT[code]
  if (/fetch failed|econnrefused|enetunreach|ehostunreach|timeout|timed out|network/iu.test(code)) {
    return '连不上：确认同一局域网、地址端口正确、对方已开启联机、系统防火墙已放行'
  }
  return code.length <= 200 ? code : fallback
}

/** 状态只保留界面需要的字段，服务端额外字段（token/邀请）不进入 DOM。 */
export function normalizeStatus(result) {
  if (result?.ok !== true || result.available !== true) {
    return {
      ok: false,
      available: false,
      reason: typeof result?.reason === 'string' && result.reason !== '' ? result.reason : '本机联机暂不可用',
    }
  }
  return {
    ok: true,
    available: true,
    ownerId: typeof result.ownerId === 'string' ? result.ownerId : '',
    pigId: typeof result.pigId === 'string' ? result.pigId : '',
    running: result.running === true,
    host: typeof result.host === 'string' ? result.host : '',
    port: Number.isSafeInteger(result.port) ? result.port : 0,
    protocol: typeof result.protocol === 'string' ? result.protocol : 'http',
    pairedClients: Number.isSafeInteger(result.pairedClients) ? result.pairedClients : 0,
  }
}

export function normalizeAddresses(result) {
  if (result?.ok !== true || !Array.isArray(result.addresses)) {
    return { ok: false, addresses: [], reason: reasonText(result?.reason, '无法读取本机网络地址') }
  }
  const addresses = result.addresses
    .filter(item => item !== null && typeof item === 'object' && typeof item.address === 'string' &&
      (item.kind === 'loopback' || item.kind === 'private' || item.kind === 'link-local'))
    .map(item => ({
      address: item.address,
      interface: typeof item.interface === 'string' ? item.interface : '',
      kind: item.kind,
    }))
  return { ok: true, addresses, lanAvailable: addresses.some(item => item.kind !== 'loopback') }
}

/** 默认选第一个非回环地址；用户选择仍有效时保留。 */
export function selectedAddress(state) {
  const list = state.addresses?.ok === true ? state.addresses.addresses : []
  if (state.address !== '' && list.some(item => item.address === state.address)) return state.address
  const lan = list.find(item => item.kind !== 'loopback')
  return lan !== undefined ? lan.address : (list[0]?.address ?? '')
}

function addressLabel(item) {
  const where = item.kind === 'loopback' ? '仅本机' : (item.interface || '局域网')
  return `${item.address} · ${where}`
}

/** 未开启：地址下拉 + 开启按钮。 */
export function renderIdle(box, state, handlers) {
  if (state.addresses === null) {
    box.box.appendChild(el('p', 'dp-dim', '正在读取本机网络地址…'))
    return
  }
  if (state.addresses.ok !== true) {
    box.box.appendChild(el('p', 'dp-dim', state.addresses.reason || '无法读取本机网络地址'))
    const retry = button('dp-mini', { 'data-lan-addresses-retry': 'true' }, () => { handlers.retryAddresses() })
    retry.textContent = '重新读取'
    const actions = el('div', 'dp-lan-actions')
    actions.appendChild(retry)
    box.box.appendChild(actions)
    return
  }
  if (state.addresses.addresses.length === 0) {
    box.box.appendChild(el('p', 'dp-dim', '这台设备没有可用的局域网地址；请先连接 Wi-Fi 或网线'))
    return
  }
  const chosen = selectedAddress(state)
  const field = el('label', 'dp-lan-field')
  field.appendChild(el('span', 'dp-dim', '监听地址'))
  const select = /** @type {HTMLSelectElement} */ (el('select', 'dp-setting-field'))
  select.setAttribute('data-lan-address', 'true')
  select.setAttribute('aria-label', '联机监听地址')
  for (const item of state.addresses.addresses) {
    const option = el('option', null, addressLabel(item))
    option.setAttribute('value', item.address)
    select.appendChild(option)
  }
  select.value = chosen
  select.addEventListener('change', () => { handlers.setAddress(select.value) })
  field.appendChild(select)
  box.box.appendChild(field)
  if (state.addresses.lanAvailable !== true) {
    box.box.appendChild(el('p', 'dp-dim', '只找到 127.0.0.1：其他设备暂时连不进来'))
  }

  const actions = el('div', 'dp-lan-actions')
  const start = button('dp-mini', { 'data-lan-start': 'true' }, () => { void handlers.start() })
  start.textContent = state.busy === 'start' ? '正在开启…' : '开启联机'
  start.disabled = state.busy !== '' || chosen === ''
  actions.appendChild(start)
  box.box.appendChild(actions)
  box.box.appendChild(el('p', 'dp-dim', '未加密，只建议在可信局域网使用；公网地址不提供。'))
}

/** 运行中：地址卡、生成/停止、邀请串倒计时。 */
export function renderRunning(box, state, handlers) {
  const host = state.status.host !== '' ? state.status.host : '127.0.0.1'
  const protocol = state.status.protocol === 'https' ? 'HTTPS' : 'HTTP'
  const address = el('div', 'dp-lan-card')
  address.appendChild(el('b', null, `${host}:${state.status.port}`))
  address.appendChild(el('small', 'dp-dim', `${protocol} · 已配对 ${state.status.pairedClients} 台`))
  box.box.appendChild(address)
  box.box.appendChild(el('p', 'dp-dim', '端口每次开启都可能变化；空闲 30 分钟的对端会自动断开。'))

  const actions = el('div', 'dp-lan-actions')
  const invite = button('dp-mini', { 'data-lan-invite': 'true' }, () => { void handlers.invite() })
  invite.textContent = state.busy === 'invite' ? '正在生成…' : '生成邀请串'
  invite.disabled = state.busy !== ''
  actions.appendChild(invite)
  const stop = button('dp-mini dp-mini-plain', { 'data-lan-stop': 'true' }, () => { void handlers.stop() })
  stop.textContent = state.busy === 'stop' ? '正在停止…' : '停止联机'
  stop.disabled = state.busy !== ''
  actions.appendChild(stop)
  box.box.appendChild(actions)

  if (state.invite !== null) {
    const remaining = Math.max(0, Math.ceil((state.invite.expiresAt - Date.now()) / 1000))
    box.box.appendChild(el('p', 'dp-dim', `邀请串（${remaining} 秒后过期，只能用一次）`))
    const code = el('div', 'dp-lan-invite', state.invite.link)
    code.setAttribute('data-lan-invite-code', 'true')
    box.box.appendChild(code)
    const copyActions = el('div', 'dp-lan-actions')
    const copy = button('dp-mini', { 'data-lan-copy': 'true' }, () => { void handlers.copyInvite() })
    copy.textContent = '复制邀请串'
    copyActions.appendChild(copy)
    box.box.appendChild(copyActions)
  }
}

function peerStage(peer) {
  if (peer?.hatched === false) return '未孵化'
  const stage = typeof peer?.stage === 'string' ? STAGE_LABELS[peer.stage] : ''
  return stage || '成长中'
}

function peerName(peer) {
  return typeof peer?.name === 'string' && peer.name.trim() !== '' ? peer.name : '未命名小猪'
}

/** 加入另一台：已连接的只读摘要，或单条邀请串输入。 */
export function renderJoin(box, state, handlers) {
  const joinBox = el('div', 'dp-lan-join')
  const title = el('div', 'dp-lan-join-head')
  title.appendChild(el('b', null, '加入另一台设备'))
  title.appendChild(el('small', 'dp-dim', '只读预览'))
  joinBox.appendChild(title)

  if (state.join !== null) {
    const peer = state.join.peer
    const where = state.join.address !== '' ? `${state.join.address}:${state.join.port}` : '对方设备'
    const summary = el('div', 'dp-lan-card')
    summary.setAttribute('data-lan-joined', 'true')
    summary.appendChild(el('b', null, `已连接 ${where}`))
    summary.appendChild(el('small', 'dp-dim', `目标「${peerName(peer)}」· ${peerStage(peer)}`))
    joinBox.appendChild(summary)
    if (state.join.connected === false) {
      joinBox.appendChild(el('p', 'dp-lan-error', state.join.reason || '连接已断开'))
      joinBox.appendChild(el('p', 'dp-dim', '邀请串一次有效；请让对方重新生成后再加入。'))
    } else {
      joinBox.appendChild(el('p', 'dp-dim', '只读：可以看到对方小猪的名字和成长，不会操作对方的猪。'))
    }
    const actions = el('div', 'dp-lan-actions')
    const leave = button('dp-mini dp-mini-plain', { 'data-lan-leave': 'true' }, () => { void handlers.leave() })
    leave.textContent = state.busy === 'leave' ? '正在断开…' : '断开'
    leave.disabled = state.busy !== ''
    actions.appendChild(leave)
    joinBox.appendChild(actions)
    box.box.appendChild(joinBox)
    return
  }

  if (state.busy === 'join') {
    joinBox.appendChild(el('p', 'dp-dim', '正在连接…'))
    box.box.appendChild(joinBox)
    return
  }

  const field = el('label', 'dp-lan-field')
  field.appendChild(el('span', 'dp-dim', '邀请串'))
  /** @type {any} */
  let joinButton = null
  const input = /** @type {HTMLInputElement} */ (el('input', 'dp-setting-field dp-lan-input'))
  input.type = 'text'
  input.value = state.draft
  input.placeholder = 'piggy://192.168.1.20:53421#邀请码'
  input.setAttribute('data-lan-join-input', 'true')
  input.setAttribute('aria-label', '邀请串')
  input.setAttribute('spellcheck', 'false')
  input.addEventListener('input', () => {
    handlers.setDraft(input.value)
    // 草稿期间 panel.js 不再整轮重绘，这里只更新按钮可用状态，不丢焦点。
    if (joinButton !== null) joinButton.disabled = input.value.trim() === '' || state.busy !== ''
  })
  input.addEventListener('focus', () => { handlers.setInputFocused(true) })
  input.addEventListener('blur', () => { handlers.setInputFocused(false) })
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault?.(); void handlers.join() }
  })
  field.appendChild(input)
  joinBox.appendChild(field)

  const actions = el('div', 'dp-lan-actions')
  const join = button('dp-mini', { 'data-lan-join': 'true' }, () => { void handlers.join() })
  join.textContent = '加入'
  join.disabled = state.draft.trim() === '' || state.busy !== ''
  joinButton = join
  actions.appendChild(join)
  joinBox.appendChild(actions)
  joinBox.appendChild(el('p', 'dp-dim', '粘贴对方复制的整条邀请串。第一版只读，且只支持局域网未加密连接。'))
  box.box.appendChild(joinBox)
}
