// @ts-check
/**
 * 桌面版「外部连接」开关：持久化、启动/停止工作与配对接口、写应用标记。
 *
 * 只由主进程和面板窗口调用；扩展大窗口不能开关。发现文件不含令牌。
 *
 * @module dsh-piggy-desktop/external
 */

import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const VERSION = 1

function syncDir(directory) {
  if (process.platform === 'win32') return
  let descriptor
  try { descriptor = openSync(directory, 'r'); fsyncSync(descriptor) }
  catch (error) { if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(error.code)) throw error }
  finally { if (descriptor !== undefined) closeSync(descriptor) }
}

function atomic(file, text, mode = 0o600) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  const descriptor = openSync(temp, 'wx', mode)
  try { writeSync(descriptor, text); fsyncSync(descriptor) } finally { closeSync(descriptor) }
  try { renameSync(temp, file) } catch (error) { try { unlinkSync(temp) } catch { /* keep */ } throw error }
  syncDir(dirname(file))
}

export function dshHomes(configured = process.env.DSH_HOME) {
  const custom = typeof configured === 'string' && configured.trim() !== '' ? resolve(configured.trim()) : null
  return [...new Set([custom, join(homedir(), '.dsh')].filter(Boolean))]
}

export function markerPaths(homes = dshHomes()) {
  return homes.map(home => join(home, 'dsh-piggy', 'desktop-app.json'))
}

/** 读开关；文件坏了按关闭处理（不误开端口）。 */
export function readSettings(userData) {
  try {
    const parsed = JSON.parse(readFileSync(join(userData, 'external.json'), 'utf8'))
    return { version: VERSION, enabled: parsed?.enabled === true }
  } catch { return { version: VERSION, enabled: false } }
}

export function writeSettings(userData, settings) {
  const next = { version: VERSION, enabled: settings.enabled === true }
  atomic(join(userData, 'external.json'), JSON.stringify(next))
  return next
}

