// @ts-check
/**
 * 外部桌宠：浏览器这一侧唯一的 HTTP 封装。
 *
 * 浏览器不接触配对令牌，只调 DSH 宿主的 /dsh-piggy/external/* 路由；
 * 宿主再拿独立配对令牌去连桌面版（契约见 external-contract.md 与设计附录 A）。
 * 所有函数都返回 { ok, status, data, error }，网络失败不伪装成成功；
 * 界面只读这里归一化后的形状，缺字段按「不知道」显示，不补假数据。
 * @module dsh-piggy/client/external-api
 */
import { arr, isObj, num, obj, str } from './values.js'

export const EXTERNAL_URL = {
  status: '/dsh-piggy/external/status',
  recheck: '/dsh-piggy/external/recheck',
  connect: '/dsh-piggy/external/connect',
  disconnect: '/dsh-piggy/external/disconnect',
  prepare: '/dsh-piggy/external/merge/prepare',
  preview: '/dsh-piggy/external/merge/preview',
  commit: '/dsh-piggy/external/merge/commit',
  status2: '/dsh-piggy/external/merge/status',
  rollback: '/dsh-piggy/external/merge/rollback',
  cancel: '/dsh-piggy/external/merge/cancel',
  restore: '/dsh-piggy/external/restore',
  retireRetry: '/dsh-piggy/external/retire/retry',
}

const PIG_STATES = ['none', 'paused', 'merged', 'rolling-back', 'merge-unknown']
const CONNECTIONS = ['connecting', 'connected', 'reconnecting', 'disconnected', 'merging']
const BLOCKER_KIND = { activity: 'activity', pomodoro: 'pomodoro', fishing: 'fishing-auto' }

/** 一次动作一个 requestId：宿主用它去重，网络失败也只重试同一份请求。 */
export function requestId() {
  const cryptoObject = typeof globalThis === 'object' ? /** @type {any} */ (globalThis).crypto : null
  if (cryptoObject !== null && cryptoObject !== undefined && typeof cryptoObject.randomUUID === 'function') return cryptoObject.randomUUID()
  return 'dsh-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

function errorOf(data, status) {
  const body = obj(data)
  const nested = obj(body.error)
  const code = str(body.reason, str(nested.code, str(body.error, status > 0 ? 'http-' + status : 'network')))
  const message = str(body.message, str(nested.message, ''))
  return { code, message: message || (status > 0 ? '宿主返回 HTTP ' + status : '连不上宿主') }
}

/**
 * 发一次宿主请求。超时用 AbortController；没有它（测试环境）就照常等。
 * @returns {Promise<{ok: boolean, status: number, data: any, error: {code: string, message: string} | null}>}
 */
async function call(url, method, body, timeout) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = controller === null ? null : setTimeout(() => controller.abort(), timeout)
  /** @type {RequestInit} */
  const options = { method, cache: 'no-store' }
  if (controller !== null) options.signal = controller.signal
  if (body !== undefined) {
    options.headers = { 'content-type': 'application/json' }
    options.body = JSON.stringify(body)
  }
  try {
    const response = await fetch(url, options)
    const data = await response.json().catch(() => null)
    if (!response.ok || obj(data).ok === false) {
      return { ok: false, status: response.status, data, error: errorOf(data, response.status) }
    }
    return { ok: true, status: response.status, data, error: null }
  } catch (error) {
    const aborted = isObj(error) && /** @type {any} */ (error).name === 'AbortError'
    return {
      ok: false, status: 0, data: null,
      error: { code: aborted ? 'timeout' : 'network', message: aborted ? '宿主响应超时' : (error instanceof Error ? error.message : String(error)) },
    }
  } finally {
    if (timer !== null) clearTimeout(timer)
  }
}

/** 猪的一行摘要；缺失就是缺失，不替后端编名字和等级。 */
export function normalizeSummary(raw) {
  const outer = obj(raw)
  const inner = obj(outer.summary)
  const source = Object.keys(inner).length > 0 ? inner : outer
  const name = str(source.name, '')
  const hasPig = outer.hasPig === true || source.hatched === true || source.dead === true || name !== ''
  return {
    exists: hasPig,
    // 契约目前只给 hasPig/dead；纸盒与活猪的区分等后端补 kind（见 notes）。
    hatched: source.hatched === true || (hasPig && source.dead !== true && source.box !== true && source.state === undefined),
    dead: source.dead === true,
    box: source.box === true || source.state === 'box',
    state: str(source.state, ''),
    name,
    level: num(source.level, 0),
    days: num(source.days, 0),
    coins: num(source.coins, 0),
    items: num(source.items, 0),
    badges: num(source.badges, 0),
    busy: outer.busy === true,
  }
}

