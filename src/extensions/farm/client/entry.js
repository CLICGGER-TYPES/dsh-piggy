// @ts-check
/** 菜园单一 client IIFE 的模块入口；仅此处注册扩展并为该实例分配临时状态。 */
import { createFarmState } from './state.js'
import { createFarmHostTools } from './host.js'
import { createFarmEvents } from './events.js'
import { createFarmGardenRenderer } from './render-garden.js'
import { createFarmHelperRenderer } from './render-helper.js'
import { createFarmCommerceRenderer } from './render-commerce.js'

/** @returns {{render:(app:import('./host.js').FarmHost)=>void}} */
export function createFarmClient() {
  const state = createFarmState()
  /** @type {any} */
  const modules = {}
  modules.host = createFarmHostTools()
  modules.events = createFarmEvents(state, modules)
  modules.garden = createFarmGardenRenderer(state, modules)
  modules.helper = createFarmHelperRenderer(state, modules)
  modules.commerce = createFarmCommerceRenderer(state, modules)

  /** @param {import('./host.js').FarmHost} app */
  function render(app) {
    modules.host.ensureStyle(app)
    const data = app.data
    if (!data || !Array.isArray(data.plots) || !data.plots.length || data.plots[0] === null || typeof data.plots[0] !== 'object') {
      app.content.appendChild(app.el('div', 'dp-empty', '菜园还在准备……'))
      return
    }
    if (!data.currency) data.currency = { emoji: '🪙', label: '金币' }
    state.currentApp = app
    modules.events.bindKeyboard()
    modules.events.finishAction(app, data)
    modules.events.syncHand(data)
    modules.garden.renderGarden(app, data)
    const root = app.content.querySelector('.fm')
    if (root) {
      state.currentKey = modules.events.pageKey(app)
      if (app.mode === 'big') { state.lastRoot = root; modules.events.watchScroll(root) }
      else if (!state.watchingContent) { state.watchingContent = true; modules.events.watchScroll(app.content) }
      modules.events.restoreScroll(app, state.currentKey)
      modules.events.syncModalFocus(app, root)
      root.addEventListener('click', function (event) {
        if (state.popup && !state.purchase && !((/** @type {Element} */ (event.target)).closest('.fm-pop,button,input'))) modules.events.closePage(app)
      })
    }
  }

  return { render }
}

const client = createFarmClient()
const extensionHost = /** @type {any} */ (window)
if (extensionHost.dshPiggyExtensions) extensionHost.dshPiggyExtensions.register('farm', { render: client.render })
