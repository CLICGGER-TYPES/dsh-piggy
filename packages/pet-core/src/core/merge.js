// @ts-check
/**
 * 一次性合并：把 DSH 内嵌存档（S）按字段并进桌面存档（T）。
 *
 * 纯函数：不读文件、不读时钟。皮肤文件哈希、扩展合并钩子和两边收据由宿主
 * 传进来（runtime/merge-service.js）。结果只为「写盘」服务；预览和提交都调用
 * 同一个函数，保证两边算出来的是同一份规则。
 *
 * @module dsh-piggy/core/merge
 */

import { xpForLevel } from '../data.js'
import { settleAchievements } from './achievements.js'
import { lifeStageFor, raiseSettledUpTo } from './clock.js'
import { STATE_VERSION } from './constants.js'
import { capForIllness, mergeBodyWeight, mergeCooldowns, mergeDialogue, mergeExtensions, mergeIllness, mergeRealWorkGrowth, sumMap, maxMap } from './merge-fields.js'
import { mergeAchievements, mergeCustomSkins, mergeDiary, mergeDiaryToday, mergeEconomy, mergeFishing, mergeMemories, mergeOnline, mergePomodoro, mergeSignIn, mergeSouvenirs, mergeWallets, mergeDexSection } from './merge-collections.js'
import { applyChoices, describeChoices, describeExtensionConflicts, normalizeChoices } from './merge-identity.js'
import { DUPLICATE_OPTIONS, autoMergeLines, duplicateReport, editorLists, flatSide, groupedSide, levelOf, summaryOf } from './merge-report.js'
import { DYNAMIC_MAP_RULES, MERGE_RECEIPT_LIMIT, MERGE_RULES, aliveHatched, baseSide, duplicateOf, isObject, lifeSide, maxNum, mergeBlockers, minNum, num, sumCap, whole } from './merge-rules.js'

const valueOf = (state, key, fallback = 0) => (Number.isFinite(state?.[key]) ? state[key] : fallback)

/**
 * T 是写入方：同版本下 T 有、规则表没有的字段原样保留（#14 附录 C 第 5 条）。
 * 动态 map 的子 key 已经按 map 规则合并，不再递归。
 */
function preserveTargetUnknown(T, merged, rules, prefix) {
  for (const [key, value] of Object.entries(isObject(T) ? T : {})) {
    const path = prefix === '' ? key : `${prefix}.${key}`
    const rule = rules?.[key]
    if (rule === undefined) {
      if (merged[key] === undefined && !Object.hasOwn(DYNAMIC_MAP_RULES, path)) merged[key] = structuredClone(value)
      continue
    }
    if (isObject(rule) && isObject(value) && isObject(merged[key])) preserveTargetUnknown(value, merged[key], rule, path)
  }
}

/** 合并拒绝：code 给界面/HTTP 判分支，details 只放可读数据。 */
export class MergeError extends Error {
  constructor(code, message, details = null) {
    super(message)
    this.name = 'MergeError'
    this.code = code
    this.details = details
  }
}

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * 前置条件：两边都必须是迁移后的 v15 存档、没有进行中的活动/番茄/钓鱼。
 * 拒绝时 details 带 #14 4.4 需要的真实细节（活动类型、phase、退款、鱼饵），
 * 界面据此显示精确文案；`nowMs` 省略时按「没到点」处理。
 */
export function assertMergeable(T, S, nowMs = 0) {
  if (!isObject(T) || !isObject(S)) throw new MergeError('invalid-state', '合并需要两边的存档')
  if (T.version > STATE_VERSION || S.version > STATE_VERSION) throw new MergeError('version-too-new', '有一边的存档版本比当前游戏新')
  if (aliveHatched(T) !== true && aliveHatched(S) !== true) throw new MergeError('no-living-pig', '至少需要一只活着且已孵化的小猪')
  const blocker = mergeBlockers(T, S, nowMs)[0]
  if (blocker === undefined) return
  const where = blocker.side === 'source' ? '内嵌猪' : '桌面上的猪'
  const what = blocker.reason === 'pomodoro' ? '还在专注' : blocker.reason === 'fishing' ? '还在钓鱼' : '还有没结束的活动'
  throw new MergeError(blocker.reason, `${where}${what}`, blocker)
}

