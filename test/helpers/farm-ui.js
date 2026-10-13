// 菜园界面测试夹具：纯内存数据与 fakeDom，不代替实机玩家流程。
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import farm, { weatherAt } from '../../extensions/farm/server.js'
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

export function renderFarm(view, mode = 'panel', extra = {}) {
  const dom = fakeDom()
  dom.document.getElementById = id => dom.head.children.find(node => node.id === id) || null
  let render
  const window = { dshPiggyExtensions: { register(_key, impl) { render = impl.render } } }
  runInNewContext(readFileSync(new URL('../../extensions/farm/client.js', import.meta.url), 'utf8'), { window, document: dom.document, Date })
  const sent = []
  let shop = 0
  const app = {
    data: view, content: dom.body, mode,
    el(tag, className, label) { const node = dom.document.createElement(tag); node.className = className ?? ''; if (label !== undefined) node.textContent = label; return node },
    button(className, attrs, onClick) { const node = this.el('button', className); for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v); node.addEventListener('click', onClick); return node },
    send(op, payload) { sent.push({ op, payload }) },
    rerender() { dom.body.children.length = 0; render(app) },
    openShop() { shop += 1 },
    ...extra,
  }
  render(app)
  const find = (attr, key) => { let found; dom.body.walk(node => { if (node.getAttribute(attr) === key) found = node }); return found }
  const all = attr => { const out = []; dom.body.walk(node => { if (node.getAttribute(attr) !== null && node.getAttribute(attr) !== undefined) out.push(node) }); return out }
  return { find, all, sent, app, dom, shops: () => all('data-farm-overlay').filter(node => node.getAttribute('data-farm-overlay') === 'shop').length, text: () => dom.body.allText() }
}
export const plain = value => JSON.parse(JSON.stringify(value))

