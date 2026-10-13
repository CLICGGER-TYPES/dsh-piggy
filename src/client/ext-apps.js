// @ts-check
/**
 * 下载来的扩展在面板里的部分（v0.30，设计见 docs/design/extension-download.md）。
 *
 * 扩展包里的 client.js 是普通脚本，加载后调用
 *   window.dshPiggyExtensions.register('<key>', { render(app) { … } })
 * `app` 给它：content（往里画）、data（宿主 view 给的数据）、send(op, data)（发给它自己的动作）、
 * el / button（和面板一样的小工具）、rerender()（只改了面板里的状态时重画）、openDex(section)、
 * asset(name)（扩展自带图片的地址，见 store/ext-files.js）、pigArt()（玩家现在的猪图地址）。出错只影响它自己的页面。
 * 游戏 0.37.0 起：mode（'panel' 面板里 / 'big' 大界面）、openBig()（打开自己的大界面：桌面版开一扇大窗口，
 * 网页版铺满页面）、closeBig()（大界面里才有：回到面板）。菜园的大农场就是这样做的。
 * @module dsh-piggy/client/ext-apps
 */
import { button, el } from './dom.js'
import { walletBar } from './wallet.js'
import { artSource } from './art-path.js'
import { desktopRole, desktopShell } from './desktop-shell.js'

/** @type {Record<string, any>} */
var registry = {}
/** @type {Record<string, boolean>} */
var requested = {}
var rerender = null

function bridge() {
  var host = /** @type {any} */ (window)
  if (!host.dshPiggyExtensions) {
    host.dshPiggyExtensions = {
      register: function (key, impl) {
        if (typeof key !== 'string' || impl === null || typeof impl !== 'object') return
        registry[key] = impl
        if (typeof rerender === 'function') rerender()
      },
    }
  }
  return host.dshPiggyExtensions
}

/** 把下载扩展的面板脚本加载进来（每个版本只加载一次）。 */
function ensureScript(key, version) {
  bridge()
  var id = key + '@' + version
  if (requested[id] || typeof document === 'undefined' || typeof document.createElement !== 'function') return
  requested[id] = true
  var script = /** @type {HTMLScriptElement} */ (document.createElement('script'))
  script.src = '/dsh-piggy/ext/' + encodeURIComponent(key) + '/client.js?v=' + encodeURIComponent(version)
  script.async = true
  ;(document.head || document.body)?.appendChild(script)
}

/** 打开扩展的大界面：桌面版（外壳 0.6.5 起）开一扇大窗口；网页版、老外壳在这个页面里铺满。 */
export function openBigApp(ui, key) {
  var shell = desktopShell()
  if (shell && shell.ext && typeof shell.ext.open === 'function') { shell.ext.open(key); return }
  ui.extBig = key
  ui.tab = 'ext:' + key
  ui.renderContent()
}

/** 关掉大界面：在大窗口里就关窗口；页面里铺满的就收回面板。 */
export function closeBigApp(ui) {
  var shell = desktopShell()
  if (desktopRole() === 'ext' && shell && shell.ext && typeof shell.ext.close === 'function') { shell.ext.close(); return }
  ui.extBig = null
  ui.host.setAttribute('data-ext-view', '')
  ui.renderContent()
}

/** 下载扩展的 App 页；mode 'big' 是它的大界面（见 openBigApp）。 */
export function renderDownloadedApp(ui, key, mode) {
  var big = mode === 'big'
  var extension = (ui.view.extensions || []).find(function (entry) { return entry.key === key })
  if (!extension) { ui.content.appendChild(el('div', 'dp-empty', '这个扩展已经删掉了')); return }
  if (extension.error) { ui.content.appendChild(el('div', 'dp-empty', '这个扩展出错了：' + extension.error)); return }
  ensureScript(key, extension.version)
  rerender = function () { if (ui.tab === 'ext:' + key) ui.renderContent() }
  var impl = registry[key]
  if (!impl || typeof impl.render !== 'function') { ui.content.appendChild(el('div', 'dp-empty', '正在加载……')); return }
  var data = ui.view.extViews ? ui.view.extViews[key] : undefined
  // 有自己的币就在顶上放余额条，兑换由宿主管（扩展不用自己画）。
  var wallet = (ui.view.wallets || []).find(function (entry) { return entry.key === key })
  if (wallet && !big && key !== 'farm') ui.content.appendChild(walletBar(ui, wallet))
  try {
    impl.render({
      content: ui.content,
      data: data === undefined ? null : data,
      mode: big ? 'big' : 'panel',
      // 桌面版外壳 0.6.5 以前没有大窗口，面板窗口又太小，就不给这个入口；网页版在页面里铺满。
      openBig: big || (desktopShell() !== null && !(desktopShell().ext && typeof desktopShell().ext.open === 'function')) ? undefined : function () { openBigApp(ui, key) },
      closeBig: big ? function () { closeBigApp(ui) } : undefined,
      send: function (op, payload) { ui.send('ext', { key: key, op: op, data: payload || {} }) },
      walletContent: wallet ? function () { return walletBar(ui, wallet, { open: true }) } : undefined,
      el: el,
      button: button,
      rerender: function () { ui.renderContent() },
      // 玩家现在用的猪图（随皮肤和形态变）；没有立绘时是 null，扩展自己退回 emoji。
      pigArt: function () { var art = ui.view.pig && ui.view.pig.stage ? ui.view.pig.stage.art : null; return art ? artSource(art) : null },
      // 带版本号：扩展更新后换了图，地址也跟着换，不会拿到缓存里的旧图。
      asset: function (name) { return '/dsh-piggy/ext/' + encodeURIComponent(key) + '/assets/' + encodeURIComponent(String(name)) + '?v=' + encodeURIComponent(extension.version) },
      openDex: function (section) {
        ui.select('dex')
        ui.drill.dex = 'ext:' + key + ':' + section
        ui.renderContent()
      },
      // 跳到商店里这个扩展的货架（比如菜园缺种子 → 种子货架），按返回回到扩展页（用户 2026-10-09）。
      openShop: function () {
        // 页面里铺满的大界面先收回去，商店在面板里开；大窗口里就在这扇窗口里开，按返回回到大界面。
        if (big && desktopRole() !== 'ext') { ui.extBig = null; ui.host.setAttribute('data-ext-view', '') }
        ui.select('shop')
        ui.drill.shop = 'ext:' + key
        ui.drill.from = 'ext:' + key
        ui.renderContent()
      },
    })
  } catch (error) {
    ui.content.appendChild(el('div', 'dp-empty', '这个扩展出错了：' + (error instanceof Error ? error.message : String(error))))
  }
}
