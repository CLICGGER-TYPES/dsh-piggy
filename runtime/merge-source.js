// @ts-check
/**
 * 合并的源/目标存档工具：空目标、皮肤哈希、源 ZIP 文件映射。
 *
 * @module dsh-piggy/runtime/merge-source
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { layEgg } from '../packages/pet-core/src/core/egg.js'
import { migrate } from '../packages/pet-core/src/core/migrate.js'

/** 目标没有存档时的空底：不凭空给纸盒的 500 金币/初始物品（#14 6.1 全量搬迁）。 */
export function emptyMergeTarget(nowMs) {
  const state = migrate(layEgg(nowMs), nowMs)
  if (state === null) throw new Error('empty merge target failed')
  state.hatched = false
  state.dead = false
  state.diedAt = null
  state.name = '未孵化'
  state.coins = 0
  state.inventory = {}
  state.dress = []
  state.worn = []
  state.xp = 0
  state.weightG = 0
  state.ageMs = 0
  state.satiety = 0
  state.happiness = 0
  state.cleanliness = 0
  state.health = 0
  state.stats = Object.fromEntries(Object.keys(state.stats).map(key => [key, 0]))
  state.dex = { forms: {}, skins: {}, fish: {}, items: {}, souvenirs: {} }
  state.souvenirs = []
  state.daily = { signIn: { lastDay: null, index: 0, total: 0, cycle7: true }, online: { day: null, onlineMs: 0, given: 0, unclaimed: 0 } }
  state.diary = { entries: [], today: { day: null, counts: {} } }
  state.economy = { totals: {}, days: [], fatigue: 0 }
  state.wallets = {}
  state.customSkins = []
  state.skin = 'default'
  state.extensions = {}
  state.extensionsRemoved = []
  state.extData = {}
  state.achievements = { unlocked: {}, totals: {}, seen: {}, events: {} }
  state.memories = []
  state.pending = []
  state.profileEdits = 0
  return state
}

/** 读取目标存档目录里的自定义皮肤文件哈希（元数据 + 文件内容）。 */
/** @returns {Record<string,string>} */
export function skinHashes(statePath, skins) {
  const directory = join(dirname(statePath), 'skins')
  const hashes = /** @type {Record<string,string>} */ ({})
  let names = []
  try { names = readdirSync(directory) } catch (error) { if (error?.code !== 'ENOENT') throw error }
  for (const skin of Array.isArray(skins) ? skins : []) {
    if (typeof skin?.key !== 'string' || skin.key === '') continue
    const prefix = `custom-${skin.key}`
    const files = names.filter(name => (name === `${prefix}.png` || name === `${prefix}.svg` || name.startsWith(`${prefix}-`)) && /\.(png|svg)$/.test(name)).sort()
    if (files.length === 0) continue
    const digest = createHash('sha256')
    digest.update(JSON.stringify({ key: skin.key, label: skin.label, author: skin.author, description: skin.description, emoji: skin.emoji, scenes: skin.scenes, contact: skin.contact ?? null }))
    for (const name of files) { digest.update(name); digest.update(readFileSync(join(directory, name))) }
    hashes[skin.key] = digest.digest('hex')
  }
  return hashes
}

/** 从源 ZIP 的文件清单里算皮肤哈希；没有文件的皮肤不登记。 */
/** @returns {Record<string,string>} */
export function archiveSkinHashes(files, skins) {
  const hashes = /** @type {Record<string,string>} */ ({})
  for (const skin of Array.isArray(skins) ? skins : []) {
    if (typeof skin?.key !== 'string' || skin.key === '') continue
    const prefix = `skins/custom-${skin.key}`
    const entries = [...files.entries()].filter(([name]) => name === `${prefix}.png` || name === `${prefix}.svg` || name.startsWith(`${prefix}-`)).sort((a, b) => (a[0] < b[0] ? -1 : 1))
    if (entries.length === 0) continue
    const digest = createHash('sha256')
    digest.update(JSON.stringify({ key: skin.key, label: skin.label, author: skin.author, description: skin.description, emoji: skin.emoji, scenes: skin.scenes, contact: skin.contact ?? null }))
    for (const [name, body] of entries) { digest.update(name); digest.update(body) }
    hashes[skin.key] = digest.digest('hex')
  }
  return hashes
}

export function mapSkinFiles(files, copies) {
  const out = new Map()
  for (const copy of Array.isArray(copies) ? copies : []) {
    for (const [name, body] of files.entries()) {
      if (!name.startsWith('skins/')) continue
      const stem = name.slice('skins/'.length).replace(/\.(png|svg)$/, '')
      const match = new RegExp(`^${copy.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:-(?:bathe|eat|pet|play|relaxed|sleep|study|trip|work))?$`).exec(stem)
      if (match === null) continue
      const next = name.replace(`skins/${copy.from}`, `skins/${copy.to}`)
      out.set(next, body)
    }
  }
  return out
}

export function safeSourceBackup(name) {
  return typeof name === 'string' && /^[A-Za-z0-9._-]{1,120}$/.test(name) && basename(name) === name ? name : null
}

