// @ts-check
/**
 * 局域网房间发现：主机在固定 UDP 端口回答房间码探测，加入方广播查找。
 * 只用于同一网段；防火墙挡住时仍可用完整邀请串加入。
 */
import dgram from 'node:dgram'
import { networkInterfaces as systemNetworkInterfaces } from 'node:os'

import { ownerNetworkAddressKind } from './owner-network-addresses.js'
import { normalizeRoomCode } from './room-code.js'

export const ROOM_DISCOVERY_PORT = 47823
const MAGIC = 'PIGGYROOM/1'
const MAX_PACKET = 64

/** @param {string} code */
export function discoveryProbe(code) {
  return `${MAGIC} ${code}`
}

/** @param {number} httpPort @param {string} [address] */
export function discoveryReply(httpPort, address) {
  return typeof address === 'string' && address !== '' ? `${MAGIC} ${httpPort} ${address}` : `${MAGIC} ${httpPort}`
}

/** @param {string} address @param {string} netmask */
export function broadcastAddress(address, netmask) {
  const ip = ipv4ToInt(address)
  const mask = ipv4ToInt(netmask)
  if (ip === null || mask === null) return null
  return intToIpv4((ip | (~mask >>> 0)) >>> 0)
}

/** @param {unknown} interfaces */
export function discoveryBroadcasts(interfaces) {
  /** @type {Set<string>} */
  const out = new Set()
  if (interfaces === null || typeof interfaces !== 'object') return []
  for (const entries of Object.values(interfaces)) {
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      if (entry === null || typeof entry !== 'object') continue
      if (entry.internal === true) continue
      if (entry.family !== 'IPv4' && entry.family !== 4) continue
      const address = typeof entry.address === 'string' ? entry.address : ''
      const netmask = typeof entry.netmask === 'string' ? entry.netmask : ''
      const kind = ownerNetworkAddressKind(address)
      if (kind !== 'private' && kind !== 'link-local') continue
      const broadcast = broadcastAddress(address, netmask)
      if (broadcast !== null) out.add(broadcast)
    }
  }
  return [...out]
}

/**
 * 广播地址之外也直接探测本机地址：同一台机器开两个实例时，部分系统的广播
 * 不会回环到本机 socket；跨设备仍靠广播。
 * @param {unknown} interfaces
 */
export function discoveryTargets(interfaces) {
  /** @type {Set<string>} */
  const out = new Set(['255.255.255.255', '127.0.0.1'])
  if (interfaces !== null && typeof interfaces === 'object') {
    for (const entries of Object.values(interfaces)) {
      if (!Array.isArray(entries)) continue
      for (const entry of entries) {
        if (entry === null || typeof entry !== 'object') continue
        if (entry.family !== 'IPv4' && entry.family !== 4) continue
        if (entry.internal === true) continue
        const address = typeof entry.address === 'string' ? entry.address : ''
        const kind = ownerNetworkAddressKind(address)
        if (kind !== 'private' && kind !== 'link-local') continue
        out.add(address)
      }
    }
  }
  return [...out]
}

/**
 * @param {{code:string,httpPort:number,port?:number,advertisedHost?:string,log?:(...parts:any[])=>void}} options
 */
export async function startRoomDiscovery(options) {
  const code = normalizeRoomCode(options.code)
  if (code === null) throw new Error('room discovery code is invalid')
  if (!Number.isSafeInteger(options.httpPort) || options.httpPort < 1 || options.httpPort > 65535) {
    throw new Error('room discovery HTTP port is invalid')
  }
  const port = options.port ?? ROOM_DISCOVERY_PORT
  const socket = dgram.createSocket('udp4')
  const reply = discoveryReply(options.httpPort, options.advertisedHost)
  const probe = discoveryProbe(code)
  socket.on('message', (message, remote) => {
    if (message.length > MAX_PACKET) return
    if (message.toString('utf8') !== probe) return
    socket.send(Buffer.from(reply, 'utf8'), remote.port, remote.address, () => {})
  })
  await new Promise((resolve, reject) => {
    socket.once('error', reject)
    socket.bind(port, '0.0.0.0', () => { socket.off('error', reject); resolve(undefined) })
  })
  socket.unref()
  return Object.freeze({
    port,
    close() {
      try { socket.close() } catch { /* 已经关了 */ }
    },
  })
}

/**
 * 广播查找房间。找不到返回 null；调用方决定提示文案。
 * @param {string} code
 * @param {{port?:number,timeoutMs?:number,attempts?:number,interfaces?:()=>any,socketFactory?:()=>any}} [options]
 * @returns {Promise<{address:string,port:number}|null>}
 */
export function findRoomHost(code, options = {}) {
  const normalized = normalizeRoomCode(code)
  if (normalized === null) return Promise.resolve(null)
  const port = options.port ?? ROOM_DISCOVERY_PORT
  const timeoutMs = options.timeoutMs ?? 1200
  const attempts = options.attempts ?? 3
  const interfaces = options.interfaces ?? systemNetworkInterfaces
  const socketFactory = options.socketFactory ?? (() => dgram.createSocket('udp4'))
  const probe = Buffer.from(discoveryProbe(normalized), 'utf8')
  const targets = new Set(discoveryTargets(interfaces()))
  const socket = socketFactory()

  return new Promise(resolve => {
    let done = false
    let attempt = 0
    /** @type {any} */
    let sendTimer = null
    /** @type {any} */
    let deadline = null

    function finish(result) {
      if (done) return
      done = true
      if (sendTimer !== null) clearInterval(sendTimer)
      if (deadline !== null) clearTimeout(deadline)
      try { socket.close() } catch { /* 已关闭 */ }
      resolve(result)
    }

    function sendAll() {
      if (done) return
      attempt += 1
      for (const target of targets) {
        try { socket.send(probe, port, target, () => {}) } catch { /* 单个网卡不可用不影响其他网卡 */ }
      }
      if (attempt >= attempts) {
        clearInterval(sendTimer)
        sendTimer = null
      }
    }

    socket.on('message', (message, remote) => {
      if (message.length > MAX_PACKET) return
      const text = message.toString('utf8')
      const match = /^PIGGYROOM\/1 (\d{1,5})(?: ([0-9.]+))?$/u.exec(text)
      if (match === null) return
      const httpPort = Number(match[1])
      if (!Number.isSafeInteger(httpPort) || httpPort < 1 || httpPort > 65535) return
      const advertised = typeof match[2] === 'string' && match[2] !== '' ? match[2] : remote.address
      const advertisedKind = ownerNetworkAddressKind(advertised)
      if (advertisedKind === null || advertisedKind === 'public') return
      finish({ address: advertised, port: httpPort })
    })
    socket.on('error', () => finish(null))
    socket.bind(0, '0.0.0.0', () => {
      if (done) return
      try { socket.setBroadcast(true) } catch { /* 某些平台不支持广播时仍可手动填邀请串 */ }
      sendAll()
      sendTimer = setInterval(sendAll, 250)
      sendTimer.unref?.()
      deadline = setTimeout(() => finish(null), timeoutMs)
      deadline.unref?.()
    })
  })
}

/** @param {string} address */
function ipv4ToInt(address) {
  const parts = address.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/u.test(part)) return null
    const number = Number(part)
    if (number < 0 || number > 255) return null
    value = (value * 256 + number) >>> 0
  }
  return value
}

/** @param {number} value */
function intToIpv4(value) {
  return [24, 16, 8, 0].map(shift => String((value >>> shift) & 255)).join('.')
}