/** 每晚一条收据：(source,id) 并集；同 key 不同 type/at 保留 T 并警告；窗口外剔除。 */
export function mergeReceipts(target, source, nowMs) {
  const out = []
  const seen = new Map()
  const warnings = []
  const wanted = Array.isArray(target) ? target : []
  const extra = Array.isArray(source) ? source : []
  const inWindow = receipt => Number.isFinite(receipt?.at) && receipt.at >= nowMs - WINDOW_MS && receipt.at <= nowMs + 5 * 60_000
  for (const receipt of [...wanted, ...extra]) {
    if (!inWindow(receipt)) continue
    const key = JSON.stringify([receipt.source, receipt.id])
    const before = seen.get(key)
    if (before === undefined) {
      seen.set(key, receipt)
      out.push(receipt)
      continue
    }
    if (before.type !== receipt.type || before.at !== receipt.at) warnings.push(`工作收据 ${receipt.source}/${receipt.id} 两边内容不同，保留桌宠的`)
  }
  if (out.length > MERGE_RECEIPT_LIMIT) throw new MergeError('too-many-receipts', `合并后的工作收据超过 ${MERGE_RECEIPT_LIMIT} 条`)
  return { receipts: out, warnings }
}

/**
 * 合并主函数。
 * @param {any} target
 * @param {any} source
 * @param {{nowMs:number, choices?:any, targetSkins?:Record<string,string>, sourceSkins?:Record<string,string>,
 *   targetReceipts?:any[], sourceReceipts?:any[], hooks?:Record<string,Function>, targetInstalled?:string[],
 *   silentBadges?:boolean, sourceInstalled?:string[], hasTargetPresent?:boolean}} options
 */
