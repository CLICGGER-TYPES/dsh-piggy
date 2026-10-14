// @ts-check
/**
 * 存档的读写：原子写、损坏时保留现场。这一层不含任何业务规则。
 *
 * @module dsh-piggy/store/state-file
 */
import { closeSync, cpSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync, writeSync } from 'node:fs'
import { homedir } from 'node:os'
import { isDeepStrictEqual } from 'node:util'
import { dirname, join, resolve } from 'node:path'

import { STATE_VERSION, migrate } from '../core.js'

/** 存档这一层的日志往日志本里记一份；没有日志本（测试）就只留 console。 */
function report(journal, event) {
  if (journal === undefined || journal === null) return
  const { level = 'warn', message, ...fields } = event
  journal.record(level, 'save', message, fields)
}

/** The harness home, matching the launcher's own resolution. */
export function dshHome() {
  const configured = process.env.DSH_HOME
  return configured !== undefined && configured.trim() !== ''
    ? resolve(configured.trim())
    : join(homedir(), '.dsh')
}

/** Default save location. */
export function defaultStatePath() {
  return join(dshHome(), 'dsh-piggy', 'state.json')
}

/**
 * The save used to live in `$DSH_HOME/dsh-pig/`. Move it to `dsh-piggy/` once:
 * copy the whole folder (backups too), then rename the old one aside rather
 * than deleting it. Does nothing when the new folder already exists.
 * @returns {string | null} where the old folder went, or null if nothing moved
 */
export function moveLegacySaveDir(home = dshHome(), nowMs = Date.now()) {
  const fresh = join(home, 'dsh-piggy')
  const legacy = join(home, 'dsh-pig')
  if (existsSync(fresh) || !existsSync(legacy)) return null
  try {
    cpSync(legacy, fresh, { recursive: true, errorOnExist: true })
    const aside = `${legacy}.moved-${new Date(nowMs).toISOString().replace(/[:.]/g, '-')}`
    renameSync(legacy, aside)
    console.warn(`[dsh-piggy] save folder moved: "${legacy}" -> "${fresh}" (old folder kept as "${aside}")`)
    return aside
  } catch (error) {
    console.warn(`[dsh-piggy] could not move the old save folder: reason="${error instanceof Error ? error.message : String(error)}"`)
    return null
  }
}

/** Copy an unusable save next to the original, then complain loudly. */
function preserveUnusableSave(context, raw, reason) {
  const { filePath, nowMs, journal } = context
  const backup = `${filePath}.corrupt-${new Date(nowMs).toISOString().replace(/[:.]/g, '-')}`
  try {
    writeFileSync(backup, raw)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.warn(`[dsh-piggy] save unusable (${reason}) and the backup failed: path="${filePath}" reason="${detail}"`)
    report(journal, { level: 'error', message: '存档坏了，备份也失败', path: filePath, reason, detail })
    return
  }
  console.warn(`[dsh-piggy] save unusable (${reason}); kept a copy at "${backup}" and left the original untouched`)
  report(journal, { level: 'error', message: '存档坏了，已留副本', path: filePath, backup, reason })
}

/**
 * Keep a copy of a save before it is upgraded to a newer version.
 *
 * An upgrade rewrites the file on the next save; if a step turns out to be
 * wrong, this copy is the only way back to the pig as it was.
 */
function keepPreUpgradeCopy(context, raw, fromVersion) {
  const { filePath, nowMs, journal } = context
  const backup = `${filePath}.v${fromVersion}-backup-${new Date(nowMs).toISOString().replace(/[:.]/g, '-')}`
  try {
    writeFileSync(backup, raw)
    console.warn(`[dsh-piggy] upgrading save v${fromVersion} -> v${STATE_VERSION}; kept a copy at "${backup}"`)
    report(journal, { level: 'info', message: '升级存档，升级前留了副本', from: fromVersion, to: STATE_VERSION, backup })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.warn(`[dsh-piggy] upgrading save v${fromVersion} -> v${STATE_VERSION} without a backup: path="${filePath}" reason="${detail}"`)
    report(journal, { level: 'warn', message: '升级存档时没能留副本', from: fromVersion, to: STATE_VERSION, path: filePath, reason: detail })
  }
}

/**
 * Read the save, keeping the evidence when it cannot be used.
 *
 * A bare `catch { return null }` used to turn a corrupt or unreadable save into
 * "no pig" — the pig silently vanished and the next write would have buried the
 * old file.
 *
 * @returns {{ state: object|null, needsSave: boolean }} the migrated state (or
 *   null) and whether the file was on an older version and wants a rewrite.
 */
export function readStateFile(filePath, nowMs, journal) {
  const context = { filePath, nowMs, journal }
  let raw
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (error) {
    // A missing save is the normal first run; anything else is worth saying.
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
    if (code !== 'ENOENT') {
      const detail = error instanceof Error ? error.message : String(error)
      console.warn(`[dsh-piggy] could not read save: path="${filePath}" reason="${detail}"`)
      report(journal, { level: 'error', message: '存档读不出来', path: filePath, reason: detail })
    }
    return { state: null, needsSave: false }
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    preserveUnusableSave(context, raw, `invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
    return { state: null, needsSave: false }
  }

  const beforeMigration = structuredClone(parsed)
  const upgraded = migrate(parsed, nowMs)
  if (upgraded === null) {
    preserveUnusableSave(context, raw, 'migrate() rejected the shape')
    return { state: null, needsSave: false }
  }
  const onDisk = parsed?.version
  if (typeof onDisk === 'number' && onDisk < STATE_VERSION) keepPreUpgradeCopy(context, raw, onDisk)
  return { state: upgraded, needsSave: !isDeepStrictEqual(beforeMigration, upgraded) }
}

/** Atomic write: temp file → fsync → rename. */
export function writeStateFile(filePath, state) {
  mkdirSync(dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp`
  const fd = openSync(tmp, 'w')
  try {
    writeSync(fd, JSON.stringify(state, null, 2))
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(tmp, filePath)
}