function desktopOf(raw) {
  const source = obj(raw)
  return {
    found: source.found === true || source.pid > 0 || source.summary !== undefined || source.name !== undefined || source.hasPig === true,
    running: source.running !== false,
    enabled: source.enabled === true,
    reason: str(source.reason, ''),
    appVersion: str(source.appVersion, ''),
    gameVersion: str(source.gameVersion, ''),
    stateVersion: num(source.stateVersion, 0),
    mergeRulesVersion: num(source.mergeRulesVersion, 0),
    pid: num(source.pid, 0),
  }
}

function pickEnum(value, allowed, fallback) {
  const text = str(value, '')
  return allowed.includes(text) ? text : fallback
}

/** /external/status 回到面板用的固定形状。 */
export function normalizeStatus(raw) {
  const body = obj(raw)
  const source = Object.keys(obj(body.status)).length > 0 ? obj(body.status) : body
  const pigState = pickEnum(source.pigState, PIG_STATES, source.merged === true ? 'merged' : 'none')
  const external = source.mode === 'external' || pigState !== 'none'
  const connection = pickEnum(source.connection, CONNECTIONS, external ? 'disconnected' : 'disconnected')
  const can = obj(source.can)
  const target = normalizeSummary(source.target)
  const last = normalizeSummary(source.lastSummary)
  const error = str(source.error, str(obj(source.error).message, ''))
  // 发现结果必须读 desktop，不能拿 target 的持久化摘要冒充：DSH 重启后桌面没开时
  // target 还在（上次摘要），但 desktop.found=false——用 target 会把「没连上」
  // 画成「桌面版在运行，但没开联动」。旧宿主没有 desktop 时才退回 target。
  const desktop = desktopOf(Object.keys(obj(source.desktop)).length > 0 ? source.desktop : source.target)
  // 契约没有单独的 enabled 字段：有目标且错误不是「没开联动」就当已就绪。
  if (desktop.found && !['disabled', 'no-pair', 'pair-not-offered', 'missing-marker', 'config-corrupt'].includes(error)) desktop.enabled = true
  return {
    ok: body.ok !== false,
    mode: external ? 'external' : 'internal',
    pigState,
    connection,
    merged: source.merged === true || pigState === 'merged' || pigState === 'rolling-back' || pigState === 'merge-unknown',
    desktop,
    target: target.exists || target.name !== '' ? target : (last.exists ? last : target),
    local: normalizeSummary(source.source ?? source.local),
    queued: num(source.queued, 0),
    canMerge: can.merge === true,
    canRollback: can.rollback === true,
    canRecoverInternal: can.restoreEmbedded === true,
    canAct: can.act === true,
    configCorrupt: source.configCorrupt === true,
    retirementPending: source.retirementPending === true,
    mergeId: str(source.mergeId, ''),
    merge: isObj(source.preview) ? source.preview : null,
    lastAt: num(source.lastAt, 0),
    error,
    raw: source,
  }
}

/** /external/connect 的两种返回：合并选择页数据，或连接后的 status。 */
export function normalizeConnectResult(raw) {
  const body = obj(raw)
  const hasPage = Object.keys(obj(body.source)).length > 0 || arr(body.blockers).length > 0
  return {
    ok: body.ok !== false,
    page: hasPage,
    target: normalizeSummary(body.target),
    source: normalizeSummary(body.source),
    blockers: arr(body.blockers).map(normalizeBlocker),
    status: hasPage ? null : normalizeStatus(body),
  }
}

function normalizeBlocker(raw) {
  const source = obj(raw)
  const reason = str(source.reason, '')
  return {
    side: source.side === 'source' ? 'source' : 'target',
    kind: str(source.kind, BLOCKER_KIND[reason] ?? 'unknown'),
    reason,
    label: str(source.label, str(source.detail, reason)),
    finished: source.finished === true || source.alreadyFinished === true,
    phase: str(source.phase, ''),
    refund: num(source.refund, 0),
    bait: num(source.bait, 0),
    minutes: num(source.minutes, 0),
    raw: source,
  }
}