export function mergeSaveStates(target, source, options) {
  const T = target
  const S = source
  const nowMs = options.nowMs
  assertMergeable(T, S, nowMs)
  const duplicate = duplicateOf(options.hasTargetPresent === false ? null : T, S)
  const duplicateChoice = options.choices?.duplicate
  if (duplicateChoice !== undefined && duplicateChoice !== null && !DUPLICATE_OPTIONS.includes(duplicateChoice)) {
    throw new MergeError('invalid-choices', '合并选择不合法', { errors: [{ path: 'duplicate', reason: 'bad-choice' }] })
  }
  if (duplicateChoice === 'target' || duplicateChoice === 'source') {
    return mergeOnlySide(duplicateChoice, T, S, { nowMs, duplicate, options })
  }
  const base = baseSide(T, S)
  const live = lifeSide(T, S)
  const liveState = live === null ? null : live === 'target' ? T : S
  const baseState = base === 'source' ? S : T
  const warnings = []
  if (duplicate.suspected) warnings.push('这两只猪看起来是同一份存档的副本；合并会重复相加资产，建议只保留一边')
  const skinMerge = mergeCustomSkins(T.customSkins, S.customSkins, options.targetSkins, options.sourceSkins, warnings)
  const si = mergeSignIn(T.daily?.signIn, S.daily?.signIn)
  const online = mergeOnline(T.daily?.online, S.daily?.online, nowMs, base)
  const diaryEntries = mergeDiary(T.diary, S.diary).entries
  const diaryToday = mergeDiaryToday(T.diary?.today, S.diary?.today, nowMs)
  const pomodoro = mergePomodoro(T.pomodoro, S.pomodoro, nowMs)
  const fishing = mergeFishing(T.fishing, S.fishing, nowMs, base)
  const economy = mergeEconomy(T.economy, S.economy)
  const wallets = mergeWallets(T.wallets, S.wallets, warnings)
  const stats = sumMap(T.stats, S.stats)
  const achievements = mergeAchievements(T.achievements, S.achievements, stats, nowMs)
  const ext = mergeExtensions(T, S, { ...options, choices: options.choices }, warnings)
  const ageSideState = num(T.ageMs) > num(S.ageMs) ? T : num(S.ageMs) > num(T.ageMs) ? S : baseState
  const xpSideState = num(T.xp) > num(S.xp) ? T : num(S.xp) > num(T.xp) ? S : baseState
  const statusValue = (key, fallback = 0) => (liveState !== null ? valueOf(liveState, key, fallback) : Math.max(valueOf(T, key, fallback), valueOf(S, key, fallback)))
  const healthMax = liveState !== null ? valueOf(liveState, 'health') : Math.max(valueOf(T, 'health'), valueOf(S, 'health'))
  const illness = mergeIllness(T, S)
  let health = capForIllness(healthMax, illness)
  if (aliveHatched(T) || aliveHatched(S)) health = Math.max(1, health)
  const merged = {
    version: STATE_VERSION,
    name: baseState.name,
    personality: baseState.personality,
    catchphrase: baseState.catchphrase,
    motto: baseState.motto,
    profileEdits: Math.max(whole(T.profileEdits), whole(S.profileEdits)),
    bornAt: valueOf(ageSideState, 'bornAt', nowMs),
    hatched: T.hatched === true || S.hatched === true,
    dead: T.dead === true && S.dead === true,
    diedAt: null,
    stage: 'box',
    form: baseState.form ?? null,
    skin: skinMerge.renames[baseState.skin] ?? baseState.skin ?? 'default',
    customSkins: skinMerge.skins,
    bodyWeight: mergeBodyWeight(T, S, nowMs, base, liveState),
    ageMs: Math.max(num(T.ageMs), num(S.ageMs)),
    timeScale: Number.isFinite(baseState.timeScale) ? baseState.timeScale : 1,
    ageForced: ageSideState.ageForced === true,
    xp: Math.max(num(T.xp), num(S.xp)),
    weightG: valueOf(xpSideState, 'weightG', 0),
    satiety: statusValue('satiety'),
    happiness: statusValue('happiness'),
    cleanliness: statusValue('cleanliness'),
    health,
    coins: sumCap(T.coins, S.coins),
    inventory: sumMap(T.inventory, S.inventory),
    isOfflineFeedEnabled: baseState.isOfflineFeedEnabled !== false,
    criticalDoctorVisits: minNum(T.criticalDoctorVisits, S.criticalDoctorVisits),
    dress: [...new Set([...(Array.isArray(T.dress) ? T.dress : []), ...(Array.isArray(S.dress) ? S.dress : [])])],
    worn: [...(Array.isArray(baseState.worn) ? baseState.worn : [])],
    dex: {
      forms: mergeDexSection('forms', T.dex?.forms, S.dex?.forms),
      skins: mergeDexSection('skins', T.dex?.skins, S.dex?.skins, skinMerge.renames),
      fish: mergeDexSection('fish', T.dex?.fish, S.dex?.fish),
      items: mergeDexSection('items', T.dex?.items, S.dex?.items),
      souvenirs: mergeDexSection('souvenirs', T.dex?.souvenirs, S.dex?.souvenirs),
    },
    fishing: { ...fishing, spot: baseState.fishing?.spot ?? fishing.spot },
    traits: maxMap(T.traits, S.traits),
    lessons: maxMap(T.lessons, S.lessons),
    interests: maxMap(T.interests, S.interests),
    souvenirs: mergeSouvenirs(T.souvenirs, S.souvenirs),
    illness,
    activity: null,
    outingStreak: statusValue('outingStreak'),
    restMinutes: statusValue('restMinutes'),
    lastFedAt: statusValue('lastFedAt'),
    lastActiveAt: statusValue('lastActiveAt'),
    lastSeenAt: nowMs,
    settledUpTo: nowMs,
    cooldowns: mergeCooldowns(T, S, nowMs, liveState),
    pending: [],
    pendingSeq: Math.max(whole(T.pendingSeq), whole(S.pendingSeq)),
    dialogue: mergeDialogue(T, S, nowMs, liveState, base),
    memories: mergeMemories(T.memories, S.memories, base),
    stats,
    seed: baseState.seed,
    daily: { signIn: si, online },
    diary: { entries: diaryEntries, today: diaryToday },
    pomodoro,
    economy,
    wallets,
    extensions: ext.extensions,
    extensionsRemoved: ext.extensionsRemoved,
    extData: ext.extData,
    achievements: { unlocked: achievements.unlocked, totals: achievements.totals, seen: achievements.seen, events: achievements.events },
    realWorkGrowth: mergeRealWorkGrowth(T, S, nowMs, base, liveState),
  }
  if (merged.dead) {
    merged.diedAt = T.dead === true ? childTime(T.diedAt, S.diedAt) : (Number.isFinite(S.diedAt) ? S.diedAt : null)
    merged.health = 0
  }
  const birthdaySide = options.choices?.personality?.side === 'source' ? S : T
  if (birthdaySide.birthday !== undefined && birthdaySide.birthday !== null) merged.birthday = { ...birthdaySide.birthday }
  merged.stage = lifeStageFor(merged, nowMs).key
  const defaults = {
    name: base,
    look: base,
    personality: base,
    preferences: aliveHatched(T) ? 'target' : 'source',
  }
  const choiceInfo = normalizeChoices(options.choices, T, S, merged, skinMerge.renames, defaults)
  if (choiceInfo.errors.length > 0) throw new MergeError('invalid-choices', '合并选择不合法', { errors: choiceInfo.errors })
  const choices = choiceInfo.choices
  applyChoices(merged, T, S, choices)
  preserveTargetUnknown(T, merged, MERGE_RULES, '')
  merged.stage = lifeStageFor(merged, nowMs).key

  const receipts = mergeReceipts(options.targetReceipts, options.sourceReceipts, nowMs)
  warnings.push(...receipts.warnings)
  const beforeBadges = new Set(Object.keys(isObject(T.achievements?.unlocked) ? T.achievements.unlocked : {}))
  settleAchievements(merged, nowMs, { silent: options.silentBadges !== false })
  const newBadges = Object.keys(merged.achievements.unlocked).filter(key => !beforeBadges.has(key)).length
  const newDex = ['forms', 'skins', 'fish', 'items', 'souvenirs'].reduce((sum, section) => sum + Object.keys(merged.dex[section]).filter(key => !isObject(T.dex?.[section]?.[key])).length, 0)
  const newDiary = Math.max(0, (merged.diary.entries?.length ?? 0) - (Array.isArray(T.diary?.entries) ? T.diary.entries.length : 0))
  const descriptors = describeChoices(T, S, merged, { renames: skinMerge.renames, defaults })
  for (const descriptor of descriptors) {
    if (descriptor.key === 'name') descriptor.value = choices.name.side === 'custom' ? choices.name.value : choices.name.side === 'source' ? S.name : T.name
    if (descriptor.key === 'look') descriptor.value = { side: choices.look.side, form: merged.form, skin: merged.skin, worn: [...merged.worn] }
    if (descriptor.key === 'personality') descriptor.value = { side: choices.personality.side, personality: merged.personality, catchphrase: merged.catchphrase, motto: merged.motto, birthday: merged.birthday ?? null }
    if (descriptor.key === 'preferences') {
      descriptor.value = {
        side: choices.preferences.side,
        ownerName: merged.dialogue.ownerName,
        quiet: merged.dialogue.quiet,
        isOfflineFeedEnabled: merged.isOfflineFeedEnabled,
        timeScale: merged.timeScale,
        spot: merged.fishing.spot,
      }
    }
    descriptor.sides = { target: groupedSide(T, skinMerge.renames), source: groupedSide(S, skinMerge.renames) }
  }
  const allConflicts = [...(ext.conflicts ?? []), ...skinMerge.conflicts, ...describeExtensionConflicts(T, S, options.hooks)]
  const deduped = [...new Map(allConflicts.map(item => [item.key, item])).values()]
  const autoMerge = autoMergeLines({
    baseline: T, merged, renames: skinMerge.renames, newBadges, newDex, newDiary,
    receiptsBefore: Array.isArray(options.targetReceipts) ? options.targetReceipts.length : 0,
    receiptsAfter: receipts.receipts.length,
  })
  const report = {
    result: summaryOf(merged, { newBadges, newDex, newDiary }),
    choices: descriptors,
    conflicts: deduped,
    warnings: [...new Set(warnings)],
    autoMerge: autoMerge.slice(0, 20),
    editors: editorLists(merged),
    sides: { target: flatSide(T), source: flatSide(S) },
    duplicate: duplicateReport(duplicate, duplicateChoice),
    skinRenames: skinMerge.renames,
    skinCopies: skinMerge.copies,
    defaults,
  }
  return { state: merged, receipts: receipts.receipts, report, choices, skinRenames: skinMerge.renames, skinCopies: skinMerge.copies, warnings: report.warnings }
}

