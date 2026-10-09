// @ts-check
/**
 * 扩展中心的客户端部分（设计见 docs/design/extension-center.md）。
 *
 * 宿主快照里带 extensions: [{ key, label, emoji, description, on, apps, dexSections, shopKinds }]。
 * 老宿主不发就当全部打开。关掉的扩展：主菜单格子、App 页、番茄钟角标、图鉴分区都不出现；
 * 商店里的相关商品由宿主直接撤下。
 */
import { arr, num, obj, str } from './values.js'

/** 老宿主没有扩展列表时，按「全部打开」处理。 */
const DEFAULTS = [
  { key: 'pomodoro', label: '番茄钟', emoji: '🍅', description: '', on: true, apps: ['pomodoro'], dexSections: [], shopKinds: [], installed: true, builtin: true, version: '', app: null, error: null },
  { key: 'fishing', label: '钓鱼', emoji: '🎣', description: '', on: true, apps: ['fishing'], dexSections: ['fish'], shopKinds: ['bait'], installed: true, builtin: true, version: '', app: null, error: null },
]

/** @param {unknown} raw */
export function normalizeExtensions(raw) {
  const list = arr(raw)
  if (list.length === 0) return DEFAULTS.map(entry => ({ ...entry }))
  return list.map(function (value) {
    const entry = obj(value)
    const strings = key => arr(entry[key]).filter(item => typeof item === 'string')
    const app = obj(entry.app)
    return {
      key: str(entry.key, ''), label: str(entry.label, ''), emoji: str(entry.emoji, '🧩'),
      description: str(entry.description, ''), on: entry.on !== false,
      apps: strings('apps'), dexSections: strings('dexSections'), shopKinds: strings('shopKinds'),
      // v0.30：装没装、是不是内置、下载扩展的版本和主菜单格子、加载出错。
      installed: entry.installed !== false, builtin: entry.builtin !== false, version: str(entry.version, ''),
      // 本地导入的非官方扩展（不会被在线目录提示更新）。
      local: entry.local === true,
      app: entry.app ? { emoji: str(app.emoji, '🧩'), label: str(app.label, str(entry.label, '')) } : null,
      error: typeof entry.error === 'string' ? entry.error : null,
    }
  }).filter(entry => entry.key !== '')
}

/** 快照里下载扩展的列表、App 数据、货架和图鉴分区。 @param {any} d */
export function normalizeExtensionParts(d) {
  const extensions = normalizeExtensions(d.extensions)
  const visible = part => {
    if (typeof part?.extension !== 'string' || typeof part?.key !== 'string') return false
    const owner = extensions.find(entry => entry.key === part.extension)
    return owner !== undefined && owner.on && owner.installed && !owner.builtin
  }
  return { extensions, extViews: obj(d.extViews),
    extShelves: arr(d.extShelves).filter(visible).map(part => ({ ...part, currency: obj(part.currency), items: arr(part.items) })),
    extDex: arr(d.extDex).filter(visible).map(part => ({ ...part, entries: arr(part.entries) })),
    // 扩展币钱包（规则 1）：扩展关掉了也列出来，可以把币换成金币。
    wallets: arr(d.wallets).map(value => {
      const wallet = obj(value)
      return { key: str(wallet.key, ''), label: str(wallet.label, '币'), emoji: str(wallet.emoji, '🪙'), balance: num(wallet.balance, 0), rate: num(wallet.rate, 1), buyRate: num(wallet.buyRate, 1), buyable: wallet.buyable !== false }
    }).filter(wallet => wallet.key !== '') }
}

/** 关掉的扩展占的 App / 图鉴分区。 @param {any} view */
export function offParts(view) {
  const apps = new Set()
  const dexSections = new Set()
  for (const extension of arr(view?.extensions)) {
    if (extension.on) continue
    for (const app of extension.apps) apps.add(app)
    for (const section of extension.dexSections) dexSections.add(section)
  }
  return { apps, dexSections }
}

/**
 * 归一化之后再按扩展开关收一遍：番茄钟关了就当没有番茄钟（角标、提醒、状态页那一行都跟着消失）。
 * @param {any} view
 */
export function applyExtensions(view) {
  const off = offParts(view)
  if (off.apps.has('pomodoro')) view.pomodoro = null
  return view
}

/**
 * 主菜单 / 图标栏里还在的 App。正开着的 App 被关掉了就退回主菜单。
 * @param {any} ctx
 * @param {Array<{key:string}>} tabs
 */
export function enabledTabs(ctx, tabs) {
  const off = offParts(ctx.view)
  // 下载来的、开着的扩展在主菜单有自己的格子：页签名是 ext:<key>。
  const downloaded = arr(ctx.view?.extensions)
    .filter(extension => !extension.builtin && extension.installed && extension.on && extension.app !== null)
    .map(extension => ({ key: 'ext:' + extension.key, label: extension.app.label, emoji: extension.app.emoji }))
  if (off.apps.has(ctx.tab) || (String(ctx.tab).startsWith('ext:') && !downloaded.some(tab => tab.key === ctx.tab))) ctx.tab = 'home'
  return tabs.filter(tab => !off.apps.has(tab.key)).concat(downloaded)
}
