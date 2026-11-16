// @ts-check
/**
 * niri（XWayland）窗口适配的纯逻辑：检测、socket、解析、坐标换算、按 title/size 认窗口。
 *
 * niri 下 Electron 的 `getBounds()` 位置不可靠（浮窗常回 0,0），`setBounds()` 的位置
 * 请求也会被合成器忽略。这个模块不碰 Electron，也不 spawn 进程：
 *   - `detectNiri` / `findSocket`：只在 Linux + niri 会话里启用。
 *   - `screenWindows`：把 niri 的逻辑坐标换算成 Electron/X11 的物理屏幕坐标。
 *   - `chooseWindow`：按稳定 title 优先、尺寸兜底认窗口。
 * 真正的 CLI 查询/移动在 lib/niri-client.js。
 *
 * 坐标：niri 的 `tile_pos_in_workspace_view` / `window_size` 是输出内**逻辑**坐标；
 * XWayland/Electron 是**物理**像素。物理 = 逻辑 × 输出 scale，输出原点再用
 * Electron 的 display.bounds 补上。eDP 1.5x、HDMI 1.0x 都按窗口所在输出分别换算。
 */
import { existsSync as nodeExistsSync, readdirSync as nodeReaddirSync, statSync as nodeStatSync } from 'node:fs'
import { join } from 'node:path'

export const NIRI_APP_ID = 'dsh-piggy-desktop'
/** 主猪窗口标题；多猪用 `dsh-piggy-pet-<pigId>`。 */
export const PET_TITLE = 'dsh-piggy-pet'
export const PANEL_TITLE = 'dsh-piggy-panel'
const SOCKET_PATTERN = /^niri\..*\.sock$/

/** 多猪窗口标题：主猪保持稳定短标题，朋友猪带 pigId。 */
export function petWindowTitle(pigId, primary = false) {
  if (typeof pigId !== 'string' || pigId === '') return PET_TITLE
  if (primary === true) return PET_TITLE
  const safe = pigId.replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 96)
  return `${PET_TITLE}-${safe}`
}

/**
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 * @typedef {{ name: string, logical?: { x?: number, y?: number, width?: number, height?: number, scale?: number } }} NiriOutput
 * @typedef {{ id: number, output: string }} NiriWorkspace
 * @typedef {{ id: number, title?: string, app_id?: string, workspace_id?: number, is_floating?: boolean,
 *   layout?: { tile_pos_in_workspace_view?: number[] | null, window_size?: number[] | null, tile_size?: number[] | null } }} NiriRawWindow
 * @typedef {{ id: number, title: string, appId: string, workspaceId: number | null, output: string | null,
 *   isFloating: boolean, rect: Rect, scale: number, windowSize: { width: number, height: number } | null,
 *   tilePosition: { x: number, y: number } }} NiriWindow
 * @typedef {{ title: string, appId?: string, width?: number, height?: number, tolerance?: number }} WindowQuery
 */

/** 只接受 niri 会话；`PIGGY_NIRI=1/0` 可强制打开/关闭（测试和排查用）。 */
export function detectNiri(env = {}, options = {}) {
  const platform = options.platform ?? process.platform
  const forced = String(env.PIGGY_NIRI ?? '')
  if (forced === '0' || forced.toLowerCase() === 'false') return { enabled: false, socket: null, reason: 'disabled' }
  if (platform !== 'linux') return { enabled: false, socket: null, reason: 'platform' }
  const desktop = String(env.XDG_CURRENT_DESKTOP ?? '').toLowerCase()
  const hint = forced === '1' || desktop.includes('niri') || Boolean(env.NIRI_SOCKET)
  if (!hint) return { enabled: false, socket: null, reason: 'not-niri' }
  const socket = findSocket(env, options.io)
  if (socket === null) return { enabled: false, socket: null, reason: 'no-socket' }
  return { enabled: true, socket, reason: 'ok' }
}

/**
 * `NIRI_SOCKET` 优先；否则扫 `XDG_RUNTIME_DIR/niri.*.sock`，多个时取最新修改的。
 * @param {Record<string, string | undefined>} env
 * @param {{ existsSync?: (path: string) => boolean, readdirSync?: (path: string, options: any) => any[], statSync?: (path: string) => any }} [io]
 * @returns {string | null}
 */
export function findSocket(env = {}, io = {}) {
  const exists = io.existsSync ?? nodeExistsSync
  const explicit = typeof env.NIRI_SOCKET === 'string' ? env.NIRI_SOCKET : ''
  if (explicit !== '' && exists(explicit)) return explicit
  const dir = env.XDG_RUNTIME_DIR
  if (typeof dir !== 'string' || dir === '') return null
  const readdir = io.readdirSync ?? nodeReaddirSync
  const stat = io.statSync ?? nodeStatSync
  let entries
  try { entries = readdir(dir, { withFileTypes: true }) } catch { return null }
  const found = []
  for (const entry of Array.isArray(entries) ? entries : []) {
    const name = String(entry?.name ?? '')
    if (!SOCKET_PATTERN.test(name)) continue
    const path = join(dir, name)
    try {
      const info = stat(path)
      found.push({ path, mtime: Number(info?.mtimeMs) || 0 })
    } catch { /* 刚被删掉的旧 socket */ }
  }
  found.sort((left, right) => right.mtime - left.mtime)
  return found.length > 0 ? found[0].path : null
}

/** @param {unknown} value @returns {NiriRawWindow[]} */
export function parseWindows(value) {
  return Array.isArray(value) ? value.filter(item => item !== null && typeof item === 'object' && Number.isFinite(Number(item.id))) : []
}

