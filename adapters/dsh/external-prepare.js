// @ts-check
/**
 * 源端的强制终结：运行中走本地运行时；已暂存时直接改存档文件，不打开运行时。
 *
 * 暂存期间猪的时钟停在 `suspendedAt`：终结必须用这个时间，不能按墙钟结算
 * 暂停的那一段（#14 4.4 / 5.9）。写盘失败或校验失败会把原文件放回去，
 * 配置仍是 paused，不会留下半个终结；也不产生/投递任何工作事件。
 *
 * @module dsh-piggy/adapters/dsh/external-prepare
 */

import { abandonPomodoro, callOffActivity, keepFish, mergeSummary } from '../../core.js'
import { readStateFile, writeStateFile } from '../../store/state-file.js'
import { stateFingerprint } from './external-files.js'
import { readReceipts } from './external-lifecycle.js'

const TARGETS = ['activity', 'pomodoro', 'fishing']

function terminated(state, target) {
  if (target === 'activity') return state.activity === null || state.activity === undefined
  if (target === 'pomodoro') return state.pomodoro?.startedAt === null || state.pomodoro?.startedAt === undefined
  return state.fishing?.pending === null || state.fishing?.pending === undefined
}

/** 纯函数部分：返回 { changed, alreadyFinished, summary }；非法 target 返回 null。 */
export function terminateActivity(state, target, at) {
  if (target === 'activity') {
    const had = state.activity !== null && state.activity !== undefined
    const called = callOffActivity(state, at)
    return { changed: had, alreadyFinished: had && called.ok !== true, summary: { had, result: called } }
  }
  if (target === 'pomodoro') {
    const had = state.pomodoro?.startedAt !== null && state.pomodoro?.startedAt !== undefined
    const abandoned = abandonPomodoro(state, at)
    return { changed: had, alreadyFinished: had && abandoned.ok === true && abandoned.abandoned === false, summary: { had, result: abandoned } }
  }
  if (target === 'fishing') {
    const pending = state.fishing?.pending ?? null
    if (pending === null) return { changed: false, alreadyFinished: true, summary: { kept: false } }
    if (pending.phase === 'caught') {
      const kept = keepFish(state, at)
      return { changed: true, alreadyFinished: true, summary: { kept: kept.ok === true, result: kept } }
    }
    // 等待/搏斗中：鱼跑掉，抛竿用掉的鱼饵不退（#14 4.4）。
    state.fishing.pending = null
    return { changed: true, alreadyFinished: false, summary: { kept: false, escaped: true } }
  }
  return null
}

/**
 * 已暂存源端的终结：读文件 → 按暂停时刻终结 → 原子写 → 复检 → 更新配置指纹。
 * @param {any} ctx 控制器上下文（statePath/now/getConfig/saveConfig/getPreview/getMode）
 * @param {string} target
 */
export async function preparePausedSource(ctx, target) {
  if (!TARGETS.includes(target)) return { ok: false, reason: 'unknown-target' }
  const config = ctx.getConfig()
  if (ctx.getMode() !== 'external' || config?.pigState !== 'paused') return { ok: false, reason: 'not-paused' }
  if (ctx.getPreview() !== null) return { ok: false, reason: 'busy' }
  const at = Number(config.suspendedAt)
  if (!Number.isFinite(at) || at <= 0) return { ok: false, reason: 'bad-pause-clock' }
  const loaded = readStateFile(ctx.statePath, at)
  if (loaded.state === null) return { ok: false, reason: 'absent' }
  const before = structuredClone(loaded.state)
  const result = terminateActivity(loaded.state, target, at)
  if (result === null) return { ok: false, reason: 'unknown-target' }
  if (!result.changed) return { ok: true, alreadyFinished: true, source: 'paused', summary: result.summary }
  try {
    writeStateFile(ctx.statePath, loaded.state)
    const check = readStateFile(ctx.statePath, at)
    if (check.state === null || !terminated(check.state, target)) throw new Error('termination did not stick')
  } catch (error) {
    try { writeStateFile(ctx.statePath, before) } catch { /* 原文件已在磁盘上，尽力恢复 */ }
    return { ok: false, reason: 'write-failed', message: error instanceof Error ? error.message : String(error) }
  }
  try {
    const receipts = readReceipts(ctx.statePath)
    ctx.saveConfig({
      ...config,
      pigState: 'paused',
      stateHash: stateFingerprint(loaded.state, receipts),
      lastSummary: mergeSummary(loaded.state),
      localSummary: mergeSummary(loaded.state),
      updatedAt: ctx.now(),
    })
  } catch (error) {
    try { writeStateFile(ctx.statePath, before) } catch { /* 尽力恢复原存档 */ }
    return { ok: false, reason: 'config-write-failed', message: error instanceof Error ? error.message : String(error) }
  }
  return { ok: true, alreadyFinished: result.alreadyFinished, source: 'paused', summary: result.summary }
}

/** 运行中/普通模式：交给本地运行时，在 exclusive 里结算并终结。 */
export async function prepareLiveSource(ctx, target) {
  if (!TARGETS.includes(target)) return { ok: false, reason: 'unknown-target' }
  const runtime = ctx.embedded().ensure()
  if (runtime === undefined || typeof runtime.prepareMerge !== 'function') return { ok: false, reason: 'embedded-unavailable' }
  return runtime.prepareMerge(target)
}
