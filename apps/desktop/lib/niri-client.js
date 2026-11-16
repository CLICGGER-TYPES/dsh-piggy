// @ts-check
/**
 * niri CLI 客户端：查询真实浮窗位置、按增量移动、跨输出搬窗。
 *
 * 与 lib/niri-window.js 的纯解析/坐标换算分离，方便单测和守住 400 行上限。
 */
import { execFile as nodeExecFile, execFileSync as nodeExecFileSync } from 'node:child_process'
import { chooseWindow, displayAtPoint, displayForOutput, parseOutputs, parseWindows, parseWorkspaces, screenWindows } from './niri-window.js'

/** @typedef {{ x: number, y: number, width: number, height: number }} Rect */
/** @typedef {{ title: string, appId?: string, id: number | null, rect: Rect | null, scale: number,
 *   windowSize: { width: number, height: number } | null, output: string | null, isFloating: boolean,
 *   widthHint?: number, heightHint?: number }} NiriHandle */
const MOVE_INTERVAL_MS = 33

function parseJson(text) {
  try { return JSON.parse(String(text)) } catch { return null }
}

/**
 * niri CLI 客户端：查询同步、移动异步合并。
 * @param {{
 *   socket: string | null,
 *   env?: Record<string, string | undefined>,
 *   getDisplays?: () => any[],
 *   execFile?: typeof nodeExecFile,
 *   execFileSync?: typeof nodeExecFileSync,
 *   setTimeout?: typeof globalThis.setTimeout,
 *   clearTimeout?: typeof globalThis.clearTimeout,
 *   intervalMs?: number,
 *   now?: () => number,
 *   log?: (...parts: any[]) => any,
 * }} options
 */
