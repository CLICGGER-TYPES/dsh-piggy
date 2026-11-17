// @ts-check
/**
 * niri / XWayland 的输入区域（X Shape input region）。
 *
 * Electron 的 `BrowserWindow.setShape` 在 X11 上只改 ShapeBounding（绘制裁剪），
 * ShapeInput 仍是整窗：肉眼看到的猪外面那块透明区域会挡住桌面点击。这里用最小
 * 的 X11 协议客户端把 ShapeInput 设成页面报的 hitShape，不引入原生模块。
 *
 * 只在 niri + X11（`--ozone-platform=x11`）下启用；连接失败/没有权限时返回
 * disabled，调用方保持原来的整窗可交互兜底，不影响 GNOME/Windows/macOS。
 */
import net from 'node:net'

const SHAPE_KIND_INPUT = 2
const SHAPE_SET = 0
const SHAPE_UNSORTED = 0
const QUERY_EXTENSION = 98
const MAX_RECTS = 64

/** `:0` / `:0.0` / `hostname:0` → X11 unix socket 候选路径和 display 号。 */
export function parseDisplay(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  const match = /^(?:(?<host>[^:]*):)?(?<number>\d+)(?:\.\d+)?$/.exec(text)
  if (match === null) return null
  const host = match.groups?.host ?? ''
  const number = Number(match.groups?.number)
  if (!Number.isInteger(number) || number < 0) return null
  // 本地 display（空 host / unix / localhost）才用 unix socket；远程 display 不做。
  if (host !== '' && host !== 'unix' && host !== 'localhost') return null
  return { number, paths: [`/tmp/.X11-unix/X${number}`, `\0/tmp/.X11-unix/X${number}`] }
}

/** 连接建立请求：little-endian、协议 11.0、空授权（Xwayland rootless 默认不校验）。 */
export function encodeSetup() {
  const buffer = Buffer.alloc(12)
  buffer.write('l', 0, 'ascii')
  buffer.writeUInt16LE(11, 2)
  buffer.writeUInt16LE(0, 4)
  buffer.writeUInt16LE(0, 6) // auth name length
  buffer.writeUInt16LE(0, 8) // auth data length
  return buffer
}

/** QueryExtension("SHAPE")。 */
export function encodeQueryExtension(name) {
  const padded = (name.length + 3) & ~3
  const buffer = Buffer.alloc(8 + padded)
  buffer.writeUInt8(QUERY_EXTENSION, 0)
  buffer.writeUInt16LE((buffer.length) / 4, 2)
  buffer.writeUInt16LE(name.length, 4)
  buffer.write(name, 8, 'ascii')
  return buffer
}

/**
 * ShapeCombineRectangles：把窗口输入区域设为给定的窗口局部矩形。
 * rects 是 DIP（和 Electron setShape 一致），X11 用物理像素，所以乘 output scale。
 * @param {number} xid
 * @param {Array<{x:number,y:number,width:number,height:number}>} rects
 * @param {number} [scale]
 * @param {number} [major] SHAPE 扩展 major opcode
 */
export function encodeShapeInput(xid, rects, scale = 1, major = 128) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  const list = []
  for (const rect of Array.isArray(rects) ? rects : []) {
    if (list.length >= MAX_RECTS) break
    if (![rect?.x, rect?.y, rect?.width, rect?.height].every(Number.isFinite)) continue
    const x = Math.round(rect.x * safeScale)
    const y = Math.round(rect.y * safeScale)
    const width = Math.max(1, Math.round(rect.width * safeScale))
    const height = Math.max(1, Math.round(rect.height * safeScale))
    list.push({ x, y, width, height })
  }
  // 空 shape 会让窗口完全点不到；退回 1×1 是 Electron 自己也会做的保守选择。
  if (list.length === 0) list.push({ x: 0, y: 0, width: 1, height: 1 })
  const buffer = Buffer.alloc(16 + list.length * 8)
  buffer.writeUInt8(major, 0)
  buffer.writeUInt8(1, 1) // ShapeCombineRectangles
  buffer.writeUInt16LE(buffer.length / 4, 2)
  buffer.writeUInt8(SHAPE_SET, 4) // op = ShapeSet
  buffer.writeUInt8(SHAPE_KIND_INPUT, 5)
  buffer.writeUInt8(SHAPE_UNSORTED, 6)
  buffer.writeUInt32LE(xid >>> 0, 8)
  buffer.writeInt16LE(0, 12) // xOff
  buffer.writeInt16LE(0, 14) // yOff
  let offset = 16
  for (const rect of list) {
    buffer.writeInt16LE(rect.x, offset)
    buffer.writeInt16LE(rect.y, offset + 2)
    buffer.writeUInt16LE(rect.width, offset + 4)
    buffer.writeUInt16LE(rect.height, offset + 6)
    offset += 8
  }
  return buffer
}

