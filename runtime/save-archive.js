// @ts-check
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { migrate } from '../core.js'
import { STATE_VERSION } from '../packages/pet-core/src/core/constants.js'
import { MERGE_RULES_VERSION } from '../packages/pet-core/src/core/merge-rules.js'
import { levelFor } from '../packages/pet-core/src/core/clock.js'
import { officialList, isOfficial } from '../store/ext-import.js'
import { assetNames, fileList } from '../store/ext-files.js'
import { REQUIRED_SKIN_SCENES, SKIN_SCENES } from '../packages/pet-core/src/data/skins.js'
import { validateSkinFiles } from '../store/skin-pack.js'
import { validateWorkEvent, workEventKey } from './work-events.js'
import { makeZip, readZip } from './save-zip.js'
import { assertStatePathLayout } from './save-layout.js'

const MAX_FILES = 512
// 每个皮肤至少 5 张必需动作图；512 文件上限下不可能有这么多完整皮肤，
// 这个上限只用于挡住「大量空皮肤记录」撑爆快照。
const MAX_SKINS = 128
// 旧版导入以前只确认“是一个 JSON 对象”，ZIP 里的 backup.json 清单、窗口/代理配置或扩展包
// 也会被 migrate() 补成一只 500 金币的默认猪，整档替换用户的小猪。识别规则按历代存档形状
// （packages/pet-core/src/core/{egg,migrate,upgrades,profile,daily,diary}.js 与
// test/fixtures/state-v7-real.json 的真实 v7 存档）分两档：
//   A. 核心字段：出生/成长/照料/背包/统计这类只有小猪存档才有的进度、生命周期或结构化集合，
//      值的类型对得上，有一个就足以说明「这只猪活过」。
//   B. 最小存档形状：历史/手改档最少的 {name, version, coins} —— 非空 name + 数值 coins
//      同时存在才算进度存档。coins 单独、name/skin/stage/work/daily/seed 任意组合都不算；
//      通用字段不能替代 A 档的核心证据。
// customSkins 只有类型确实是数组时才算结构化存档字段；null/数字/字符串等畸形值本身不能
// 证明这是存档，也不能因此补出默认猪。数组里的畸形记录仍由 migrate()/ensureSkins() 清洗成 []。
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value)
const isNonEmptyString = value => typeof value === 'string' && value.trim() !== ''
const isBoolean = value => typeof value === 'boolean'
const isPlainObject = value => typeof value === 'object' && value !== null && !Array.isArray(value)
const SAVE_CORE_NUMBERS = new Set([
  'ageMs', 'bornAt', 'cleanliness', 'clockRollbackAt', 'criticalDoctorVisits', 'diedAt', 'happiness', 'health',
  'lastActiveAt', 'lastFedAt', 'lastSeenAt', 'outingStreak', 'pendingSeq', 'restMinutes', 'riskMinutes',
  'satiety', 'settledUpTo', 'weightG', 'xp',
])
const SAVE_CORE_BOOLEANS = new Set(['dead', 'hatched'])
const SAVE_CORE_OBJECTS = new Set([
  'achievements', 'bodyWeight', 'cooldowns', 'courses', 'coursesByStage', 'dex', 'dialogue', 'diary', 'economy',
  'extData', 'extensions', 'fishing', 'interests', 'inventory', 'lessons', 'lessonsByStage', 'pomodoro',
  'realWorkGrowth', 'stats', 'traits', 'wallets',
])
const SAVE_CORE_ARRAYS = new Set(['customSkins', 'dress', 'memories', 'pending', 'souvenirs', 'worn'])
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
    skins: (Array.isArray(state.customSkins) ? state.customSkins : []).map(skin => skin?.key).filter(key => typeof key === 'string'), legacy, ...(warnings.length ? { warnings: [...warnings] } : {}) }
}

