// @ts-check
/**
 * niri CLI 客户端：查询真实浮窗位置、按增量移动、跨输出搬窗。
 *
 * 与 lib/niri-window.js 的纯解析/坐标换算分离，方便单测和守住 400 行上限。
 */
import { execFile as nodeExecFile, execFileSync as nodeExecFileSync } from 'node:child_process'
import { chooseWindow, niriWorkAreas, outputAtPoint, parseOutputs, parseWindows, parseWorkspaces, screenWindows } from './niri-window.js'

/** @typedef {{ x: number, y: number, width: number, height: number }} Rect */
/** @typedef {{ title: string, appId?: string, id: number | null, rect: Rect | null, scale: number,
 *   windowSize: { width: number, height: number } | null, output: string | null, isFloating: boolean,
 *   widthHint?: number, heightHint?: number }} NiriHandle */
const MOVE_INTERVAL_MS = 16

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
  let windowsCache = null
  let windowsCacheAt = 0
  const WINDOWS_CACHE_MS = 80
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

  /** 显示器/缩放变化后强制下次重新读输出。 */
  function invalidate() {
    outputCache = null
    outputCacheAt = 0
    windowsCache = null
    windowsCacheAt = 0
  }

  /** niri 输出的工作区（全局逻辑 DIP）；拿不到时返回空数组，调用方回退 Electron。 */
  function workAreas() {
    const { outputs } = outputsAndWorkspaces()
    return niriWorkAreas(outputs, getDisplays())
  }

  /** 目标点落在哪块 niri 输出：优先用输出逻辑布局，不再依赖 Electron 的 display.bounds。 */
  function outputAt(point) {
    const { outputs } = outputsAndWorkspaces()
    const found = outputAtPoint(outputs, getDisplays(), point)
    return found === null ? null : found.name
  }

  /**
   * 旧版本把窗口位置按物理像素写进了 window.json。niri 现在统一用逻辑像素（DIP）；
   * 启动时若保存点不在任何输出里，就按各输出的 scale 折回逻辑坐标，避免猪跑到屏幕外。
   * @param {{x:number,y:number,width?:number,height?:number,pig?:{x:number,y:number}}|null} saved
   */
  function normalizeSaved(saved) {
    if (saved === null || saved === undefined || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return saved
    const areas = workAreas()
    if (areas.length === 0) return saved
    const inside = point => areas.some(area => point.x >= area.x && point.x < area.x + area.width
      && point.y >= area.y && point.y < area.y + area.height)
    if (inside(saved)) return saved
    const { outputs } = outputsAndWorkspaces()
    const displays = getDisplays()
    for (const [name, output] of Object.entries(outputs)) {
      const logical = output?.logical ?? {}
      const scale = Number(logical.scale) || 1
      if (!Number.isFinite(logical.x) || !Number.isFinite(logical.y) || scale === 1) continue
      const display = displays.find(item => item?.bounds !== undefined
        && Math.abs(Number(item.bounds.width) - Number(logical.width)) <= 12
        && Math.abs(Number(item.bounds.height) - Number(logical.height)) <= 12)
      const originX = Number(display?.bounds?.x) || 0
      const originY = Number(display?.bounds?.y) || 0
      const candidate = {
        ...saved,
        x: logical.x + (saved.x - originX) / scale,
        y: logical.y + (saved.y - originY) / scale,
      }
      if (!inside(candidate)) continue
      if (saved.pig !== undefined && saved.pig !== null && Number.isFinite(saved.pig.x) && Number.isFinite(saved.pig.y)) {
        candidate.pig = {
          x: logical.x + (saved.pig.x - originX) / scale,
          y: logical.y + (saved.pig.y - originY) / scale,
        }
      }
      log('niri saved bounds normalized', JSON.stringify({ from: { x: saved.x, y: saved.y }, to: { x: candidate.x, y: candidate.y }, output: name }))
      return candidate
    }
    return saved
  }

  /** @returns {ReturnType<typeof screenWindows>} */
  function readWindows() {
    if (windowsCache !== null && now() - windowsCacheAt < WINDOWS_CACHE_MS) return windowsCache
    const raw = parseWindows(queryJson(['windows']) ?? [])
    if (raw.length === 0) { windowsCache = []; windowsCacheAt = now(); return windowsCache }
    const { outputs, workspaces } = outputsAndWorkspaces()
    windowsCache = screenWindows(raw, outputs, workspaces, getDisplays())
    windowsCacheAt = now()
    return windowsCache
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
      windowsCache = null
      windowsCacheAt = 0
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
    if (process.env.PIGGY_NIRI_DEBUG === '1') log('niri flush', JSON.stringify(moves))
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
    if (process.env.PIGGY_NIRI_DEBUG === '1' && moves.length > 0) log('niri flush sync', JSON.stringify(moves))
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
    windowsCache = null
    windowsCacheAt = 0
  }

  /**
   * 把窗口移动到逻辑坐标 next（DIP；和 Electron BrowserWindow/光标同一套坐标）。
   * 位置用 `move-floating-window` 的相对增量；尺寸仍由 Electron `setBounds` 负责。
   * @param {NiriHandle} handle
   * @param {{ x: number, y: number, width?: number, height?: number }} next
   */
  function moveTo(handle, next) {
    if (handle.id === null || handle.rect === null) return false
    if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) return false
    const width = Number.isFinite(next.width) ? Number(next.width) : handle.rect.width
    const height = Number.isFinite(next.height) ? Number(next.height) : handle.rect.height
    const targetOutput = outputAt({ x: next.x + width / 2, y: next.y + height / 2 })
    if (targetOutput !== null && handle.output !== null && targetOutput !== handle.output) {
      flushIdSync(handle.id)
      if (moveToMonitor(handle.id, targetOutput)) {
        // 搬完输出后窗口会被放到新屏的浮动默认位置，必须重新读一次真实坐标再算增量。
        if (refresh(handle) === null) return false
      }
    }
    const dx = next.x - handle.rect.x
    const dy = next.y - handle.rect.y
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return false
    // 全部逻辑像素：不要再除输出 scale。混合 DPI 下除一次会让窗口只走 1/1.5。
    const current = pending.get(handle.id) ?? { x: 0, y: 0 }
    current.x += dx
    current.y += dy
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
    workAreas,
    outputAt,
    normalizeSaved,
    invalidate,
    moveTo,
    moveBy,
    flush,
    flushSync,
    pending: () => pending.size,
    close,
  }
}