/**
 * #14 6.5 疑似副本的三选一：只保留一边，不做任何相加。
 * 结果就是那一边结算后的状态；另一边只留在备份里，不贡献任何字段。
 */
function mergeOnlySide(side, T, S, { nowMs, duplicate, options }) {
  const keptState = side === 'source' ? S : T
  if (!aliveHatched(keptState)) throw new MergeError('no-living-pig', side === 'source' ? '内嵌猪不是活着且已孵化的小猪' : '桌面上的猪不是活着且已孵化的小猪')
  const warnings = []
  const merged = structuredClone(keptState)
  merged.version = STATE_VERSION
  merged.activity = null
  merged.pending = []
  merged.lastSeenAt = nowMs
  raiseSettledUpTo(merged, nowMs)
  if (isObject(merged.pomodoro)) merged.pomodoro.startedAt = null
  if (isObject(merged.fishing)) merged.fishing.pending = null
  if (merged.health <= 0 && merged.dead !== true) merged.health = 1
  if (merged.dead === true) merged.health = 0
  merged.stage = lifeStageFor(merged, nowMs).key
  // 只保留内嵌猪时，源端自定义皮肤要一起搬过去；和桌宠同名但内容不同的皮肤改名，
  // 避免覆盖桌宠的图片文件（回滚时桌宠还要按原 key 用）。
  let skinRenames = /** @type {Record<string,string>} */ ({})
  let skinCopies = []
  if (side === 'source') {
    const skinMerge = mergeCustomSkins(T.customSkins, S.customSkins, options.targetSkins, options.sourceSkins, warnings)
    skinRenames = skinMerge.renames
    merged.customSkins = (Array.isArray(S.customSkins) ? S.customSkins : [])
      .filter(skin => isObject(skin) && typeof skin.key === 'string' && skin.key !== '')
      .map(skin => (skinRenames[skin.key] === undefined ? { ...skin } : { ...skin, key: skinRenames[skin.key], art: `custom-${skinRenames[skin.key]}` }))
    merged.skin = skinRenames[keptState.skin] ?? keptState.skin
    skinCopies = (Array.isArray(S.customSkins) ? S.customSkins : [])
      .filter(skin => isObject(skin) && typeof skin.key === 'string' && skin.key !== '')
      .map(skin => ({ from: `custom-${skin.key}`, to: `custom-${skinRenames[skin.key] ?? skin.key}`, key: skinRenames[skin.key] ?? skin.key }))
    if (isObject(options.sourceSkins)) {
      for (const skin of Array.isArray(S.customSkins) ? S.customSkins : []) {
        if (isObject(skin) && typeof skin.key === 'string' && typeof options.sourceSkins[skin.key] !== 'string') warnings.push(`皮肤 ${skin.key} 缺少图片，只保留记录`)
      }
    }
  }
  const rawReceipts = side === 'source' ? options.sourceReceipts : options.targetReceipts
  const keptReceipts = mergeReceipts(rawReceipts, [], nowMs)
  warnings.push(...keptReceipts.warnings)
  const beforeBadges = new Set(Object.keys(isObject(keptState.achievements?.unlocked) ? keptState.achievements.unlocked : {}))
  settleAchievements(merged, nowMs, { silent: options.silentBadges !== false })
  const newBadges = Object.keys(merged.achievements.unlocked).filter(key => !beforeBadges.has(key)).length
  const defaults = { name: side, look: side, personality: side, preferences: side }
  const descriptors = describeChoices(T, S, merged, { renames: {}, defaults })
  for (const descriptor of descriptors) descriptor.sides = { target: groupedSide(T), source: groupedSide(S) }
  const report = {
    result: summaryOf(merged, { newBadges, newDex: 0, newDiary: 0 }),
    choices: descriptors,
    conflicts: [],
    warnings: [...new Set([...warnings, side === 'target' ? '只保留桌宠：内嵌猪的数据不相加，只留在合并前的备份里' : '只保留内嵌猪：桌宠的数据不相加，只留在合并前的备份里'])],
    autoMerge: [side === 'target' ? '只保留桌宠：金币、物品和徽章都不相加' : '只保留内嵌猪：金币、物品和徽章都不相加'],
    editors: editorLists(merged),
    sides: { target: flatSide(T), source: flatSide(S) },
    duplicate: { ...duplicateReport(duplicate, side), kept: side },
    skinRenames,
    skinCopies,
    defaults,
  }
  return { state: merged, receipts: keptReceipts.receipts, report, choices: { duplicate: side }, skinRenames, skinCopies, warnings: report.warnings }
}

function childTime(a, b) {
  if (Number.isFinite(a)) return a
  return Number.isFinite(b) ? b : null
}

/** 给预览摘要用：只放展示需要的数字，不含完整状态、路径、令牌。 */
export function mergeSummary(state) {
  if (!isObject(state)) return { name: '未孵化', level: 1, days: 0, coins: 0, items: 0, badges: 0, dead: false, hatched: false, box: false, kind: 'none' }
  const box = state.hatched !== true && state.dead !== true
  return {
    name: state.name,
    level: levelOf(state.xp),
    days: Math.floor(num(state.ageMs) / 86_400_000),
    coins: whole(state.coins),
    items: Object.values(isObject(state.inventory) ? state.inventory : {}).reduce((sum, value) => sum + whole(value), 0),
    badges: Object.keys(isObject(state.achievements?.unlocked) ? state.achievements.unlocked : {}).length,
    dead: state.dead === true,
    hatched: state.hatched === true,
    box,
    kind: state.dead === true ? 'dead' : box ? 'box' : 'alive',
  }
}