/** @param {unknown} value @returns {Record<string, NiriOutput>} */
export function parseOutputs(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, NiriOutput>} */ (value) : {}
}

/** @param {unknown} value @returns {NiriWorkspace[]} */
export function parseWorkspaces(value) {
  return Array.isArray(value) ? value.filter(item => item !== null && typeof item === 'object'
    && Number.isFinite(Number(item.id)) && typeof item.output === 'string') : []
}

/** 一块 niri 输出对应哪块 Electron 屏：先按逻辑尺寸×scale 匹配物理尺寸，再用
 * `internal`（eDP/LVDS 内置屏）消歧。找不到就返回 null，调用方跳过这扇窗。
 * @param {NiriOutput} output
 * @param {any[]} displays
 */
export function displayForOutput(output, displays) {
  const logical = output?.logical ?? {}
  const scale = Number(logical.scale) || 1
  const width = Number(logical.width) || 0
  const height = Number(logical.height) || 0
  if (width <= 0 || height <= 0 || !Array.isArray(displays)) return null
  const wantWidth = width * scale
  const wantHeight = height * scale
  const candidates = displays
    .filter(display => display?.bounds !== undefined)
    .map(display => ({
      display,
      score: Math.abs(Number(display.bounds.width) - wantWidth) + Math.abs(Number(display.bounds.height) - wantHeight),
    }))
    .filter(item => item.score <= 12)
    .sort((left, right) => left.score - right.score)
  if (candidates.length === 0) return displays.length === 1 ? displays[0] : null
  const internal = /^(eDP|LVDS|DSI|edp)/i.test(String(output.name ?? ''))
  const exact = candidates.find(item => item.display.internal === internal)
  return (exact ?? candidates[0]).display
}

/** 目标中心点落在哪块屏（不落在任何屏里就返回 null，不跨屏硬搬）。 */
export function displayAtPoint(displays, point) {
  if (!Array.isArray(displays) || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null
  return displays.find(display => display?.bounds !== undefined
    && point.x >= display.bounds.x && point.x < display.bounds.x + display.bounds.width
    && point.y >= display.bounds.y && point.y < display.bounds.y + display.bounds.height) ?? null
}

/**
 * niri 浮窗 → 物理屏幕矩形。跳过没有浮动位置（tiled）或找不到对应屏幕的窗口。
 * @param {NiriRawWindow[]} windows
 * @param {Record<string, NiriOutput>} outputs
 * @param {NiriWorkspace[]} workspaces
 * @param {any[]} displays
 * @returns {NiriWindow[]}
 */
export function screenWindows(windows, outputs, workspaces, displays) {
  const workspaceById = new Map(workspaces.map(workspace => [Number(workspace.id), workspace]))
  const list = []
  for (const window of windows) {
    const position = window?.layout?.tile_pos_in_workspace_view
    const size = window?.layout?.window_size ?? window?.layout?.tile_size
    if (!Array.isArray(position) || position.length < 2 || !position.slice(0, 2).every(Number.isFinite)) continue
    if (!Array.isArray(size) || size.length < 2 || !size.slice(0, 2).every(Number.isFinite)) continue
    const workspace = workspaceById.get(Number(window.workspace_id))
    const output = workspace === undefined ? null : outputs[workspace.output]
    if (output === null || output === undefined) continue
    const display = displayForOutput(output, displays)
    if (display === null) continue
    const scale = Number(output.logical?.scale) || 1
    const rect = {
      x: Math.round(Number(display.bounds.x) + Number(position[0]) * scale),
      y: Math.round(Number(display.bounds.y) + Number(position[1]) * scale),
      width: Math.max(1, Math.round(Number(size[0]) * scale)),
      height: Math.max(1, Math.round(Number(size[1]) * scale)),
    }
    list.push({
      id: Number(window.id),
      title: typeof window.title === 'string' ? window.title : '',
      appId: typeof window.app_id === 'string' ? window.app_id : '',
      workspaceId: Number.isFinite(Number(window.workspace_id)) ? Number(window.workspace_id) : null,
      output: workspace === undefined ? null : workspace.output,
      isFloating: window.is_floating === true,
      rect,
      scale,
      windowSize: { width: Number(size[0]), height: Number(size[1]) },
      tilePosition: { x: Number(position[0]), y: Number(position[1]) },
    })
  }
  return list
}

/**
 * 认窗口：title 精确匹配优先；找不到（标题被页面改了/还没生效）再按物理尺寸兜底。
 * 同 title 多扇时优先浮动窗口，再取 id 最大的（最新创建的那扇）。
 * @param {NiriWindow[]} windows
 * @param {WindowQuery} query
 * @returns {NiriWindow | null}
 */
export function chooseWindow(windows, query) {
  const appId = query.appId
  const byApp = (window) => appId === undefined || window.appId === appId
  const titled = windows.filter(window => window.title === query.title && byApp(window))
  if (titled.length > 0) {
    return titled
      .slice()
      .sort((left, right) => Number(right.isFloating) - Number(left.isFloating) || right.id - left.id)[0]
  }
  if (!Number.isFinite(query.width) || !Number.isFinite(query.height)) return null
  const tolerance = Number.isFinite(query.tolerance) ? Number(query.tolerance) : 12
  const sized = windows
    .filter(window => byApp(window) && window.isFloating
      && Math.abs(window.rect.width - Number(query.width)) <= tolerance
      && Math.abs(window.rect.height - Number(query.height)) <= tolerance)
    .map(window => ({
      window,
      score: Math.abs(window.rect.width - Number(query.width)) + Math.abs(window.rect.height - Number(query.height)),
    }))
    .sort((left, right) => left.score - right.score || right.window.id - left.window.id)
  return sized.length > 0 ? sized[0].window : null
}
