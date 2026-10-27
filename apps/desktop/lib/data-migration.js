// @ts-check
/** Copy the old desktop data once; retain originals, publish state last, resume interrupted copies. */
import { createHash } from 'node:crypto'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { acquireGameLock } from './save-owner-lock.js'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const TRANSFER = '.data-migration-v1'
const RECORD = 'data-migration.json'
const SETTINGS = ['window.json', 'proxy.json', 'external.json', 'fullscreen.json', 'versions', 'Local Storage']
const lockFile = name => name.startsWith('state.json.runtime.lock')

function fingerprint(path) {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink()) throw new Error('旧存档目录含符号链接，迁移已停止，原数据保留')
  if (stat.isFile()) return hash(readFileSync(path))
  if (!stat.isDirectory()) throw new Error('旧存档包含不支持的文件，迁移已停止')
  return hash(JSON.stringify(readdirSync(path).sort().map(name => [name, fingerprint(join(path, name))])))
}

function writeJson(path, value) {
  const temp = path + '.tmp'
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
  renameSync(temp, path)
}

/** Called only by the app instance that owns the new profile's single-instance lock. */
export function migrateDesktopData({ userData, legacyUserData }) {
  const transfer = join(userData, TRANSFER), pending = join(transfer, 'plan.json')
  const state = join(userData, 'state.json')
  if (!existsSync(pending) && existsSync(state)) return { migrated: false, reason: 'existing-save' }
  const source = join(legacyUserData, 'dsh-piggy')
  if (!existsSync(pending) && existsSync(join(userData, RECORD))) {
    const completed = JSON.parse(readFileSync(join(userData, RECORD), 'utf8'))
    if (completed.version !== 1 || completed.source !== source) throw new Error('存档迁移记录无效，原数据保留')
    return { migrated: false, reason: 'already-migrated' }
  }
  // Never probe ~/.dsh or another explicit profile for desktop data.
  if (!existsSync(pending) && !existsSync(source)) return { migrated: false, reason: 'no-legacy-data' }
  let plan = existsSync(pending) ? JSON.parse(readFileSync(pending, 'utf8')) : null
  if (plan !== null && (plan.version !== 1 || plan.source !== source || !Array.isArray(plan.entries)
    || plan.entries.some(entry => typeof entry.name !== 'string' || entry.name.includes('/') || entry.name.includes('\\')
      || ['.', '..', RECORD, TRANSFER].includes(entry.name) || !['save', 'profile'].includes(entry.scope)
      || !/^[a-f0-9]{64}$/.test(entry.sha256)))) {
    throw new Error('存档迁移记录无效，已保留所有数据')
  }
  // Same lock protocol as the game runtime: an old running pig must close before migration.
  let release
  try { release = acquireGameLock(join(source, 'state.json')) } catch (error) {
    if (error.message === 'game save already has a live runtime') throw new Error('旧版小猪仍在运行，请先退出后重试迁移。原数据已保留。', { cause: error })
    throw error
  }
  let preparing = null
  try {
    if (plan === null) {
      if (existsSync(transfer)) throw new Error('迁移目录缺少有效记录，已保留原文件')
      preparing = mkdtempSync(join(userData, '.data-migration-prep-'))
      mkdirSync(join(preparing, 'files'), { mode: 0o700 })
      const entries = readdirSync(source).filter(name => !lockFile(name)).map(name => ({ name, from: join(source, name), scope: 'save' }))
      if (resolve(userData) !== resolve(legacyUserData)) {
        for (const name of SETTINGS) if (existsSync(join(legacyUserData, name))) entries.push({ name, from: join(legacyUserData, name), scope: 'profile' })
      }
      if (entries.some(entry => [RECORD, TRANSFER].includes(entry.name))) throw new Error('旧数据存在迁移保留名称，原文件已保留')
      const duplicates = entries.map(entry => entry.name)
      if (new Set(duplicates).size !== duplicates.length) throw new Error('旧存档与设置存在同名项，迁移已停止')
      // No mixing with another pig, even if only an extensions directory already exists.
      for (const entry of entries) if (existsSync(join(userData, entry.name))) throw new Error(`新目录已有 ${entry.name}，迁移未覆盖它`)
      plan = { version: 1, source, entries: [] }
      for (const entry of entries) {
        const before = fingerprint(entry.from), staged = join(preparing, 'files', entry.name)
        cpSync(entry.from, staged, { recursive: true, preserveTimestamps: true })
        if (fingerprint(staged) !== before || fingerprint(entry.from) !== before) throw new Error('复制期间旧数据发生变化，迁移已停止')
        plan.entries.push({ name: entry.name, scope: entry.scope, sha256: before })
      }
      // state.json is the last file published; no runtime may see a half-imported pig.
      plan.entries.sort((a, b) => Number(a.name === 'state.json') - Number(b.name === 'state.json'))
      writeJson(join(preparing, 'plan.json'), plan)
      renameSync(preparing, transfer)
      preparing = null
    }
    for (const entry of plan.entries) {
      const original = join(entry.scope === 'save' ? source : legacyUserData, entry.name)
      if (fingerprint(original) !== entry.sha256) throw new Error('旧数据在迁移中断后发生变化，迁移已停止，所有数据保留')
      const target = join(userData, entry.name), staged = join(transfer, 'files', entry.name)
      if (existsSync(target)) {
        if (fingerprint(target) !== entry.sha256) throw new Error(`迁移目标 ${entry.name} 有冲突，所有数据已保留`)
      } else {
        if (fingerprint(staged) !== entry.sha256) throw new Error('迁移暂存数据校验失败，原数据保留')
        renameSync(staged, target)
      }
    }
    writeJson(join(userData, RECORD), { version: 1, source, originalsRetained: true, entries: plan.entries })
    rmSync(transfer, { recursive: true })
    return { migrated: true, source }
  } finally {
    try { if (preparing !== null) rmSync(preparing, { recursive: true, force: true }) } finally { release() }
  }
}
