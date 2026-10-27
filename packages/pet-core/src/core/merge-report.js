// @ts-check
/**
 * 合并报告给界面/契约用的纯函数：两边值、候选表、自动合并明细、摘要和疑似副本三选一。
 *
 * 只读合并结果，不写存档；merge.js 和 runtime/merge-service.js 共用同一份形状，
 * 避免预览/提交/成功页各拼一份（#14 4.5 / 6.5）。
 *
 * @module dsh-piggy/core/merge-report
 */

import { CATCHPHRASE_MAX, MOTTO_MAX, OWNER_NAME_MAX, fishSpotByKey, formByKey, itemByKey, xpForLevel } from '../data.js'
import { MERGE_NAME_MAX, personalityChoices, skinChoices } from './merge-identity.js'
import { isObject, num, whole } from './merge-rules.js'

export { DUPLICATE_OPTIONS }

const DUPLICATE_OPTIONS = ['target', 'source', 'merge']

/** 三选一的报告：只提示，不硬拦；`choice` 是这次提交实际用的选项。 */
export function duplicateReport(duplicate, choice) {
  return {
    suspected: duplicate.suspected === true,
    reasons: duplicate.reasons ?? [],
    options: DUPLICATE_OPTIONS,
    default: null,
    choice: DUPLICATE_OPTIONS.includes(choice) ? choice : null,
    kept: choice === 'target' || choice === 'source' ? choice : null,
  }
}

/** 「改…」的候选：全部来自合并后的真实已解锁数据，带中文 label；不让用户输技术 key。 */
export function editorLists(merged) {
  const forms = [{ key: '', label: '默认形态' }]
  for (const key of Object.keys(isObject(merged.dex?.forms) ? merged.dex.forms : {})) {
    forms.push({ key, label: formByKey(key)?.label ?? key })
  }
  const worn = (Array.isArray(merged.dress) ? merged.dress : []).map(key => ({ key, label: itemByKey(key)?.label ?? key }))
  const spots = (Array.isArray(merged.fishing?.spots) ? merged.fishing.spots : []).map(key => ({ key, label: fishSpotByKey(key)?.label ?? key }))
  return {
    name: { max: MERGE_NAME_MAX },
    look: { form: forms, skin: skinChoices(merged), worn },
    personality: { personality: personalityChoices(), catchphraseMax: CATCHPHRASE_MAX, mottoMax: MOTTO_MAX },
    preferences: { spot: spots, ownerNameMax: OWNER_NAME_MAX, timeScaleMax: 365 },
  }
}

/** 某一边的平铺值（顶层 `sides`，客户端按这个读）。 */
export function flatSide(state) {
  return {
    name: state?.name ?? '',
    form: state?.form ?? null,
    skin: state?.skin ?? 'default',
    worn: Array.isArray(state?.worn) ? state.worn : [],
    personality: state?.personality ?? '',
    catchphrase: state?.catchphrase ?? '',
    motto: state?.motto ?? '',
    birthday: state?.birthday ?? null,
    ownerName: state?.dialogue?.ownerName ?? '',
    quiet: state?.dialogue?.quiet === true,
    isOfflineFeedEnabled: state?.isOfflineFeedEnabled !== false,
    timeScale: Number.isFinite(state?.timeScale) ? state.timeScale : 1,
    spot: state?.fishing?.spot ?? '',
  }
}

/** 某一边的分组值（`choices[].sides`：按名字/样子/性格/偏好分组）。 */
export function groupedSide(state, renames = {}) {
  return {
    name: state?.name ?? '',
    look: { form: state?.form ?? null, skin: renames[state?.skin] ?? state?.skin ?? 'default', worn: Array.isArray(state?.worn) ? state.worn : [] },
    personality: { personality: state?.personality ?? '', catchphrase: state?.catchphrase ?? '', motto: state?.motto ?? '', birthday: state?.birthday ?? null },
    preferences: { ownerName: state?.dialogue?.ownerName ?? '', quiet: state?.dialogue?.quiet === true, isOfflineFeedEnabled: state?.isOfflineFeedEnabled !== false, timeScale: Number.isFinite(state?.timeScale) ? state.timeScale : 1, spot: state?.fishing?.spot ?? '' },
  }
}

