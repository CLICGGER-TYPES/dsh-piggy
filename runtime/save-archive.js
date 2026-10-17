// @ts-check
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { migrate } from '../core.js'
import { STATE_VERSION } from '../packages/pet-core/src/core/constants.js'
import { levelFor } from '../packages/pet-core/src/core/clock.js'
import { officialList, isOfficial } from '../store/ext-import.js'
import { assetNames, fileList } from '../store/ext-files.js'
import { REQUIRED_SKIN_SCENES, SKIN_SCENES } from '../packages/pet-core/src/data/skins.js'
import { validateSkinFiles } from '../store/skin-pack.js'
import { validateWorkEvent, workEventKey } from './work-events.js'
import { makeZip, readZip } from './save-zip.js'

const MAX_FILES = 512
// 每个皮肤至少 5 张必需动作图；512 文件上限下不可能有这么多完整皮肤，
// 这个上限只用于挡住「大量空皮肤记录」撑爆快照。
const MAX_SKINS = 128
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const safeKey = /^[a-z0-9-]{2,24}$/
const skinKey = /^[a-z0-9](?:[a-z0-9-]{0,22}[a-z0-9])?$/
const SAFE_SKIN_SVG = Buffer.from('<svg viewBox="0 0 64 64"></svg>')

function skinFilesFor(skin, available) {
  // core 的 ensureSkins() 会按 key 重算 art；沿用存档里的 art 会让校验的文件和导入后实际加载的文件不一致。
  const key = typeof skin?.key === 'string' && skinKey.test(skin.key) ? skin.key : ''
  const art = key === '' ? '' : `custom-${key}`
  if (!art) return { files: new Map(), missing: true }
  const actual = new Map(), validation = new Map([['skin.json', Buffer.from(JSON.stringify({
    key: skin.key, label: skin.label, author: skin.author, description: skin.description, emoji: skin.emoji,
  }))]])
  const found = new Set()
  const declared = new Set(Array.isArray(skin.scenes) ? skin.scenes : [])
  for (const scene of SKIN_SCENES) {
    const stem = `skins/${art}${scene === 'idle' ? '' : '-' + scene}`
    const png = available.get(`${stem}.png`), svg = available.get(`${stem}.svg`)
    if (png && svg) throw new Error(`皮肤 ${skin.key} 的 ${scene} 同时包含 PNG 和 SVG`)
    const body = png ?? svg
    if (!body) {
      if (REQUIRED_SKIN_SCENES.includes(scene)) validation.set(`${scene}.svg`, SAFE_SKIN_SVG)
      continue
    }
    if (!declared.has(scene)) throw new Error(`皮肤 ${skin.key} 含有未登记的 ${scene} 文件`)
    found.add(scene); actual.set(`${stem}${png ? '.png' : '.svg'}`, body)
    validation.set(`${scene}${png ? '.png' : '.svg'}`, body)
  }
  if (found.size === 0) return { files: actual, missing: true }
  const checked = validateSkinFiles(validation)
  if (!checked.ok) throw new Error(`皮肤 ${skin.key} 文件无效：${checked.errors.join('；')}`)
  return { files: actual, missing: REQUIRED_SKIN_SCENES.some(scene => !found.has(scene)) }
}

function collectSkinFiles(root, state) {
  const candidates = new Map(), out = new Map()
  for (const skin of Array.isArray(state.customSkins) ? state.customSkins : []) {
    const key = typeof skin?.key === 'string' && skinKey.test(skin.key) ? skin.key : ''
    if (key === '') continue
    const art = `custom-${key}`
    for (const scene of Array.isArray(skin.scenes) ? skin.scenes : []) if (SKIN_SCENES.includes(scene)) for (const ext of ['png', 'svg']) {
      const relative = `${art}${scene === 'idle' ? '' : '-' + scene}.${ext}`, path = join(root, relative)
      try {
        const stat = lstatSync(path)
        if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 96 * 1024) continue
        candidates.set(`skins/${relative}`, readFileSync(path))
      } catch (error) { if (error?.code !== 'ENOENT') throw error }
    }
  }
  const warnings = []
  for (const skin of Array.isArray(state.customSkins) ? state.customSkins : []) {
    const { files, missing } = skinFilesFor(skin, candidates)
    for (const [name, body] of files) out.set(name, body)
    if (missing) warnings.push(`皮肤 ${skin?.key ?? skin?.art ?? '自定义皮肤'} 缺少图片`)
  }
  return { files: out, warnings }
}

