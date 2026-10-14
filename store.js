// @ts-check
/**
 * The pig's save: open it, keep the pig's whole state in memory, and write it
 * back on a throttle.
 *
 * Only IO and lifetime live here — the method table is in store/api.js and the
 * actual game rules are in core/ (see docs/CONVENTIONS.md).
 *
 * @module dsh-piggy/store
 */
import { dirname } from 'node:path'

import { settleAchievements } from './core.js'
import { createApi } from './store/api.js'
import { createJournal } from './store/journal.js'
import { defaultStatePath, dshHome, moveLegacySaveDir, readStateFile, writeStateFile } from './store/state-file.js'

export { defaultStatePath, dshHome, moveLegacySaveDir }

const SAVE_THROTTLE_MS = 1500

/**
 * Open (or lazily create on first hatch) the save file.
 * @param {string} [filePath] - where the save lives.
 * @param {object} [options] - test seams.
 * @param {() => number} [options.now] - injectable clock.
 * @param {Function} [options.setTimer] - injectable scheduler.
 * @param {Function} [options.clearTimer] - injectable canceller.
 * @param {object} [options.journal] - 自定义日志本（测试或桌面外壳用）。
 */
export function createStore(filePath = defaultStatePath(), options = {}) {
  const now = options.now ?? (() => Date.now())
  const setTimer = options.setTimer ?? setTimeout
  const clearTimer = options.clearTimer ?? clearTimeout
  // 日志落在存档旁边：用户报问题时要的就是这个目录里的东西。
  const journal = options.journal ?? createJournal({ dir: typeof filePath === 'string' ? dirname(filePath) : '', now })
  const report = (level, scope, message, fields) => journal.record(level, scope, message, fields)

  let dirty = false
  let timer = null
  let state = null

  function scheduleSave() {
    if (state !== null) settleAchievements(state, now())
    dirty = true
    if (timer !== null) return
    timer = setTimer(() => {
      timer = null
      try {
        writeNow()
      } catch (error) {
        // A failed write must not break the harness, but it must not be silent
        // either: the player would keep playing against a save that is not there.
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[dsh-piggy] save failed: path="${filePath}" reason="${reason}"`)
        report('error', 'save', '存档写入失败', { path: filePath, reason })
      }
    }, SAVE_THROTTLE_MS)
    if (typeof timer?.unref === 'function') timer.unref()
  }

  function writeNow() {
    if (!dirty || state === null) return
    writeStateFile(filePath, state)
    dirty = false
  }

  /** Run a core mutator, saving when it reports success. */
  function mutate(fn) {
    if (state === null) return { ok: false, reason: 'absent' }
    // A core call that throws halfway used to leave the half-applied state in
    // memory — and the next save wrote it out. Snapshot first, restore on throw.
    const before = structuredClone(state)
    try {
      const result = fn(state)
      scheduleSave()
      return result
    } catch (error) {
      state = before
      const message = error instanceof Error ? error.message : String(error)
      // 这里以前什么都不留：规则抛错时用户只看到「没成」，事后无从查起。
      console.warn(`[dsh-piggy] core mutator threw and the change was rolled back: reason="${message}"`)
      report('error', 'core', '规则抛错，改动已回滚', { reason: message, stack: error instanceof Error ? error.stack : '' })
      return { ok: false, reason: 'error', message }
    }
  }

  const opened = readStateFile(filePath, now(), journal)
  state = opened.state
  dirty = opened.needsSave
  report('info', 'save', '存档打开', { path: filePath, version: state?.version ?? null, hatched: state !== null, needsSave: dirty })

  const api = createApi({
    filePath,
    now,
    journal,
    getState: () => state,
    setState: next => { state = next },
    scheduleSave,
    mutate,
    dispose() {
      if (timer !== null) {
        clearTimer(timer)
        timer = null
      }
      try {
        writeNow()
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[dsh-piggy] final save failed: path="${filePath}" reason="${reason}"`)
        report('error', 'save', '退出前最后一次写入失败', { path: filePath, reason })
      }
    },
  })
  return Object.assign(api, {
    /** 工作事务先保存基线并撤下节流计时器，失败后不能再写回旧状态。 */
    flush(force = false) {
      if (timer !== null) { clearTimer(timer); timer = null }
      if (force && state !== null) dirty = true
      writeNow()
    },
    /** 仅由游戏运行时在持久提交后安装状态，不重新结算或安排写盘。 */
    installCommittedState(next) { state = next; dirty = false },
  })
}