/** 摘要数字（预览/提交/成功页共用）。 */
export function summaryOf(state, { newBadges = 0, newDex = 0, newDiary = 0 } = {}) {
  return {
    name: state.name,
    level: levelOf(num(state.xp)),
    days: Math.floor(num(state.ageMs) / 86_400_000),
    coins: whole(state.coins),
    items: Object.values(isObject(state.inventory) ? state.inventory : {}).reduce((sum, value) => sum + whole(value), 0),
    badges: Object.keys(isObject(state.achievements?.unlocked) ? state.achievements.unlocked : {}).length,
    newBadges,
    newDex,
    newDiary,
  }
}

/** 自动合并明细：只写真实发生的变化（最多 20 条，调用方再截一次）。 */
export function autoMergeLines({ baseline, merged, renames = {}, newBadges, newDex, newDiary, receiptsBefore, receiptsAfter }) {
  const lines = []
  const push = line => { if (lines.length < 40 && line !== '') lines.push(line) }
  const before = (key, fallback = 0) => (Number.isFinite(baseline?.[key]) ? baseline[key] : fallback)
  const coins = whole(merged.coins) - whole(baseline?.coins)
  if (coins !== 0) push(`金币 ${whole(baseline?.coins)} → ${whole(merged.coins)}（${coins > 0 ? '+' : ''}${coins}）`)
  const inventory = isObject(merged.inventory) ? merged.inventory : {}
  const baseInventory = isObject(baseline?.inventory) ? baseline.inventory : {}
  for (const key of Object.keys(inventory).sort()) {
    const delta = whole(inventory[key]) - whole(baseInventory[key])
    if (delta > 0) push(`${itemByKey(key)?.label ?? key} +${delta}`)
  }
  if (num(merged.xp) > before('xp')) push(`经验取更高：Lv.${levelOf(before('xp'))} → Lv.${levelOf(num(merged.xp))}`)
  if (num(merged.ageMs) > before('ageMs')) push(`年龄取更高：${Math.floor(before('ageMs') / 86_400_000)} 天 → ${Math.floor(num(merged.ageMs) / 86_400_000)} 天`)
  for (const [key, label] of [['intel', '智力'], ['charm', '魅力'], ['strong', '武力']]) {
    const delta = whole(merged.traits?.[key]) - whole(baseline?.traits?.[key])
    if (delta > 0) push(`${label} +${delta}`)
  }
  const signIn = whole(merged.daily?.signIn?.total) - whole(baseline?.daily?.signIn?.total)
  if (signIn > 0) push(`签到累计 +${signIn} 天`)
  const online = whole(merged.daily?.online?.unclaimed) - whole(baseline?.daily?.online?.unclaimed)
  if (online > 0) push(`在线礼包 +${online} 个`)
  const receipts = whole(receiptsAfter) - whole(receiptsBefore)
  if (receipts > 0) push(`工作收据 +${receipts} 条`)
  const bag = (Array.isArray(merged.fishing?.bag) ? merged.fishing.bag.length : 0) - (Array.isArray(baseline?.fishing?.bag) ? baseline.fishing.bag.length : 0)
  if (bag > 0) push(`鱼篓 +${bag} 条`)
  const spots = (Array.isArray(merged.fishing?.spots) ? merged.fishing.spots.length : 0) - (Array.isArray(baseline?.fishing?.spots) ? baseline.fishing.spots.length : 0)
  if (spots > 0) push(`钓点解锁 +${spots} 个`)
  if (newBadges > 0) push(`徽章新增 ${newBadges} 枚`)
  if (newDex > 0) push(`图鉴新增 ${newDex} 种`)
  if (newDiary > 0) push(`日记新增 ${newDiary} 篇`)
  for (const [oldKey, newKey] of Object.entries(renames)) push(`皮肤 ${oldKey} 改名为 ${newKey}`)
  return lines
}

export const levelOf = xp => {
  let level = 1
  while (level < 60 && xp >= xpForLevel(level + 1)) level += 1
  return level
}