function readMarkerValue(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

/** 只删自己写的标记；别的进程留下的不动。 */
export function removeMarkers(files) {
  for (const file of files) {
    const value = readMarkerValue(file)
    if (value !== null && value.pid !== process.pid) continue
    try { unlinkSync(file); syncDir(dirname(file)) } catch (error) { if (error?.code !== 'ENOENT') throw error }
  }
}

/**
 * @param {{userData:string, host:any, appVersion:string, onConfirm?:(plan:any)=>Promise<boolean>|boolean,
 *   log?:(message:string)=>void, homes?:string[], now?:()=>number}} options
 */
export function createExternalManager(options) {
  const userData = options.userData
  const host = options.host
  const log = options.log ?? (() => {})
  const now = options.now ?? (() => Date.now())
  const files = markerPaths(options.homes ?? dshHomes())
  const directory = join(userData, 'work-endpoint')
  let settings = readSettings(userData)
  let running = false
  let error = null
  let meta = { gameVersion: '', stateVersion: 0, port: null, pair: null, work: null }

  function marker(enabled, extra = {}) {
    return {
      version: 1, appVersion: options.appVersion, gameVersion: meta.gameVersion, stateVersion: meta.stateVersion,
      pid: process.pid, userData, startedAt: now(),
      external: { enabled, workEndpointDir: directory, pair: enabled, ...extra },
    }
  }

  function writeMarkers(enabled, extra) {
    const value = marker(enabled, extra)
    for (const file of files) {
      try { atomic(file, JSON.stringify(value)) }
      catch (cause) { log(`external marker not written: ${file}: ${cause instanceof Error ? cause.message : String(cause)}`) }
    }
  }

  /** 真的连一次两个接口：读发现文件 → 带令牌请求 → 校验 role。设置页据此报可连/不可连。 */
  async function probe() {
    let pair = null, work = null
    try {
      pair = JSON.parse(readFileSync(join(directory, 'pair.json'), 'utf8'))
      work = JSON.parse(readFileSync(join(directory, 'endpoint.json'), 'utf8'))
    } catch { return { ok: false, reason: 'discovery-missing', pair: null, work: null } }
    const check = async (entry, role, path) => {
      if (entry === null || entry.role !== role || !Number.isSafeInteger(entry.port) || typeof entry.token !== 'string') {
        return { port: null, reachable: false, role: '', reason: 'role-mismatch' }
      }
      try {
        const response = await fetch(`http://127.0.0.1:${entry.port}${path}`, {
          headers: { authorization: `Bearer ${entry.token}` }, signal: AbortSignal.timeout(3000),
        })
        const body = await response.json().catch(() => null)
        const reachable = response.status === 200 && body?.ok === true && body?.role === role
        return { port: entry.port, reachable, role: body?.role ?? '', reason: reachable ? '' : 'unhealthy' }
      } catch { return { port: entry.port, reachable: false, role: '', reason: 'unreachable' } }
    }
    const pairState = await check(pair, 'piggy-pair', '/pair/info')
    const workState = await check(work, 'piggy-work-events', '/health')
    const ok = pairState.reachable && workState.reachable
    return { ok, reason: ok ? '' : pairState.reason !== '' ? `pair-${pairState.reason}` : `work-${workState.reason}`, pair: pairState, work: workState }
  }

  async function start() {
    if (running) return status()
    error = null
    try {
      const info = await host.externalEnable({ directory, appVersion: options.appVersion, gameVersion: meta.gameVersion })
      meta = { ...meta, stateVersion: info.stateVersion ?? 0, port: info.port ?? null }
      const checked = await probe()
      meta = { ...meta, pair: checked.pair, work: checked.work }
      if (!checked.ok) {
        // 任何一边连不上都不算开：两个接口都关，标记写 false，设置页显示原因。
        try { await host.externalDisable() } catch { /* 已失败，尽力关闭 */ }
        running = false
        error = checked.reason
        writeMarkers(false, { pair: false })
        log(`external endpoints not reachable: ${error}`)
        return status()
      }
      writeMarkers(true)
      running = true
      log(`external endpoints started: pair=${String(meta.pair?.port)} work=${String(meta.work?.port)}`)
    } catch (cause) {
      running = false
      error = cause instanceof Error ? cause.message : String(cause)
      meta = { ...meta, pair: null, work: null }
      writeMarkers(false, { pair: false })
      log(`external endpoints failed: ${error}`)
    }
    return status()
  }

  async function stop() {
    running = false
    error = null
    meta = { ...meta, port: null, pair: null, work: null }
    try { await host.externalDisable() } catch (cause) { log(`external endpoints stop failed: ${cause instanceof Error ? cause.message : String(cause)}`) }
    try { removeMarkers(files) } catch (cause) { log(`external markers not removed: ${cause instanceof Error ? cause.message : String(cause)}`) }
    return status()
  }

  function status() {
    // 默认关闭；只有真连通过 running 才为 true。pair/work 是设置页显示的只读连接结果。
    return {
      ok: error === null, enabled: settings.enabled === true, defaultEnabled: false, running,
      port: meta.port, pair: meta.pair ?? null, work: meta.work ?? null,
      error, stateVersion: meta.stateVersion, gameVersion: meta.gameVersion,
    }
  }

  return {
    async init() {
      try {
        const info = await host.metadata()
        meta = { ...meta, gameVersion: info.gameVersion ?? '', stateVersion: info.stateVersion ?? 0 }
      } catch (cause) { log(`external metadata failed: ${cause instanceof Error ? cause.message : String(cause)}`) }
      if (settings.enabled) await start()
      else { running = false }
      return status()
    },
    async setEnabled(enabled) {
      settings = writeSettings(userData, { enabled: enabled === true })
      if (settings.enabled) await start()
      else await stop()
      return status()
    },
    status,
    async close() { if (running) await stop() },
  }
}