function normalizeConflict(raw) {
  const source = obj(raw)
  return {
    key: str(source.key, ''),
    label: str(source.label, str(source.key, '扩展')),
    message: str(source.message, ''),
    level: str(source.level, 'choice'),
    options: arr(source.options).map(value => str(value, '')).filter(Boolean),
    default: source.default === 'source' ? 'source' : source.default === 'target' ? 'target' : '',
    paths: arr(source.paths).map(value => str(value, '')).filter(Boolean),
    raw: source,
  }
}

function normalizeChoice(raw) {
  const source = obj(raw)
  return {
    key: str(source.key, ''),
    label: str(source.label, str(source.key, '')),
    options: arr(source.options).map(value => str(value, '')).filter(Boolean),
    default: source.default === 'source' ? 'source' : 'target',
    editable: arr(source.editable).map(value => str(value, '')).filter(Boolean),
    value: source.value,
    side: str(obj(source.value).side, ''),
  }
}

/** 预览报告只给默认边的值；能读多少读多少，另一边按「没提供」处理。 */
function sidesOf(choices) {
  const sides = { target: {}, source: {} }
  for (const choice of choices) {
    const value = choice.value
    if (choice.key === 'name' && typeof value === 'string') {
      sides[choice.default].name = value
      continue
    }
    if (!isObj(value)) continue
    const side = value.side === 'source' ? 'source' : 'target'
    if (choice.key === 'look') Object.assign(sides[side], { form: value.form ?? '', skin: value.skin ?? '', worn: arr(value.worn).map(entry => str(entry, '')).filter(Boolean) })
    if (choice.key === 'personality') Object.assign(sides[side], {
      personality: str(value.personality, ''), catchphrase: str(value.catchphrase, ''), motto: str(value.motto, ''),
      birthday: isObj(value.birthday) ? value.birthday.month + '/' + value.birthday.day : str(value.birthday, ''),
    })
    if (choice.key === 'preferences') Object.assign(sides[side], {
      ownerName: str(value.ownerName, ''), quiet: value.quiet === true, isOfflineFeedEnabled: value.isOfflineFeedEnabled !== false,
      timeScale: num(value.timeScale, 1), spot: str(value.spot, str(obj(value.fishing).spot, '')),
    })
  }
  return sides
}

/** 预览/提交响应共用的摘要形状。 */
export function normalizePreview(raw) {
  const body = obj(raw)
  const source = Object.keys(obj(body.preview)).length > 0 ? obj(body.preview) : body
  const details = obj(source.details)
  const blockersRaw = arr(source.blockers).length > 0 ? arr(source.blockers) : arr(details.blockers)
  const result = obj(source.result)
  const choices = arr(source.choices).map(normalizeChoice)
  const duplicateRaw = source.duplicate
  return {
    ok: body.ok !== false,
    mergeId: str(source.mergeId, ''),
    previewToken: str(source.previewToken, ''),
    expiresAt: num(source.expiresAt, 0),
    blocked: source.blocked === true || blockersRaw.length > 0,
    reason: str(source.reason, str(details.reason, '')),
    blockers: blockersRaw.map(normalizeBlocker),
    target: normalizeSummary(source.target),
    source: normalizeSummary(source.source),
    result: {
      name: str(result.name, ''),
      level: num(result.level, 0),
      days: num(result.days, 0),
      coins: num(result.coins, 0),
      items: num(result.items, 0),
      badges: num(result.badges, 0),
      newBadges: num(result.newBadges, 0),
      newDex: num(result.newDex, 0),
      newDiary: num(result.newDiary, 0),
      dead: result.dead === true,
    },
    choices,
    sides: sidesOf(choices),
    editors: obj(source.editors),
    conflicts: arr(source.conflicts).map(normalizeConflict),
    warnings: arr(source.warnings).map(value => str(value, '')).filter(Boolean),
    autoMerge: arr(source.autoMerge ?? source.auto).map(value => str(value, '')).filter(Boolean),
    duplicate: duplicateRaw === true ? { suspected: true } : isObj(duplicateRaw) && duplicateRaw.suspected === true ? duplicateRaw : null,
    backups: obj(source.backups),
    sourceBackup: str(source.sourceBackup, ''),
    runtimeId: str(source.runtimeId, str(obj(source.target).runtimeId, '')),
    epoch: num(source.epoch, num(obj(source.target).epoch, -1)),
    raw: source,
  }
}

