// 菜园界面测试夹具：纯内存数据与 fakeDom，不代替实机玩家流程。
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import farm, { weatherAt } from '../../extensions/farm/server.js'
import { applyModalAssetFrame } from '../../src/client/asset-background.js'
import { fakeDom } from './bundle.js'

// 既有 4.0 熟地存档用于旧行为回归；开荒另有独立测试。
export function establishedFarm() { return Object.assign(farm.init(), { plots: Array(18).fill(null) }) }
export const H = 3600000
export let T0 = 0
for (let day = 0; day < 30 && !T0; day += 1) { const at = new Date(2026, 9, 12 + day, 12).getTime(); if (weatherAt(at) === 'sunny') T0 = at }

export function api(balance = 50_000) {
  return { now: T0, coins: () => 0, say() {}, exert() {}, give: () => true,
    wallet: { currency: { label: '菜币', emoji: '🥬', rate: 1 }, balance: () => balance, earn(n) { balance += n; return n }, spend(n) { if (balance < n) return false; balance -= n; return true } } }
}

export function renderFarm(view, mode = 'panel', extra = {}, clientSource = null) {
  const dom = fakeDom()
  const create = dom.document.createElement
  dom.document.createElement = tag => {
    const node = create(tag)
    node.focus = () => { dom.document.activeElement = node; for (const fn of dom.documentListeners.focusin ?? []) fn({ target: node }) }
    node.querySelector = selector => {
      let found = null
      const attr = /^\[([a-z0-9-]+)(?:="([^"]*)")?\]$/.exec(selector)
      node.walk(child => { if (attr ? child.getAttribute(attr[1]) != null && (attr[2] === undefined || child.getAttribute(attr[1]) === attr[2]) : child.matches(selector)) found ||= child })
      return found
    }
    return node
  }
  dom.document.body.querySelector = selector => {
    const attr = /^\[([a-z0-9-]+)(?:="([^"]*)")?\]$/.exec(selector)
    let found = null
    dom.document.body.walk(node => { if (attr ? node.getAttribute(attr[1]) != null && (attr[2] === undefined || node.getAttribute(attr[1]) === attr[2]) : node.matches(selector)) found ||= node })
    return found
  }
  dom.document.getElementById = id => dom.head.children.find(node => node.id === id) || null
  let render
  const window = { dshPiggyExtensions: { register(_key, impl) { render = impl.render } } }
  runInNewContext(clientSource ?? readFileSync(new URL('../../extensions/farm/client.js', import.meta.url), 'utf8'), { window, document: dom.document, Date })
  const sent = []
  let shop = 0
  const app = {
    data: view, content: dom.body, mode,
    el(tag, className, label) { const node = dom.document.createElement(tag); node.className = className ?? ''; if (label !== undefined) node.textContent = label; return node },
    button(className, attrs, onClick) { const node = this.el('button', className); for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v); node.addEventListener('click', onClick); return node },
    send(op, payload) { sent.push({ op, payload }) },
    rerender() { dom.body.children.length = 0; render(app) },
    openShop() { shop += 1 },
    paintFrame(node, name) { const layout = JSON.parse(readFileSync(new URL('../../extensions/farm/manifest.json', import.meta.url), 'utf8')).assetLayout; return applyModalAssetFrame(node, layout[name], extra.asset ? extra.asset(name) : '') },
    ...extra,
  }
  render(app)
  const find = (attr, key) => { let found; dom.body.walk(node => { if (node.getAttribute(attr) === key) found = node }); return found }
  const all = attr => { const out = []; dom.body.walk(node => { if (node.getAttribute(attr) !== null && node.getAttribute(attr) !== undefined) out.push(node) }); return out }
  return { find, all, sent, app, dom, shops: () => all('data-farm-overlay').filter(node => node.getAttribute('data-farm-overlay') === 'shop').length, text: () => dom.body.allText() }
}
export const plain = value => JSON.parse(JSON.stringify(value))

