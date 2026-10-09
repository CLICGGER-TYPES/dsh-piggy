// @ts-check
/**
 * 扩展币钱包条（规则 1，docs/design/economy.md）：扩展页顶上、背包「钱包」页共用。
 * 收起时一行「图标 名字 余额 · 换」，点「换」展开两排：换成金币 / 用金币换，按钮上直接写换得多少。
 * @module dsh-piggy/client/wallet
 */
import { button, el } from './dom.js'

/** 每排给的几个数量；「全部」只在换成金币那排。 */
var TO_GOLD = [10, 100]
var FROM_GOLD = [10, 100, 1000]

export var CSS_WALLET = [
  '.dp-wallet{display:grid;gap:8px;margin:0 0 10px;padding:9px 11px;border-radius:16px;background:var(--ac-bg-input);border:2px solid var(--ac-border-light)}',
  '.dp-wallet-head{display:flex;align-items:center;gap:8px;font-weight:800}',
  '.dp-wallet-emoji{font-size:22px;line-height:1}.dp-wallet-name{font-size:11px;color:var(--ac-text-2);font-weight:700}',
  '.dp-wallet-balance{flex:1;font-size:15px;letter-spacing:.02em}',
  '.dp-wallet-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px}',
  '.dp-wallet-row>small{width:100%;font-size:10px;color:var(--ac-text-2)}',
].join('')

/**
 * @param {any} ui 面板 ctx（要有 view、send、renderContent、drill）
 * @param {{ key: string, label: string, emoji: string, balance: number, rate: number, buyRate: number }} wallet
 * @param {{ open?: boolean }} [options] open：一直展开（背包钱包页）
 */
export function walletBar(ui, wallet, options) {
  var always = options && options.open === true
  var open = always || ui.drill.wallet === wallet.key
  var box = el('div', 'dp-wallet')
  box.setAttribute('data-wallet', wallet.key)
  var head = el('div', 'dp-wallet-head')
  head.appendChild(el('span', 'dp-wallet-emoji', wallet.emoji))
  var name = el('span', 'dp-wallet-balance', String(wallet.balance))
  name.appendChild(el('span', 'dp-wallet-name', ' ' + wallet.label))
  head.appendChild(name)
  if (!always) {
    var toggle = button('dp-mini dp-mini-plain', { 'data-wallet-toggle': wallet.key }, function () {
      ui.drill.wallet = open ? null : wallet.key
      ui.renderContent()
    })
    toggle.textContent = open ? '收起' : '换'
    head.appendChild(toggle)
  }
  box.appendChild(head)
  if (!open) return box

  var coins = Number(ui.view.pig && ui.view.pig.coins) || 0
  var send = function (direction, amount) { ui.send('exchange', { key: wallet.key, direction: direction, amount: amount }) }

  var out = el('div', 'dp-wallet-row')
  out.appendChild(el('small', null, '换成金币 · 1 ' + wallet.label + ' = ' + wallet.rate + ' 🪙'))
  var amounts = TO_GOLD.filter(function (n) { return n < wallet.balance }).concat(wallet.balance > 0 ? [wallet.balance] : [])
  for (var i = 0; i < amounts.length; i += 1) {
    (function (n, all) {
      var gold = Math.floor(n * wallet.rate)
      var go = button('dp-mini', { 'data-wallet-out': all ? 'all' : String(n) }, function () { send('toGold', n) })
      go.textContent = (all ? '全部 ' : '') + n + ' → 🪙 ' + gold
      go.disabled = gold === 0
      out.appendChild(go)
    })(amounts[i], i === amounts.length - 1 && wallet.balance > 0)
  }
  if (wallet.balance === 0) out.appendChild(el('span', 'dp-wallet-name', '还没有' + wallet.label))
  box.appendChild(out)

  var back = el('div', 'dp-wallet-row')
  back.appendChild(el('small', null, '用金币换 · 1 ' + wallet.label + ' = ' + wallet.buyRate + ' 🪙（含 5% 手续费）'))
  for (var j = 0; j < FROM_GOLD.length; j += 1) {
    (function (n) {
      var cost = Math.ceil(n * wallet.buyRate - 1e-9)
      var buy = button('dp-mini dp-mini-plain', { 'data-wallet-in': String(n) }, function () { send('fromGold', n) })
      buy.textContent = '🪙 ' + cost + ' → ' + n
      buy.disabled = coins < cost
      back.appendChild(buy)
    })(FROM_GOLD[j])
  }
  box.appendChild(back)
  return box
}
