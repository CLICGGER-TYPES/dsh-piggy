// @ts-check
/**
 * 已安装素材包的只读摘要（给扩展列表用）。不注册资源、不改存档。
 * @module dsh-piggy/store/ext-asset-summary
 */
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { declaredAssetPacks } from './ext-asset-schema.js'
import { actionSummary, soundSummary } from './ext-asset-validate.js'

/**
 * 从已安装目录读一份只读摘要，不重新做 magic/尺寸校验（安装时已经校验过）。
 * 遇到符号链接、非普通文件或读不懂的 pack.json 时在该项上标记 error，不影响扩展本身。
 * @param {string} root 扩展根目录
 * @param {string} key
 * @param {any} manifest
 * @returns {{ actions: any[], sounds: any[], error?: string }}
 */
export function assetPackSummaryFromDisk(root, key, manifest) {
  const declared = declaredAssetPacks(manifest)
  if (declared.problems.length > 0) return { actions: [], sounds: [], error: declared.problems.join('；') }
  /** @type {any[]} */
  const actions = []
  /** @type {any[]} */
  const sounds = []
  const errors = []
  /** @param {string} dir */
  const filesIn = dir => {
    /** @type {Map<string, { size: number, isDirectory: boolean }>} */
    const out = new Map()
    try {
      const stat = lstatSync(dir)
      if (stat.isSymbolicLink() || !stat.isDirectory()) { errors.push(`素材包目录不是普通目录：${dir}`); return out }
    } catch { return out }
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return out }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      try {
        const stat = lstatSync(path)
        if (stat.isSymbolicLink()) { errors.push(`符号链接不允许：${path}`); continue }
        if (stat.isDirectory()) out.set(entry.name, { size: 0, isDirectory: true })
        else if (stat.isFile()) out.set(entry.name, { size: stat.size, isDirectory: false })
        else errors.push(`不是普通文件：${path}`)
      } catch { /* 目录在列举途中消失：忽略这一项 */ }
    }
    return out
  }
  for (const pack of declared.actions) {
    const dir = join(root, key, 'actions', pack)
    const entries = filesIn(dir)
    let actionsCount = 0
    let frames = 0
    let files = 0
    let bytes = 0
    try {
      const stat = lstatSync(join(dir, 'pack.json'))
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular file')
      files += 1
      bytes += stat.size
      const packJson = JSON.parse(readFileSync(join(dir, 'pack.json'), 'utf8'))
      if (Array.isArray(packJson?.actions)) actionsCount = packJson.actions.length
    } catch { errors.push(`读不懂 actions/${pack}/pack.json`) }
    for (const [name, info] of entries) {
      if (name === 'pack.json') continue
      if (!info.isDirectory) continue
      for (const [frameName, frameInfo] of filesIn(join(dir, name))) {
        if (frameInfo.isDirectory || !/^\d{2}\.(?:png|webp)$/.test(frameName)) continue
        frames += 1
        files += 1
        bytes += frameInfo.size
      }
    }
    actions.push(actionSummary(key, pack, actionsCount, frames, files, bytes))
  }
  for (const pack of declared.sounds) {
    const dir = join(root, key, 'sounds', pack)
    const entries = filesIn(dir)
    let soundsCount = 0
    let bytes = 0
    try {
      const stat = lstatSync(join(dir, 'pack.json'))
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular file')
      bytes += stat.size
      const packJson = JSON.parse(readFileSync(join(dir, 'pack.json'), 'utf8'))
      if (Array.isArray(packJson?.sounds)) soundsCount = packJson.sounds.length
    } catch { errors.push(`读不懂 sounds/${pack}/pack.json`) }
    let files = 0
    for (const [name, info] of entries) {
      if (info.isDirectory) continue
      if (name === 'pack.json') { files += 1; continue }
      if (/\.(?:ogg|wav)$/.test(name)) { files += 1; bytes += info.size }
    }
    sounds.push(soundSummary(key, pack, soundsCount, files, bytes))
  }
  return errors.length > 0 ? { actions, sounds, error: errors.join('；') } : { actions, sounds }
}
