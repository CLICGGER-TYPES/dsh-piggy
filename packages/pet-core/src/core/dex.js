// @ts-check
/** 图鉴的持久记录与面板视图。新增字段按需补齐，不升级存档版本。 */

import { ALL_SOUVENIRS, FISH, FORMS, SHOP, SKINS } from '../data.js'

export const DEX_SECTIONS = Object.freeze(['forms', 'skins', 'fish', 'items', 'souvenirs'])

export function emptyDex() {
  return { forms: {}, skins: {}, fish: {}, items: {}, souvenirs: {} }
}

function cleanRecord(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const firstAt = Number.isFinite(value.firstAt) ? value.firstAt : null
  const count = Number.isFinite(value.count) ? Math.max(1, Math.floor(value.count)) : 0
  if (firstAt === null || count === 0) return null
  return { firstAt, count, ...(Number.isFinite(value.maxSizeCm) ? { maxSizeCm: Math.max(0.1, value.maxSizeCm) } : {}) }
}

/** Fill/sanitize the collection in place and seed things an old save already owns. */
export function ensureDex(state, nowMs = 0) {
  const source = typeof state.dex === 'object' && state.dex !== null ? state.dex : {}
  const dex = emptyDex()
  for (const section of DEX_SECTIONS) {
    const records = typeof source[section] === 'object' && source[section] !== null ? source[section] : {}
    for (const [key, value] of Object.entries(records)) {
      const record = cleanRecord(value)
      if (record !== null) dex[section][key] = record
    }
  }
  state.dex = dex

  if (typeof state.form === 'string' && state.form !== '' && dex.forms[state.form] === undefined) {
    dex.forms[state.form] = { firstAt: nowMs, count: 1 }
  }
  // A selected look in an older or partially recovered save is already owned.
  if (typeof state.skin === 'string' && state.skin !== 'default' && dex.skins[state.skin] === undefined
    && (SKINS.some(skin => skin.key === state.skin)
      || (Array.isArray(state.customSkins) && state.customSkins.some(skin => skin?.key === state.skin)))) {
    dex.skins[state.skin] = { firstAt: nowMs, count: 1 }
  }
  for (const [key, count] of Object.entries(state.inventory ?? {})) {
    if (Number.isFinite(count) && count > 0 && dex.items[key] === undefined) {
      dex.items[key] = { firstAt: nowMs, count: Math.floor(count) }
    }
  }
  for (const key of state.dress ?? []) {
    if (dex.items[key] === undefined) dex.items[key] = { firstAt: nowMs, count: 1 }
  }
  const ownedSouvenirs = new Map()
  for (const entry of state.souvenirs ?? []) {
    if (typeof entry !== 'object' || entry === null || typeof entry.key !== 'string') continue
    const found = ownedSouvenirs.get(entry.key) ?? { firstAt: nowMs, count: 0 }
    if (Number.isFinite(entry.gotAt)) found.firstAt = Math.min(found.firstAt, entry.gotAt)
    found.count += 1
    ownedSouvenirs.set(entry.key, found)
  }
  for (const [key, record] of ownedSouvenirs) {
    if (dex.souvenirs[key] === undefined) dex.souvenirs[key] = record
  }
  return dex
}

/** Record one acquisition while retaining the first timestamp. */
export function recordDex(state, section, key, nowMs, count = 1) {
  if (!DEX_SECTIONS.includes(section) || typeof key !== 'string' || key === '' || count <= 0) return null
  const dex = ensureDex(state, nowMs)
  const before = dex[section][key]
  const record = before === undefined
    ? { firstAt: nowMs, count: Math.floor(count) }
    : { firstAt: before.firstAt, count: before.count + Math.floor(count) }
  dex[section][key] = record
  return record
}

const found = (dex, section, key) => dex[section][key] ?? null

const ITEM_KIND_LABEL = Object.freeze({
  food: '食物', bath: '洗浴', toy: '玩具', medicine: '药品', body: '体型药', revive: '复活', promotion: '晋升', dress: '装扮',
})

/** Build the complete locked/unlocked catalogue sent to the client. */
export function dexView(state, formView, nowMs = 0) {
  const dex = ensureDex(state, nowMs)
  return {
    forms: FORMS.map(form => {
      const record = found(dex, 'forms', form.key)
      const progress = formView?.forms?.find(entry => entry.key === form.key)
      const item = SHOP.find(entry => entry.key === form.item)
      return {
        key: form.key, label: form.label, emoji: form.emoji, art: form.art,
        acquired: record !== null, firstAt: record?.firstAt ?? null, count: record?.count ?? 0,
        description: form.line,
        hint: form.hint,
        condition: `使用${item?.label ?? '晋升道具'}完成${item?.useLabel ?? '变身'}`,
        requirements: progress?.requirements ?? [],
      }
    }),
    skins: [
      { key: 'default', label: '默认小猪', emoji: '🐷', art: 'piglet', description: '熟悉的小猪。', custom: false },
      ...SKINS,
      ...(Array.isArray(state.customSkins) ? state.customSkins : []),
    ].map(skin => {
      const record = found(dex, 'skins', skin.key)
      return {
        ...skin, acquired: !('unlockJob' in skin) || record !== null,
        firstAt: record?.firstAt ?? null, count: record?.count ?? ('unlockJob' in skin ? 0 : 1),
        hint: 'hint' in skin ? skin.hint : '换一种颜色，也还是熟悉的它。',
        condition: 'unlockJob' in skin ? `完成${skin.label.replace(/猪$/, '')}工作解锁` : (skin.custom ? '玩家导入' : '随版本收录'),
      }
    }),
    fish: FISH.map(fish => {
      const record = found(dex, 'fish', fish.key)
      const behavior = { smooth: '游姿平稳', dash: '动作敏捷', sink: '喜欢往深处钻', rise: '常往水面游', mixed: '行踪难以捉摸' }[fish.behavior]
      return {
        ...fish,
        acquired: record !== null, firstAt: record?.firstAt ?? null,
        count: record?.count ?? 0, maxSizeCm: record?.maxSizeCm ?? null,
        description: `${behavior}的${fish.label}。`,
        hint: '水面、钟声和抛竿的远近，都会悄悄改变相遇。',
        condition: `${fish.times.join(' / ')} 出现 · 难度 ${fish.difficulty}`,
      }
    }),
    items: SHOP.map(item => {
      const record = found(dex, 'items', item.key)
      const gate = item.kind === 'dress' && (item.level ?? 1) > 1 ? ` · Lv.${item.level}` : ''
      return {
        key: item.key, label: item.label, emoji: item.emoji,
        kind: item.kind, kindLabel: ITEM_KIND_LABEL[item.kind] ?? '其他',
        acquired: record !== null, firstAt: record?.firstAt ?? null, count: record?.count ?? 0,
        description: item.blurb ?? '一件陪伴日常生活的小东西。',
        hint: '有些相遇藏在货架、礼物，或一次意外收获里。',
        condition: `商店购买 · ${item.price} 金币${gate}`,
      }
    }),
    souvenirs: ALL_SOUVENIRS.map(item => {
      const record = found(dex, 'souvenirs', item.key)
      return {
        key: item.key, label: item.label, emoji: item.emoji,
        acquired: record !== null, firstAt: record?.firstAt ?? null, count: record?.count ?? 0,
        description: item.story ?? '从远方带回来的记忆。',
        hint: '离开熟悉的屋檐走远一些，风会把答案带回来。',
        condition: `旅行到${item.fromLabel}获得`,
      }
    }),
  }
}
