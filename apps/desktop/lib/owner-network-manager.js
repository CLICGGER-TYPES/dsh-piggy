// @ts-check
/**
 * 只允许面板为当前 OwnerDocument 显式开关服务、生成单猪邀请，并加入另一台
 * 设备的只读会话。地址始终由主进程枚举；加入用的 token 留在 worker。
 */
import { isAbsolute } from 'node:path'
import { networkInterfaces as systemNetworkInterfaces } from 'node:os'
import { isIP } from 'node:net'

import { enumerateOwnerNetworkAddresses, ownerNetworkAddressKind } from './owner-network-addresses.js'

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
const INVITE_LINK = /^piggy:\/\/([^/?#\s]+):(\d{1,5})#([^#\s]+)$/u
const INVITE_CODE = /^[a-f0-9]{64}$/u

function sameSelection(config, active) {
  return config !== null && active !== null && config.ownerDocumentPath === active.ownerDocumentPath &&
    config.ownerId === active.ownerId && config.pigId === active.pigId
}

function messageOf(error, fallback) {
  return error instanceof Error && error.message !== '' ? error.message : fallback
}

/** 只把界面真正需要的字段送出去；服务端的额外字段（token/邀请等）不外泄。 */
function serviceStatus(service) {
  /** @type {Record<string, any>} */
  const out = {}
  if (service === null || typeof service !== 'object') return out
  if (typeof service.running === 'boolean') out.running = service.running
  for (const key of ['host', 'listenAddress', 'protocol']) {
    if (typeof service[key] === 'string') out[key] = service[key]
  }
  if (Number.isSafeInteger(service.port)) out.port = service.port
  if (Number.isSafeInteger(service.pairedClients)) out.pairedClients = service.pairedClients
  return out
}

/** 远端只读摘要：不接收任意字段，长度也截断。 */
function peerSummary(value) {
  const peer = value !== null && typeof value === 'object' ? value : {}
  return {
    ownerId: typeof peer.ownerId === 'string' ? peer.ownerId : '',
    pigId: typeof peer.pigId === 'string' ? peer.pigId : '',
    name: typeof peer.name === 'string' ? peer.name.slice(0, 80) : '',
    stage: typeof peer.stage === 'string' ? peer.stage.slice(0, 40) : '',
    hatched: peer.hatched === true,
  }
}

/**
 * 解析单条邀请串：`piggy://<私有 IPv4>:<端口>#<64 位邀请码>`。
 * 只接受具体私有 IPv4（含回环，便于同机自测），拒绝主机名、网段、公网和 https。
 * @param {unknown} link
 */
export function parseOwnerNetworkInvite(link) {
  const text = typeof link === 'string' ? link.trim() : ''
  if (text === '') return { ok: false, reason: 'invite-format-invalid' }
  if (/^https:\/\//iu.test(text)) return { ok: false, reason: 'join-https-unsupported' }
  const match = INVITE_LINK.exec(text)
  if (match === null) return { ok: false, reason: 'invite-format-invalid' }
  const address = match[1], portText = match[2], invitation = match[3]
  if (isIP(address) !== 4) return { ok: false, reason: 'invite-address-invalid' }
  const kind = ownerNetworkAddressKind(address)
  if (kind === null || kind === 'public') return { ok: false, reason: 'invite-address-not-private' }
  const port = Number(portText)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) return { ok: false, reason: 'invite-port-invalid' }
  if (!INVITE_CODE.test(invitation)) return { ok: false, reason: 'invite-code-invalid' }
  return { ok: true, address, port, invitation, baseUrl: `http://${address}:${port}` }
}

/**
 * @param {{getHost:()=>any,getOwnerConfig:()=>any,isSupported:()=>boolean,selectionStore:any,isQuitting:()=>boolean,
 *   log:(...args:any[])=>void,networkInterfaces?:()=>any,now?:()=>number}} deps
 */
export function createOwnerNetworkManager(deps) {
  const networkInterfaces = deps.networkInterfaces ?? systemNetworkInterfaces
  const now = deps.now ?? Date.now
  /** @type {{address:string,port:number,peer:any,connected:boolean,joinedAt:number}|null} */
  let joinState = null

  function context() {
    if (deps.isQuitting()) throw new Error('应用正在关闭')
    const config = deps.getOwnerConfig()
    if (config?.source === 'task') throw new Error('隔离运行模式不能开启本机网络会话')
    if (!config || typeof config.ownerDocumentPath !== 'string' || !isAbsolute(config.ownerDocumentPath) ||
        typeof config.ownerId !== 'string' || !ID.test(config.ownerId) || typeof config.pigId !== 'string' || !ID.test(config.pigId)) {
      throw new Error('请先建立或选择一份本机完整存档')
    }
    if (!deps.isSupported()) throw new Error('当前游戏包不支持 owner LAN 会话')
    const selection = deps.selectionStore.read()
    if (selection.pending !== null || !sameSelection(config, selection.active)) throw new Error('当前存档选择需要先恢复或重新启动')
    const host = deps.getHost()
    if (host === null || typeof host.ownerLanStatus !== 'function' || typeof host.startOwnerLan !== 'function' ||
        typeof host.createOwnerLanInvitation !== 'function' || typeof host.stopOwnerLan !== 'function') {
      throw new Error('当前游戏宿主暂不支持 owner LAN 会话')
    }
    return { config, host }
  }

  function listenedAddresses() {
    return enumerateOwnerNetworkAddresses(networkInterfaces())
  }

  async function status() {
    try {
      const { config, host } = context()
      const service = await host.ownerLanStatus()
      return { ok: true, available: true, ownerId: config.ownerId, pigId: config.pigId, ...serviceStatus(service) }
    } catch (error) {
      return { ok: true, available: false, running: false,
        reason: error instanceof Error ? error.message : '本机网络会话暂不可用' }
    }
  }

  /** 地址只来自主进程枚举；渲染层传来的字符串必须命中这一份。 */
  async function addresses() {
    try { context() }
    catch (error) { return { ok: false, reason: messageOf(error, '本机网络会话暂不可用') } }
    try {
      const list = listenedAddresses()
      return { ok: true, addresses: list, lanAvailable: list.some(item => item.kind !== 'loopback') }
    } catch (error) {
      deps.log('owner LAN address enumeration failed', messageOf(error, 'unknown'))
      return { ok: false, reason: '无法读取本机网络地址' }
    }
  }

  async function start(options = {}) {
    let current
    try { current = context() }
    catch (error) { return { ok: false, reason: messageOf(error, '本机网络会话暂不可用') } }
    const listenAddress = typeof options.listenAddress === 'string' ? options.listenAddress.trim() : ''
    if (listenAddress === '') return { ok: false, reason: '请选择一个可用的局域网地址' }
    if (listenAddress === '0.0.0.0' || listenAddress === '::') return { ok: false, reason: '不能监听全部地址，请选择具体地址' }
    let allowed
    try { allowed = listenedAddresses() }
    catch (error) { return { ok: false, reason: messageOf(error, '无法读取本机网络地址') } }
    if (!allowed.some(item => item.address === listenAddress)) {
      return { ok: false, reason: '只能选择本机当前的私有局域网地址' }
    }
    const advertisedHost = typeof options.advertisedHost === 'string' ? options.advertisedHost.trim() : ''
    if (advertisedHost !== '' && advertisedHost !== listenAddress) {
      return { ok: false, reason: '本机未启用加密，对外地址必须与监听地址一致' }
    }
    let existing
    try { existing = await current.host.ownerLanStatus() }
    catch { existing = null }
    if (existing?.running === true) {
      const currentAddress = typeof existing.listenAddress === 'string' ? existing.listenAddress : existing.host
      if (currentAddress === listenAddress) return { ok: true, ...serviceStatus(existing) }
      return { ok: false, reason: '请先停止当前联机再更换地址' }
    }
    try {
      return { ok: true, ...serviceStatus(await current.host.startOwnerLan({ listenAddress })) }
    } catch (error) {
      const reason = messageOf(error, '本机网络会话启动失败')
      deps.log('owner LAN start refused', reason)
      return { ok: false, reason }
    }
  }

  async function invite(pigId) {
    let current
    try { current = context() }
    catch (error) { return { ok: false, reason: messageOf(error, '本机网络会话暂不可用') } }
    if (typeof pigId !== 'string' || !ID.test(pigId)) return { ok: false, reason: '小猪选择无效' }
    try {
      const status = await current.host.ownerLanStatus()
      if (status?.running !== true) return { ok: false, reason: '请先显式开启本机 LAN 会话' }
      const roster = await current.host.listOwnerPigs()
      if (roster?.ownerId !== current.config.ownerId || !Array.isArray(roster.pigs) ||
          !roster.pigs.some(pig => pig?.pigId === pigId)) return { ok: false, reason: '所选小猪不属于当前完整存档' }
      // 邀请只返回给可信面板调用方，不写入磁盘或日志。
      return { ok: true, ...(await current.host.createOwnerLanInvitation(pigId)) }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : '无法创建一次性邀请' }
    }
  }

  async function stop() {
    let current
    try { current = context() }
    catch (error) { return { ok: false, reason: messageOf(error, '本机网络会话暂不可用') } }
    try { return { ok: true, ...serviceStatus(await current.host.stopOwnerLan()) } }
    catch (error) { return { ok: false, reason: messageOf(error, '本机网络会话停止失败') } }
  }

  function joinHost() {
    const host = deps.getHost()
    if (host === null || typeof host.ownerLanJoin !== 'function' ||
        typeof host.ownerLanJoinStatus !== 'function' || typeof host.ownerLanLeave !== 'function') return null
    return host
  }

  function joinSnapshot(extra = {}) {
    if (joinState === null) return { ok: true, joining: false, ...extra }
    return { ok: true, joining: true, connected: joinState.connected,
      peer: joinState.peer, endpoint: { address: joinState.address, port: joinState.port }, ...extra }
  }

  /** 加入另一台设备（只读）。token 只存在于 worker 的客户端闭包里。 */
  async function join(link) {
    const parsed = parseOwnerNetworkInvite(link)
    if (parsed.ok !== true) return parsed
    if (joinState !== null) return { ok: false, reason: '已经连接到另一台设备的联机，请先断开' }
    const host = joinHost()
    if (host === null) return { ok: false, reason: '当前游戏宿主暂不支持加入局域网联机' }
    try {
      const own = await host.ownerLanStatus()
      if (own?.running === true && own.port === parsed.port) {
        const ownAddress = typeof own.listenAddress === 'string' ? own.listenAddress : own.host
        if (ownAddress === parsed.address) return { ok: false, reason: 'join-self' }
      }
    } catch { /* 没有本机服务时不影响加入 */ }
    let result
    try {
      result = await host.ownerLanJoin({ baseUrl: parsed.baseUrl, invitation: parsed.invitation })
    } catch (error) {
      const reason = messageOf(error, 'join-failed')
      deps.log('owner LAN join refused', reason)
      // 失败原因可能来自对端；只保留可读的一行，不回传 token。
      return { ok: false, reason }
    }
    joinState = { address: parsed.address, port: parsed.port,
      peer: peerSummary(result?.peer ?? result), connected: true, joinedAt: now() }
    return joinSnapshot()
  }

  /** 只读刷新：worker 侧缓存 8 秒，这里再合并一次摘要。 */
  async function joinStatus() {
    if (joinState === null) return { ok: true, joining: false }
    const host = joinHost()
    if (host === null) {
      joinState = null
      return { ok: true, joining: false, reason: '当前游戏宿主已不支持加入联机' }
    }
    let result
    try {
      result = await host.ownerLanJoinStatus()
    } catch (error) {
      // 对端停止或网络中断：保留摘要，标记断开，不自动重连（邀请一次有效）。
      joinState.connected = false
      deps.log('owner LAN join status failed', messageOf(error, 'unreachable'))
      return joinSnapshot({ reason: 'unreachable' })
    }
    if (result?.joining === false) {
      const reason = typeof result.reason === 'string' ? result.reason : ''
      joinState = null
      return { ok: true, joining: false, reason }
    }
    joinState.peer = peerSummary(result?.peer ?? joinState.peer)
    joinState.connected = result?.connected !== false
    return joinSnapshot(result?.connected === false && typeof result.reason === 'string' ? { reason: result.reason } : {})
  }

  /** 本地状态优先：对端不可达也清掉本地 token 引用。 */
  async function joinLeave() {
    const had = joinState !== null
    joinState = null
    if (!had) return { ok: true, joining: false }
    const host = joinHost()
    if (host !== null) {
      try { await host.ownerLanLeave() }
      catch (error) { deps.log('owner LAN join leave failed', messageOf(error, 'unknown')) }
    }
    return { ok: true, joining: false }
  }

  return Object.freeze({ status, addresses, start, invite, stop, join, joinStatus, joinLeave })
}