function officialExtensionFiles(root) {
  const result = new Map(), official = officialList()
  if (!existsSync(root)) return result
  for (const key of readdirSync(root)) {
    if (!safeKey.test(key)) continue
    const folder = join(root, key)
    try {
      if (!lstatSync(folder).isDirectory() || lstatSync(folder).isSymbolicLink()) continue
      const manifest = JSON.parse(readFileSync(join(folder, 'manifest.json'), 'utf8'))
      if (manifest?.key !== key) continue
      const assets = assetNames(manifest)
      if (assets === null) continue
      const names = fileList(assets), localFiles = new Map(), hashes = /** @type {Record<string, string>} */ ({})
      let good = true
      for (const name of names) {
        const path = join(folder, name)
        try { const stat = lstatSync(path); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512 * 1024) { good = false; break } }
        catch { good = false; break }
        const body = readFileSync(path); localFiles.set(name, body); hashes[name] = sha(body)
      }
      if (!good || !isOfficial(hashes, key, official, [])) continue
      for (const [name, body] of localFiles) result.set(`extensions/${key}/${name}`, body)
    } catch { /* 不可信、损坏或非官方扩展不作为代码备份 */ }
  }
  return result
}

function summaryFor(state, { gameVersion = '', createdAt = null, legacy = false, warnings = [] } = {}) {
  if (state === null) return { name: '未孵化', level: 1, createdAt, gameVersion, extensions: [], skins: [], legacy, ...(warnings.length ? { warnings: [...warnings] } : {}) }
  return { name: String(state.name ?? state.petName ?? '小猪'), level: levelFor(state.xp),
    createdAt, gameVersion, extensions: Object.keys(state.extData ?? {}).filter(safeKey.test.bind(safeKey)),
    skins: (Array.isArray(state.customSkins) ? state.customSkins : []).map(skin => skin?.key).filter(Boolean),
    legacy, ...(warnings.length ? { warnings: [...warnings] } : {}) }
}