export function createNiriWindow(options) {
  const socket = typeof options.socket === 'string' && options.socket !== '' ? options.socket : null
  const env = { ...(options.env ?? {}) }
  if (socket !== null) env.NIRI_SOCKET = socket
  const execFile = options.execFile ?? nodeExecFile
  const execFileSync = options.execFileSync ?? nodeExecFileSync
  const getDisplays = options.getDisplays ?? (() => [])
  const scheduleTimeout = options.setTimeout ?? setTimeout
  const clearTimer = options.clearTimeout ?? clearTimeout
  const intervalMs = Number.isFinite(options.intervalMs) && Number(options.intervalMs) > 0
    ? Number(options.intervalMs) : MOVE_INTERVAL_MS
  const now = options.now ?? Date.now
  const log = options.log ?? (() => {})
  /** @type {Map<number, { x: number, y: number }>} */
  const pending = new Map()
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null
  let inflight = Promise.resolve()
  let outputCache = null
  let outputCacheAt = 0
  let lastError = ''

  function queryJson(args) {
    if (socket === null) return null
    try {
      const text = execFileSync('niri', ['msg', '--json', ...args], {
        env, encoding: 'utf8', timeout: 2000, maxBuffer: 4 * 1024 * 1024,
      })
      return parseJson(text)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message !== lastError) {
        lastError = message
        log('niri query failed', args.join(' '), message)
      }
      return null
    }
  }

  function outputsAndWorkspaces() {
    if (outputCache !== null && now() - outputCacheAt < 5000) return outputCache
    const outputs = parseOutputs(queryJson(['outputs']) ?? {})
    const workspaces = parseWorkspaces(queryJson(['workspaces']) ?? [])
    outputCache = { outputs, workspaces }
    outputCacheAt = now()
    return outputCache
  }

  /** Electron 屏对应哪块 niri 输出（跨屏移动要先用 move-window-to-monitor）。 */
  function outputNameForDisplay(display) {
    if (display === null || display === undefined) return null
    const displays = getDisplays()
    for (const [name, output] of Object.entries(outputsAndWorkspaces().outputs)) {
      const matched = displayForOutput(output, displays)
      if (matched !== null && (matched.id === display.id || (matched.bounds.x === display.bounds.x && matched.bounds.y === display.bounds.y))) return name
    }
    return null
  }

  /** @returns {ReturnType<typeof screenWindows>} */
  function readWindows() {
    const raw = parseWindows(queryJson(['windows']) ?? [])
    if (raw.length === 0) return []
    const { outputs, workspaces } = outputsAndWorkspaces()
    return screenWindows(raw, outputs, workspaces, getDisplays())
  }

  /** @param {{ title: string, appId?: string, width?: number, height?: number, tolerance?: number }} query */
  function watch(query) {
    /** @type {NiriHandle} */
    const handle = {
      title: query.title,
      appId: query.appId,
      id: null,
      rect: null,
      scale: 1,
      windowSize: null,
      output: null,
      isFloating: false,
      widthHint: query.width,
      heightHint: query.height,
    }
    return handle
  }

  /** @param {NiriHandle} handle */
  function refresh(handle) {
    const found = chooseWindow(readWindows(), {
      title: handle.title, appId: handle.appId,
      width: handle.rect?.width ?? handle.widthHint, height: handle.rect?.height ?? handle.heightHint,
    })
    if (found === null) return null
    handle.id = found.id
    handle.rect = { ...found.rect }
    handle.scale = found.scale
    handle.windowSize = { ...found.windowSize }
    handle.output = found.output
    handle.isFloating = found.isFloating
    return found
  }

  function schedule() {
    if (timer !== null) return
    timer = scheduleTimeout(() => {
      timer = null
      void flush()
    }, intervalMs)
    timer?.unref?.()
  }

  function moveArgs(id, dx, dy) {
    const flag = (name, value) => value < 0 ? [`${name}=${value}`] : [name, `+${value}`]
    return ['msg', 'action', 'move-floating-window', '--id', String(id), ...flag('-x', dx), ...flag('-y', dy)]
  }

  function takeMoves(round) {
    const moves = []
    for (const [id, delta] of pending) {
      const dx = round(delta.x)
      const dy = round(delta.y)
      if (dx === 0 && dy === 0) {
        pending.delete(id)
        continue
      }
      pending.delete(id)
      moves.push({ id, dx, dy })
    }
    return moves
  }

  /** 只结清一扇窗口的待发增量（跨屏移动前用，避免旧输出上的位移落到新输出）。 */
  function flushIdSync(id) {
    const delta = pending.get(id)
    if (delta === undefined) return
    pending.delete(id)
    const dx = Math.round(delta.x)
    const dy = Math.round(delta.y)
    if (dx === 0 && dy === 0) return
    try {
      execFileSync('niri', moveArgs(id, dx, dy), { env, timeout: 3000 })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message !== lastError) {
        lastError = message
        log('niri move failed', id, message)
      }
    }
  }

  /** 浮动窗口绑定在某个输出/工作区上；跨屏必须先搬输出，move-floating-window 才有效。 */
  function moveToMonitor(id, outputName) {
    try {
      execFileSync('niri', ['msg', 'action', 'move-window-to-monitor', '--id', String(id), outputName], { env, timeout: 3000 })
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message !== lastError) {
        lastError = message
        log('niri move-to-monitor failed', id, outputName, message)
      }
      return false
    }
  }

  /** 合并后的移动真正发给 niri（异步，不阻塞拖拽 tick）。 */
  function flush() {
    if (timer !== null) clearTimer(timer)
    timer = null
    const moves = takeMoves(value => Math.round(value))
    if (moves.length === 0) return inflight
    const jobs = moves.map(move => new Promise(resolve => {
      execFile('niri', moveArgs(move.id, move.dx, move.dy), { env, timeout: 3000 }, error => {
        if (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (message !== lastError) {
            lastError = message
            log('niri move failed', move.id, message)
          }
        }
        resolve()
      })
    }))
    inflight = Promise.all(jobs).then(() => undefined)
    return inflight
  }

  /** 拖动结束/退出前用：把累积增量同步发完，保证紧接着的查询看到最终位置。 */
  function flushSync() {
    if (timer !== null) clearTimer(timer)
    timer = null
    const moves = takeMoves(value => Math.round(value))
    for (const move of moves) {
      try {
        execFileSync('niri', moveArgs(move.id, move.dx, move.dy), { env, timeout: 3000 })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message !== lastError) {
          lastError = message
          log('niri move failed', move.id, message)
        }
      }
    }
  }

  /**
   * 把窗口移动到物理坐标 next（增量 = next − 上次已知位置）。只改位置；尺寸仍由
   * Electron `setBounds` 负责。
   * @param {NiriHandle} handle
   * @param {{ x: number, y: number, width?: number, height?: number }} next
   */
  function moveTo(handle, next) {
    if (handle.id === null || handle.rect === null) return false
    if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) return false
    const width = Number.isFinite(next.width) ? Number(next.width) : handle.rect.width
    const height = Number.isFinite(next.height) ? Number(next.height) : handle.rect.height
    const targetDisplay = displayAtPoint(getDisplays(), { x: next.x + width / 2, y: next.y + height / 2 })
    if (targetDisplay !== null && handle.output !== null) {
      const targetOutput = outputNameForDisplay(targetDisplay)
      if (targetOutput !== null && targetOutput !== handle.output) {
        flushIdSync(handle.id)
        if (moveToMonitor(handle.id, targetOutput)) {
          // 搬完输出后窗口会被放到新屏的浮动默认位置，必须重新读一次真实坐标再算增量。
          if (refresh(handle) === null) return false
        }
      }
    }
    const dx = next.x - handle.rect.x
    const dy = next.y - handle.rect.y
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return false
    const scale = Number(handle.scale) || 1
    const current = pending.get(handle.id) ?? { x: 0, y: 0 }
    current.x += dx / scale
    current.y += dy / scale
    pending.set(handle.id, current)
    handle.rect = { ...handle.rect, x: next.x, y: next.y }
    schedule()
    return true
  }

  /** @param {NiriHandle} handle @param {number} dx @param {number} dy */
  function moveBy(handle, dx, dy) {
    if (handle.id === null || handle.rect === null) return false
    return moveTo(handle, { x: handle.rect.x + dx, y: handle.rect.y + dy })
  }

  function close() {
    if (timer !== null) clearTimer(timer)
    timer = null
    pending.clear()
  }

  return {
    enabled: socket !== null,
    socket,
    watch,
    refresh,
    readWindows,
    moveTo,
    moveBy,
    flush,
    flushSync,
    pending: () => pending.size,
    close,
  }
}