/** 提交/撤销结果：只认宿主真给的字段。 */
export function normalizeResult(raw) {
  const body = obj(raw)
  const source = Object.keys(obj(body.result)).length > 0 ? obj(body.result) : body
  const summary = Object.keys(obj(source.summary)).length > 0 ? obj(source.summary) : source
  const restored = obj(source.restored)
  const backups = Object.keys(obj(source.backups)).length > 0 ? obj(source.backups) : obj(body.backups)
  return {
    ok: body.ok !== false,
    status: str(source.status, str(body.status, str(body.reason, ''))),
    mergeId: str(source.mergeId, str(body.mergeId, '')),
    result: normalizePreview({ result: summary }).result,
    backups,
    restored: { target: restored.target === true, source: restored.source === true },
    cleanup: str(backups.cleanup, ''),
    dsh: obj(source.dsh ?? body.dsh),
    errors: arr(obj(source.details).errors).map(entry => ({ path: str(obj(entry).path, ''), reason: str(obj(entry).reason, '') })).filter(entry => entry.path !== ''),
    warnings: arr(source.warnings).map(value => str(value, '')).filter(Boolean),
    error: str(source.error, str(body.reason, str(body.error, ''))),
    raw: source,
  }
}

/** 读当前外部模式状态；面板每次打开设置都问一次。 */
export async function fetchStatus() {
  const result = await call(EXTERNAL_URL.status, 'GET', undefined, 10000)
  return { ...result, status: normalizeStatus(result.data ?? {}) }
}

/** 重新检测桌面版（只读发现文件，不改存档）。 */
export async function recheck() {
  const result = await call(EXTERNAL_URL.recheck, 'POST', {}, 15000)
  return { ...result, status: normalizeStatus(result.data ?? {}) }
}

/**
 * 开始连接；mode=connect 真正连接，mode=merge 只返回两猪选择页数据。
 * @returns {Promise<any>} normalizeConnectResult
 */
export async function connect(mode) {
  const result = await call(EXTERNAL_URL.connect, 'POST', { mode: mode === 'merge' ? 'merge' : 'connect' }, 20000)
  return { ...result, page: normalizeConnectResult(result.data ?? {}) }
}

/** 切回内嵌猪。 */
export async function disconnect(options) {
  const body = { discardQueue: options?.discardQueue === true, confirmChanged: options?.confirmChanged === true }
  return call(EXTERNAL_URL.disconnect, 'POST', body, 20000)
}

/** 强制终结一个瞬态；契约把活动合并成 activity/pomodoro/fishing 三类。 */
export async function prepare(blocker) {
  const reason = obj(blocker).reason
  const target = reason === 'pomodoro' ? 'pomodoro' : reason === 'fishing' ? 'fishing' : 'activity'
  return call(EXTERNAL_URL.prepare, 'POST', { target, side: obj(blocker).side === 'source' ? 'source' : 'target' }, 20000)
}

/** 生成/刷新合并预览；源 ZIP 由宿主生成，浏览器不传文件。 */
export async function preview() {
  return call(EXTERNAL_URL.preview, 'POST', {}, 30000)
}

/** 提交合并；choices 按契约第 4 节整理，mergeId/token 由宿主自己保存。 */
export async function commit(choices) {
  return call(EXTERNAL_URL.commit, 'POST', { choices }, 120000)
}

/** 查询 merge-unknown 的结果。 */
export async function mergeStatus(mergeId) {
  return call(EXTERNAL_URL.status2 + (mergeId === '' ? '' : '?mergeId=' + encodeURIComponent(mergeId)), 'GET', undefined, 10000)
}

/** 取消预览：让源端解冻并恢复。 */
export async function cancel() {
  return call(EXTERNAL_URL.cancel, 'POST', {}, 20000)
}

/** 撤销最近一次合并。 */
export async function rollback(mergeId) {
  return call(EXTERNAL_URL.rollback, 'POST', { mergeId }, 30000)
}

/** 只恢复内嵌猪（桌面保持合并后的猪）；backup 省略时用最近一次。 */
export async function restore(backup) {
  return call(EXTERNAL_URL.restore, 'POST', backup === undefined ? {} : { backup }, 20000)
}

/** 桌面已合并、DSH 退役没完成时重试补做两个改名。 */
export async function retireRetry() {
  return call(EXTERNAL_URL.retireRetry, 'POST', {}, 20000)
}
