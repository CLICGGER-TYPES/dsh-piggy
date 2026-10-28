// @ts-check
/**
 * 下载来的扩展（v0.30，设计见 docs/design/extension-download.md）。
 *
 * - 在线目录只从仓库的固定地址读（REGISTRY_URL），只装我们自己发布的；
 * - 下载（整包或逐个文件，见 store/ext-download.js）后核对 sha256，`minGame` 高于当前游戏版本不装；
 * - 扩展可以带图片（`assets/`，规则见 store/ext-files.js），跟代码一起下载、核对、放好；
 * - 装在存档旁边的 `extensions/<key>/`，`server.js` 用动态 import 加载；
 * - 扩展只能改 `state.extData[key]`，动别的只能走这里给的 api（花钱、给东西、说话）；
 * - 扩展出错只影响它自己。
 *
 * 2026-10-28 按职责拆开：目录读取与缓存在 store/ext-catalog.js，安装替换删除在
 * store/ext-install.js，加载与已加载模块的调用在 store/ext-load.js，面板视图与静态资源
 * 在 store/ext-view.js。这个文件只做组装，公开的 createExtRuntime 返回形状、方法名和
 * 回调顺序保持不变；versionAtLeast 仍从这里导出，避免其它模块反向 import 造成环。
 * @module dsh-piggy/store/ext-runtime
 */
import { dirname, join } from 'node:path'

import { CHANNEL } from '../channel.js'
import { createCatalog } from './ext-catalog.js'
import { createDownloads } from './ext-download.js'
import { createInstaller } from './ext-install.js'
import { createLoader } from './ext-load.js'
import { createViews } from './ext-view.js'

/** 在线扩展目录：GitHub 或 Gitee，看打包时的渠道（channel.js）。 */
export const REGISTRY_URL = CHANNEL.registry
/** 扩展文件只许从本渠道的发行版附件和仓库原始文件下载。 */
export const ALLOWED_SOURCES = [CHANNEL.downloadBase + '/', CHANNEL.rawBase + '/']
const KEY = /^[a-z0-9-]{2,24}$/

/** 渠道名给日志和错误文案用（Gitee 包里不能写 GitHub）。 */
const CHANNEL_LABEL = { github: 'GitHub', gitee: 'Gitee' }[CHANNEL.name] ?? CHANNEL.name

const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms) })

/** 「0.31.0」≥「0.30.2」吗（测试版后缀不管）。 */
export function versionAtLeast(have, need) {
  const parse = text => String(text).split('-')[0].split('.').map(part => Number(part) || 0)
  const a = parse(have)
  const b = parse(need)
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return true
}

/**
 * @param {any} store - createStore 的结果（要 filePath、state、mutate）
 * @param {object} options
 * @param {string} options.gameVersion
 * @param {typeof fetch} [options.fetch]
 * @param {string} [options.registryUrl] - 测试用；正式版永远是 REGISTRY_URL
 * @param {() => number} [options.now]
 * @param {(ms: number) => Promise<void>} [options.sleep] - 测试用，免得真等重试间隔
 */
export function createExtRuntime(store, options) {
  const doFetch = options.fetch ?? globalThis.fetch
  const registryUrl = options.registryUrl ?? REGISTRY_URL
  const now = options.now ?? (() => Date.now())
  const wait = options.sleep ?? sleep
  // 没有存档路径（测试里的假存档）就当一个扩展都没装。
  const root = () => typeof store.filePath === 'string' ? join(dirname(store.filePath), 'extensions') : ''
  /** @type {Map<string, {manifest: any, module: any, error: string|null}>} 已加载的扩展：由这里创建，加载器和视图共用。 */
  const loaded = new Map()

  /** 下载和目录读取的失败都从这里出去：控制台一份（进日志），返回值一份（进界面）。 */
  function warn(message) {
    console.warn(`[dsh-piggy] ${message}`)
    if (typeof store.journal === 'function') store.journal('warn', 'ext', message)
  }

  const downloads = createDownloads({
    fetch: doFetch,
    wait,
    warn,
    sourceOk: url => options.registryUrl !== undefined || ALLOWED_SOURCES.some(prefix => url.startsWith(prefix)),
  })
  const loader = createLoader({ store, root, loaded, now, keyPattern: KEY })
  const catalog = createCatalog({
    fetch: doFetch,
    wait,
    now,
    warn,
    getState: () => store.state,
    root,
    registryUrl,
    channelLabel: CHANNEL_LABEL,
    keyPattern: KEY,
    getGameVersion: () => options.gameVersion,
    versionAtLeast,
    localVersion: loader.localVersion,
    isLocal: loader.isLocal,
  })
  const installer = createInstaller({
    store,
    root,
    now,
    downloads,
    online: catalog.online,
    load: loader.load,
    hasLoaded: loader.has,
    forgetLoaded: loader.forget,
    warn,
    getGameVersion: () => options.gameVersion,
    versionAtLeast,
  })
  const views = createViews({ root, loaded, now, keyPattern: KEY })

  return {
    ready: loader.ready,
    list: loader.list,
    views: views.views,
    shelves: views.shelves,
    dex: views.dex,
    onlineView: catalog.onlineView,
    install: installer.install,
    importBundle: installer.importBundle,
    remove: installer.remove,
    act: loader.act,
    mergeStates: loader.mergeStates,
    installedKeys: loader.installedKeys,
    clientScript: views.clientScript,
    assetFile: views.assetFile,
  }
}
