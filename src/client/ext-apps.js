// @ts-check
/**
 * 下载来的扩展在面板里的部分（v0.30，设计见 docs/design/extension-download.md）。
 *
 * 扩展包里的 client.js 是普通脚本，加载后调用
 *   window.dshPiggyExtensions.register('<key>', { render(app) { … } })
 * `app` 给它：content（往里画）、data（宿主 view 给的数据）、send(op, data)（发给它自己的动作）、
 * el / button（和面板一样的小工具）、rerender()（只改了面板里的状态时重画）、openDex(section)。出错只影响它自己的页面。
 * @module dsh-piggy/client/ext-apps
 */
import { button, el } from './dom.js'
import { walletBar } from './wallet.js'

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

/** 下载扩展的 App 页。 */
export function renderDownloadedApp(ui, key) {
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
  if (wallet) ui.content.appendChild(walletBar(ui, wallet))
  try {
    impl.render({
      content: ui.content,
      data: data === undefined ? null : data,
      send: function (op, payload) { ui.send('ext', { key: key, op: op, data: payload || {} }) },
      el: el,
      button: button,
      rerender: function () { ui.renderContent() },
      openDex: function (section) {
        ui.select('dex')
        ui.drill.dex = 'ext:' + key + ':' + section
        ui.renderContent()
      },
      // 跳到商店里这个扩展的货架（比如菜园缺种子 → 种子货架），按返回回到扩展页（用户 2026-10-09）。
      openShop: function () {
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