export function createSaveArchive({ statePath, state, gameVersion = '', nowMs = Date.now() }) {
  if (typeof statePath !== 'string' || !statePath || (state !== null && (typeof state !== 'object' || Array.isArray(state)))) throw new Error('没有可备份的有效存档')
  assertStatePathLayout(statePath)
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
  const manifest = { version: 1, gameVersion, stateVersion: state?.version ?? 0, mergeRulesVersion: MERGE_RULES_VERSION, createdAt: nowMs,
    files: Object.fromEntries([...files].map(([name, body]) => [name, { size: body.length, sha256: sha(body) }])) }
  const manifestBytes = Buffer.from(JSON.stringify(manifest))
  if (uncompressed + manifestBytes.length > 32 * 1024 * 1024 || manifestBytes.length > 8 * 1024 * 1024) throw new Error('存档内容超过备份上限')
  const buffer = makeZip([...files, ['backup.json', manifestBytes]])
  if (buffer.length > 32 * 1024 * 1024) throw new Error('存档 ZIP 超过大小上限')
  // 文件名和界面里的“备份时间”都按本机时区显示；用 UTC 会让用户看到早/晚几个小时的备份。
  const date = new Date(nowMs), pad = value => String(value).padStart(2, '0')
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
  return { buffer, name: `piggy-save-${stamp}.zip`, summary: summaryFor(state, { gameVersion, createdAt: nowMs, warnings: skinOutput.warnings }) }
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
    for (const skin of Array.isArray(parsed?.customSkins) ? parsed.customSkins : []) warnings.push(`皮肤 ${skin?.key ?? skin?.art ?? '自定义皮肤'} 缺少图片`)
    const legacyParsed = parseState(parsed, { nowMs, legacy: true, files: new Map([['state.json', Buffer.from(JSON.stringify(parsed))]]), warnings })
    return { ...legacyParsed, stateVersion: Number.isSafeInteger(parsed?.version) ? parsed.version : 0, mergeRulesVersion: MERGE_RULES_VERSION }
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
  const validatedSkinFiles = new Set(), validatedSkinRecords = new Set(), unbackedSkins = []
  const rawSkins = Array.isArray(state?.customSkins) ? state.customSkins : []
  for (const skin of rawSkins) {
    const { files: validated, missing } = skinFilesFor(skin, skinCandidates)
    for (const name of validated.keys()) {
      if (!skinCandidates.has(name)) throw new Error('皮肤文件清单无效')
      validatedSkinFiles.add(name)
    }
    // skinFilesFor 按 key 推导 art；迁移后仍存在的皮肤键必须和这份文件清单一一对应。
    if (typeof skin?.key === 'string' && skin.key !== '') {
      if (validated.size > 0) validatedSkinRecords.add(skin.key)
      else unbackedSkins.push(skin)
    }
    if (missing) warnings.push(`皮肤 ${skin?.key ?? skin?.art ?? '自定义皮肤'} 缺少图片`)
  }
  for (const [name] of skinCandidates) if (!validatedSkinFiles.has(name)) throw new Error('存档含有未登记或未校验的皮肤文件')
  const parsed = parseState(state, { nowMs, legacy: false, files, warnings, gameVersion: manifest.gameVersion ?? '', createdAt: manifest.createdAt ?? null })
  // 迁移会把 art 固定成 custom-<key>，也会丢掉缺必需场景的记录；校验和实际写入必须对同一份皮肤。
  const migratedRecords = new Set((parsed.state?.customSkins ?? []).map(skin => skin.key))
  for (const key of validatedSkinRecords) {
    if (!migratedRecords.has(key)) throw new Error(`皮肤 ${key} 的记录在迁移后不可用，请检查存档`)
  }
  // 没有自己图片的记录如果占着另一个 art 名（两条记录共用一个 art），迁移后只剩记录没有图片。
  for (const skin of unbackedSkins) {
    const art = typeof skin.art === 'string' ? skin.art : ''
    if (art === '') continue
    const prefix = `skins/${art}`, claimed = [...skinCandidates.keys()].some(name =>
      name.startsWith(prefix) && ['.', '-'].includes(name[prefix.length]))
    if (claimed) throw new Error(`皮肤 ${skin.key} 的记录在迁移后没有可用图片，请检查存档`)
  }
  return { ...parsed, stateVersion: manifest.stateVersion, mergeRulesVersion: Number.isInteger(manifest.mergeRulesVersion) ? manifest.mergeRulesVersion : MERGE_RULES_VERSION }
}

// 明确的非存档文档：导出包自己的 backup.json 清单和扩展包。必须在 migrate()/补默认值之前拒绝。
function assertNotForeignDocument(input) {
  if (isPlainObject(input.files) && Number.isSafeInteger(input.stateVersion) && typeof input.gameVersion === 'string') {
    throw new Error('这不是可识别的小猪存档，它看起来是存档 ZIP 里的 backup.json；请导入完整 ZIP 或其中的 state.json')
  }
  if (input.format === 'dsh-piggy-extension') throw new Error('这不是可识别的小猪存档，它看起来是扩展包')
}

// 空对象、窗口/代理配置、安装器回执、工作收据等任意宿主文档都不带任何存档证据，不能补成默认猪。
function assertRecognizableSave(input) {
  const core = [...SAVE_CORE_NUMBERS].some(key => isFiniteNumber(input[key]))
    || [...SAVE_CORE_BOOLEANS].some(key => isBoolean(input[key]))
    || [...SAVE_CORE_OBJECTS].some(key => isPlainObject(input[key]))
    || [...SAVE_CORE_ARRAYS].some(key => Array.isArray(input[key]))
  if (core) return
  // 唯一允许的最小存档形状：{name, version, coins}（name 非空 + coins 数值）。
  // coins 单独、name/skin/stage/work/daily/seed 的任意组合都不算存档。
  if (isNonEmptyString(input.name) && isFiniteNumber(input.coins)) return
  throw new Error('这不是可识别的小猪存档，请选择由小猪导出的 ZIP 或其中的 state.json')
}

function parseState(input, { nowMs, legacy, files, warnings = [], gameVersion = '', createdAt = null }) {
  if (input === null) {
    if (legacy) throw new Error('旧 JSON 存档内容无效')
    files.set('state.json', Buffer.from('null'))
    return { state: null, files, summary: summaryFor(null, { gameVersion, createdAt, legacy, warnings }), warnings }
  }
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('存档内容无效')
  if (Array.isArray(input.customSkins) && input.customSkins.length > MAX_SKINS) throw new Error('自定义皮肤数量超过上限')
  assertNotForeignDocument(input)
  if (input.version !== undefined && (!Number.isSafeInteger(input.version) || input.version < 0)) throw new Error('存档版本无效')
  if (input.version > STATE_VERSION) throw new Error('存档版本高于当前支持版本')
  assertRecognizableSave(input)
  const state = migrate(structuredClone(input), nowMs)
  if (!state) throw new Error('存档内容无效')
  files.set('state.json', Buffer.from(JSON.stringify(state)))
  return { state, files, summary: summaryFor(state, { gameVersion, createdAt, legacy, warnings }), warnings }
}