/** 从 Electron 的 native handle 取 X11 Window id；取不到返回 null。 */
export function xidOf(window) {
  try {
    const handle = window?.getNativeWindowHandle?.()
    if (!Buffer.isBuffer(handle) || handle.length < 4) return null
    const xid = handle.length >= 8 ? Number(handle.readBigUInt64LE(0)) : handle.readUInt32LE(0)
    return Number.isSafeInteger(xid) && xid > 0 ? xid : null
  } catch { return null }
}

/**
 * 最小 X11 输入区域设置器。连接是异步的；ready 前的请求只保留每扇窗口最后一次。
 * @param {{ display?: string, log?: (...parts:any[])=>any, connect?: (path:string)=>any, setTimeout?: typeof globalThis.setTimeout }} [options]
 */
export function createX11InputShape(options = {}) {
  const log = options.log ?? (() => {})
  const parsed = parseDisplay(options.display ?? process.env.DISPLAY ?? '')
  const enabled = parsed !== null
  /** @type {Map<number, {rects:any[], scale:number}>} */
  const pending = new Map()
  /** @type {any} */
  let socket = null
  let ready = false
  let failed = false
  let shapeMajor = 128
  let buffer = Buffer.alloc(0)
  let connecting = false
  /** 0 = setup, 1 = query extension, 2 = ready. */
  let phase = 0

  function sendShape(xid, entry) {
    if (!ready || socket === null) { pending.set(xid, entry); return false }
    try {
      socket.write(encodeShapeInput(xid, entry.rects, entry.scale, shapeMajor))
      return true
    } catch (error) {
      fail(error)
      return false
    }
  }

  function fail(error) {
    if (failed) return
    failed = true
    ready = false
    log('x11 input shape disabled', error instanceof Error ? error.message : String(error))
    try { socket?.destroy?.() } catch { /* 已断开 */ }
    socket = null
  }

  function onData(chunk) {
    buffer = Buffer.concat([buffer, chunk])
    while (true) {
      if (phase === 0) {
        if (buffer.length < 8) return
        if (buffer[0] === 0) { fail(new Error('X11 connection refused')); return }
        const words = buffer.readUInt16LE(6)
        const total = 8 + words * 4
        if (buffer.length < total) return
        buffer = buffer.subarray(total)
        ready = true
        phase = 1
        socket.write(encodeQueryExtension('SHAPE'))
        continue
      }
      if (phase === 1) {
        if (buffer.length < 32) return
        const words = buffer.readUInt16LE(6)
        const total = 32 + words * 4
        if (buffer.length < total) return
        const present = buffer[8] === 1
        shapeMajor = buffer[9] || 128
        buffer = buffer.subarray(total)
        if (!present) { fail(new Error('SHAPE extension unavailable')); return }
        phase = 2
        for (const [xid, entry] of pending) sendShape(xid, entry)
        pending.clear()
        continue
      }
      return
    }
  }

  function start() {
    if (!enabled || connecting || ready || failed) return
    const connect = options.connect ?? (path => net.connect(path))
    let index = 0
    const attempt = () => {
      if (index >= parsed.paths.length) { fail(new Error('cannot connect to X11 socket')); return }
      const path = parsed.paths[index++]
      let candidate
      try { candidate = connect(path) } catch { attempt(); return }
      socket = candidate
      connecting = true
      candidate.setNoDelay?.(true)
      candidate.unref?.()
      candidate.once('connect', () => {
        if (socket !== candidate) return
        candidate.write(encodeSetup())
      })
      candidate.on('data', chunk => { if (socket === candidate) onData(chunk) })
      candidate.once('error', error => {
        if (socket !== candidate) return
        socket = null
        connecting = false
        if (!ready && !failed) attempt()
        else fail(error)
      })
      candidate.once('close', () => {
        if (socket === candidate && !failed) {
          ready = false
          socket = null
          connecting = false
          // 合成器重启/XWayland 重连后下一次 set() 再试。
        }
      })
    }
    attempt()
  }

  start()

  return {
    enabled,
    ready: () => ready,
    failed: () => failed,
    /** 设置一扇窗口的输入区域；返回是否已真正发出。 */
    set(window, rects, scale = 1) {
      if (!enabled || failed) return false
      const xid = xidOf(window)
      if (xid === null) return false
      const entry = { rects: Array.isArray(rects) ? rects.slice(0, MAX_RECTS) : [], scale }
      const sent = sendShape(xid, entry)
      if (sent) pending.delete(xid)
      return sent
    },
    close() {
      try { socket?.destroy?.() } catch { /* 已断开 */ }
      socket = null
      ready = false
      pending.clear()
    },
  }
}