export function createSaveArchive({ statePath, state, gameVersion = '', nowMs = Date.now() }) {
  if (typeof statePath !== 'string' || !statePath || (state !== null && (typeof state !== 'object' || Array.isArray(state)))) throw new Error('没有可备份的有效存档')
  if (state !== null && Array.isArray(state.customSkins) && state.customSkins.length > MAX_SKINS) throw new Error('自定义皮肤数量超过上限')
  const skinOutput = state === null ? { files: new Map(), warnings: [] } : collectSkinFiles(join(dirname(statePath), 'skins'), state)
  const files = new Map([['state.json', Buffer.from(JSON.stringify(state))], ...skinOutput.files])
  if (state !== null) for (const [name, body] of officialExtensionFiles(join(dirname(statePath), 'extensions'))) files.set(name, body)
  const receiptsPath = `${statePath}.work-events/receipts.json`
  try {
    const stat = lstatSync(receiptsPath)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('工作收据必须是普通文件')
    if (stat.size > 8 * 1024 * 1024) throw new Error('工作收据超过大小上限')
    const parsed = JSON.parse(readFileSync(receiptsPath, 'utf8'))
    validateReceipts(parsed)
    files.set('state.json.work-events/receipts.json', Buffer.from(JSON.stringify(parsed)))
  } catch (error) { if (error?.code !== 'ENOENT') throw new Error(`工作收据无效：${error.message}`) }
  const uncompressed = [...files.values()].reduce((sum, body) => sum + body.length, 0)
  if (files.size >= MAX_FILES || uncompressed > 32 * 1024 * 1024 || [...files.values()].some(body => body.length > 8 * 1024 * 1024)) throw new Error('存档内容超过备份上限')
  const manifest = { version: 1, gameVersion, stateVersion: state?.version ?? 0, createdAt: nowMs,
    files: Object.fromEntries([...files].map(([name, body]) => [name, { size: body.length, sha256: sha(body) }])) }
  const manifestBytes = Buffer.from(JSON.stringify(manifest))
  if (uncompressed + manifestBytes.length > 32 * 1024 * 1024 || manifestBytes.length > 8 * 1024 * 1024) throw new Error('存档内容超过备份上限')
  const buffer = makeZip([...files, ['backup.json', manifestBytes]])
  if (buffer.length > 32 * 1024 * 1024) throw new Error('存档 ZIP 超过大小上限')
  const date = new Date(nowMs), pad = value => String(value).padStart(2, '0')
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`
  return { buffer, name: `piggy-save-${day}-${time}.zip`, summary: summaryFor(state, { gameVersion, createdAt: nowMs, warnings: skinOutput.warnings }) }
}

function validateReceipts(value) {
  if (value?.version !== 1 || !Array.isArray(value.receipts) || value.receipts.length > 20000) throw new Error('工作收据无效')
  const seen = new Set()
  for (const receipt of value.receipts) {
    if (!receipt || typeof receipt !== 'object') throw new Error('工作收据无效')
    const { disposition, ...event } = receipt
    validateWorkEvent(event)
    if (!['applied', 'ignored'].includes(disposition) || seen.has(workEventKey(event))) throw new Error('工作收据无效')
    seen.add(workEventKey(event))
  }
}

function validateName(name) {
  if (name === 'state.json' || name === 'backup.json' || name === 'state.json.work-events/receipts.json') return true
  if (/^skins\/custom-[a-z0-9-]{1,41}(?:-(?:bathe|eat|pet|play|relaxed|sleep|study|trip|work))?\.(?:png|svg)$/.test(name)) return true
  return /^extensions\/[a-z0-9-]{2,24}\/(?:manifest\.json|server\.js|client\.js|assets\/[a-z0-9][a-z0-9-]{0,47}\.(?:webp|png))$/.test(name)
}

export function parseSaveArchive(buffer, { nowMs = Date.now() } = {}) {
  // 旧版传输文件就是纯 state.json。
  if (Buffer.isBuffer(buffer) && buffer.length <= 8 * 1024 * 1024 && buffer.toString('utf8').trimStart().startsWith('{')) {
    let parsed; try { parsed = JSON.parse(buffer.toString('utf8')) } catch { throw new Error('旧存档 JSON 损坏') }
    if (Array.isArray(parsed?.customSkins) && parsed.customSkins.length > MAX_SKINS) throw new Error('自定义皮肤数量超过上限')
    const warnings = []
    for (const key of Object.keys(parsed?.extData ?? {})) warnings.push(`扩展 ${key} 缺少程序文件，进度仍会保留`)
    for (const skin of Array.isArray(parsed?.customSkins) ? parsed.customSkins : []) {
      warnings.push(`皮肤 ${skin?.key ?? skin?.art ?? '自定义皮肤'} 缺少图片`)
    }
    return parseState(parsed, { nowMs, legacy: true, files: new Map([['state.json', Buffer.from(JSON.stringify(parsed))]]), warnings })
  }
  const archive = readZip(buffer), manifestBytes = archive.get('backup.json')
  if (!manifestBytes) throw new Error('存档 ZIP 缺少 backup.json')
  let manifest; try { manifest = JSON.parse(manifestBytes.toString('utf8')) } catch { throw new Error('存档清单损坏') }
  if (manifest?.version !== 1 || !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files) ||
    typeof manifest.gameVersion !== 'string' || !Number.isSafeInteger(manifest.stateVersion) ||
    !Number.isSafeInteger(manifest.createdAt) || manifest.createdAt < 0) throw new Error('不支持的存档 ZIP 格式')
  if (Object.keys(manifest.files).length !== archive.size - 1) throw new Error('存档文件清单不匹配')
  const files = new Map([...archive].filter(([name]) => name !== 'backup.json'))
  for (const [name, body] of files) {
    const record = manifest.files[name]
    if (!validateName(name) || !record || record.size !== body.length || record.sha256 !== sha(body)) throw new Error('存档文件校验失败')
  }
  const stateBytes = files.get('state.json'); if (!stateBytes) throw new Error('存档缺少 state.json')
  let state; try { state = JSON.parse(stateBytes.toString('utf8')) } catch { throw new Error('state.json 损坏') }
  if (Array.isArray(state?.customSkins) && state.customSkins.length > MAX_SKINS) throw new Error('自定义皮肤数量超过上限')
  if ((state?.version ?? 0) !== manifest.stateVersion) throw new Error('存档版本清单不匹配')
  const warnings = []
  const receiptsPath = 'state.json.work-events/receipts.json'
  if (files.has(receiptsPath)) {
    try { validateReceipts(JSON.parse(files.get(receiptsPath).toString('utf8'))) } catch { throw new Error('工作收据无效') }
  }
  const extensionKeys = new Set([...files.keys()].map(name => name.match(/^extensions\/([^/]+)\//)?.[1]).filter(Boolean))
  for (const key of extensionKeys) {
    const prefix = `extensions/${key}/`, extFiles = new Map([...files].filter(([name]) => name.startsWith(prefix)).map(([name, body]) => [name.slice(prefix.length), body]))
    try {
      const manifestObj = JSON.parse(extFiles.get('manifest.json')?.toString('utf8') ?? '')
      const assets = assetNames(manifestObj), hashes = Object.fromEntries([...extFiles].map(([name, body]) => [name, sha(body)]))
      if (manifestObj?.key !== key || assets === null || !fileList(assets).every(name => extFiles.has(name)) || extFiles.size !== fileList(assets).length || !isOfficial(hashes, key, officialList(), [])) throw new Error()
    } catch {
      for (const name of [...files.keys()]) if (name.startsWith(prefix)) files.delete(name)
      warnings.push(`扩展 ${key} 无法验证，将保留进度并需重新安装`)
    }
  }
  for (const key of Object.keys(state?.extData ?? {})) if (!extensionKeys.has(key)) warnings.push(`扩展 ${key} 缺少程序文件，进度仍会保留`)
  const skinCandidates = new Map([...files].filter(([name]) => name.startsWith('skins/')))
  const validatedSkinFiles = new Set()
  for (const skin of Array.isArray(state?.customSkins) ? state.customSkins : []) {
    const { files: validated, missing } = skinFilesFor(skin, skinCandidates)
    for (const name of validated.keys()) {
      if (!skinCandidates.has(name)) throw new Error('皮肤文件清单无效')
      validatedSkinFiles.add(name)
    }
    if (missing) warnings.push(`皮肤 ${skin?.key ?? skin?.art ?? '自定义皮肤'} 缺少图片`)
  }
  for (const [name] of skinCandidates) if (!validatedSkinFiles.has(name)) throw new Error('存档含有未登记或未校验的皮肤文件')
  return parseState(state, { nowMs, legacy: false, files, warnings, gameVersion: manifest.gameVersion ?? '', createdAt: manifest.createdAt ?? null })
}

function parseState(input, { nowMs, legacy, files, warnings = [], gameVersion = '', createdAt = null }) {
  if (input === null) {
    if (legacy) throw new Error('旧 JSON 存档内容无效')
    files.set('state.json', Buffer.from('null'))
    return { state: null, files, summary: summaryFor(null, { gameVersion, createdAt, legacy, warnings }), warnings }
  }
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('存档内容无效')
  if (Array.isArray(input.customSkins) && input.customSkins.length > MAX_SKINS) throw new Error('自定义皮肤数量超过上限')
  if (input.version !== undefined && (!Number.isSafeInteger(input.version) || input.version < 0)) throw new Error('存档版本无效')
  if (input.version > STATE_VERSION) throw new Error('存档版本高于当前支持版本')
  const state = migrate(structuredClone(input), nowMs)
  if (!state) throw new Error('存档内容无效')
  files.set('state.json', Buffer.from(JSON.stringify(state)))
  return { state, files, summary: summaryFor(state, { gameVersion, createdAt, legacy, warnings }), warnings }
}
