// @ts-check
/**
 * 检测桌面版与两个本机接口：应用标记 → pid → work-endpoint 发现文件 →
 * `/pair/info` + 工作 `/health`。两者都通过才算可用（#14 4.2）。
 *
 * @module dsh-piggy/adapters/dsh/external-discovery
 */

import { join } from 'node:path'

import { desktopMarkerPaths, pidAlive, readJson } from './external-files.js'

const ROLE_PAIR = 'piggy-pair'
const ROLE_WORK = 'piggy-work-events'

function endpointOk(value, role, pid) {
  return value !== null && typeof value === 'object' && value.version === 1 && value.role === role &&
    Number.isSafeInteger(value.port) && value.port > 0 && value.port < 65536 &&
    typeof value.token === 'string' && /^[a-f0-9]{64}$/.test(value.token) && value.pid === pid
}

function markerOk(value) {
  return value !== null && typeof value === 'object' && value.version === 1 &&
    typeof value.appVersion === 'string' && typeof value.gameVersion === 'string' &&
    Number.isSafeInteger(value.stateVersion) && Number.isSafeInteger(value.pid) &&
    typeof value.userData === 'string' &&
    value.external !== null && typeof value.external === 'object' &&
    typeof value.external.enabled === 'boolean' && typeof value.external.workEndpointDir === 'string'
}

/** 读取所有应用标记，返回第一份仍存活且结构有效的。 */
export function readMarkers(options = {}) {
  const paths = options.markerPaths ?? desktopMarkerPaths(options.homes)
  const failures = []
  for (const path of paths) {
    const read = readJson(path)
    if (!read.ok) { failures.push({ path, reason: read.reason }); continue }
    if (!markerOk(read.value)) { failures.push({ path, reason: 'schema' }); continue }
    if (!pidAlive(read.value.pid)) { failures.push({ path, reason: 'stale' }); continue }
    return { ok: true, marker: read.value, path, failures }
  }
  return { ok: false, marker: null, path: null, failures }
}

async function getJson(fetchImpl, url, token, timeoutMs) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await response.text()
  let body = null
  try { body = text === '' ? null : JSON.parse(text) } catch { body = null }
  return { status: response.status, body }
}

/**
 * @param {{fetch?:typeof fetch, markerPaths?:string[], homes?:string[], now?:()=>number, timeoutMs?:number}} options
 */
export async function detectDesktop(options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 3000
  const found = readMarkers(options)
  if (!found.ok) {
    const stale = found.failures.some(entry => entry.reason === 'stale')
    return { ok: false, reason: stale ? 'stale-marker' : 'missing-marker', failures: found.failures }
  }
  const marker = found.marker
  if (marker.external.enabled !== true) return { ok: false, reason: 'disabled', marker }
  const directory = marker.external.workEndpointDir
  const pairFile = readJson(join(directory, 'pair.json'))
  const workFile = readJson(join(directory, 'endpoint.json'))
  if (!pairFile.ok || !endpointOk(pairFile.value, ROLE_PAIR, marker.pid)) {
    return { ok: false, reason: marker.external.pair === true ? 'no-pair' : 'pair-not-offered', marker }
  }
  if (!workFile.ok || !endpointOk(workFile.value, ROLE_WORK, marker.pid)) {
    return { ok: false, reason: 'no-work', marker }
  }
  const pair = pairFile.value
  const work = workFile.value
  const pairBase = `http://127.0.0.1:${pair.port}`
  const workBase = `http://127.0.0.1:${work.port}`
  let info
  try { info = await getJson(fetchImpl, `${pairBase}/pair/info`, pair.token, timeoutMs) }
  catch (error) { return { ok: false, reason: 'pair-unreachable', detail: error instanceof Error ? error.message : String(error), marker } }
  if (info.status !== 200 || info.body?.ok !== true || info.body?.role !== 'piggy-pair') {
    return { ok: false, reason: info.status === 401 ? 'pair-unauthorized' : 'pair-unhealthy', status: info.status, marker }
  }
  let health
  try { health = await getJson(fetchImpl, `${workBase}/health`, work.token, timeoutMs) }
  catch (error) { return { ok: false, reason: 'work-unreachable', detail: error instanceof Error ? error.message : String(error), marker } }
  if (health.status !== 200 || health.body?.ok !== true || health.body?.role !== ROLE_WORK) {
    return { ok: false, reason: health.status === 401 ? 'work-unauthorized' : 'work-unhealthy', status: health.status, marker }
  }
  return {
    ok: true,
    marker,
    target: {
      pid: marker.pid,
      appVersion: marker.appVersion,
      gameVersion: marker.gameVersion,
      stateVersion: marker.stateVersion,
      mergeRulesVersion: Number.isInteger(info.body.mergeRulesVersion) ? info.body.mergeRulesVersion : 1,
      runtimeId: null,
      epoch: null,
      summary: info.body.summary ?? null,
      hasPig: info.body.hasPig === true,
      busy: info.body.busy === true,
    },
    info: info.body,
    health: health.body,
    pair: { base: pairBase, token: pair.token, pid: pair.pid },
    work: { base: workBase, token: work.token, pid: work.pid },
    markerPath: found.path,
  }
}

/** 401 之后只重读发现文件，不重建 pid 检查之外的任何东西。 */
export function readEndpoints(marker) {
  const directory = marker?.external?.workEndpointDir
  if (typeof directory !== 'string') return null
  const pair = readJson(join(directory, 'pair.json'))
  const work = readJson(join(directory, 'endpoint.json'))
  if (!pair.ok || !endpointOk(pair.value, ROLE_PAIR, marker.pid)) return null
  if (!work.ok || !endpointOk(work.value, ROLE_WORK, marker.pid)) return null
  return {
    pair: { base: `http://127.0.0.1:${pair.value.port}`, token: pair.value.token, pid: pair.value.pid },
    work: { base: `http://127.0.0.1:${work.value.port}`, token: work.value.token, pid: work.value.pid },
  }
}
