// @ts-check
/**
 * 扩展币钱包条（规则 1，docs/design/economy.md）：扩展页顶上、背包「钱包」页共用。
 * 收起时一行「图标 名字 余额 · 换」，展开后用一根滑条选择兑换数量：
 * 换成金币 / 用金币换，拖动时实时显示能换到多少。
 * @module dsh-piggy/client/wallet
 */
import { button, el } from './dom.js'

export var CSS_WALLET = [
  '.dp-wallet{display:grid;gap:8px;margin:0 0 10px;padding:9px 11px;border-radius:16px;background:var(--ac-bg-input);border:2px solid var(--ac-border-light)}',
  '.dp-wallet-head{display:flex;align-items:center;gap:8px;font-weight:800}',
  '.dp-wallet-emoji{font-size:22px;line-height:1}.dp-wallet-name{font-size:11px;color:var(--ac-text-2);font-weight:700}',
  '.dp-wallet-balance{flex:1;font-size:15px;letter-spacing:.02em}',
  '.dp-wallet-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px}',
  '.dp-wallet-row>small{width:100%;font-size:10px;color:var(--ac-text-2)}',
  // 兑换方向 + 滑条。滑条用原生 range，accent-color 跟着主色走。
  '.dp-wallet-seg{grid-template-columns:repeat(2,minmax(0,1fr));margin:1px 0 3px}',
  '.dp-wallet-slider{display:flex;align-items:center;gap:8px;width:100%}',
  '.dp-wallet-amount-row{display:flex;align-items:center;gap:5px;min-width:0;font-size:10.5px;font-weight:700;color:var(--ac-text-body)}',
  '.dp-wallet-amount-label{color:var(--ac-text-2)}',
  '.dp-wallet-amount{flex:none;width:54px;height:26px;padding:2px 4px;text-align:center;font-size:11px;font-weight:700}',
  '.dp-wallet-amount-unit{color:var(--ac-text-2)}',
  '.dp-wallet-range{appearance:none;-webkit-appearance:none;flex:1;min-width:0;height:24px;margin:0;background:transparent;cursor:pointer}',
  '.dp-wallet-range:focus-visible{outline:2px solid var(--ac-primary);outline-offset:2px;border-radius:999px}',
  '.dp-wallet-range::-webkit-slider-runnable-track{height:8px;border-radius:999px;',
  'background:linear-gradient(to right,var(--ac-primary) 0 var(--wallet-fill,0%),var(--ac-border-light) var(--wallet-fill,0%) 100%)}',
  '.dp-wallet-range::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:18px;height:18px;margin-top:-5px;',
  'border-radius:50%;background:var(--ac-primary);border:2px solid #fff;box-shadow:0 2px 0 rgba(61,52,40,.18)}',
  '.dp-wallet-range::-moz-range-track{height:8px;border-radius:999px;background:var(--ac-border-light)}',
  '.dp-wallet-range::-moz-range-progress{height:8px;border-radius:999px;background:var(--ac-primary)}',
  '.dp-wallet-range::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--ac-primary);border:2px solid #fff}',
  '.dp-wallet-summary{flex:1;min-width:0;font-size:10.5px;font-weight:800;color:var(--ac-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.dp-wallet-note{font-size:9.5px;font-weight:600;color:var(--ac-text-2);text-align:center;line-height:1.4}',
  '.dp-wallet-go{width:100%;justify-self:stretch}',
].join('')

/**
 * @param {any} ui 面板 ctx（要有 view、send、renderContent、drill）
 * @param {{ key: string, label: string, emoji: string, balance: number, rate: number, buyRate: number, buyable?: boolean }} wallet
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
  var canBuy = wallet.buyable !== false && wallet.buyRate > 0
  var dirs = ui.drill.walletDir
  if (!dirs) { dirs = {}; ui.drill.walletDir = dirs }
  var dir = canBuy && dirs[wallet.key] === 'fromGold' ? 'fromGold' : 'toGold'

  function maxFor(next) {
    if (next === 'toGold') return Math.max(0, Math.floor(wallet.balance))
    if (!canBuy) return 0
    return Math.max(0, Math.floor(coins / wallet.buyRate))
  }

  var outTab = null
  var inTab = null
  if (canBuy) {
    var dirRow = el('div', 'dp-seg dp-wallet-seg')
    outTab = button('dp-seg-btn', { 'data-wallet-dir': 'toGold', 'aria-pressed': String(dir === 'toGold') }, function () { setDir('toGold') })
    outTab.textContent = '换金币'
    inTab = button('dp-seg-btn', { 'data-wallet-dir': 'fromGold', 'aria-pressed': String(dir === 'fromGold') }, function () { setDir('fromGold') })
    inTab.textContent = '换币'
    dirRow.appendChild(outTab)
    dirRow.appendChild(inTab)
    box.appendChild(dirRow)
  }

  var slider = el('div', 'dp-wallet-slider')
  var range = /** @type {HTMLInputElement} */ (el('input', 'dp-wallet-range'))
  range.type = 'range'
  range.min = '0'
  range.step = '1'
  range.setAttribute('data-wallet-range', wallet.key)
  range.setAttribute('aria-label', '兑换数量')
  var all = button('dp-mini dp-mini-plain', { 'data-wallet-all': wallet.key }, function () {
    range.value = String(maxFor(dir))
    sync()
  })
  all.textContent = '全部'
  slider.appendChild(range)
  slider.appendChild(all)
  box.appendChild(slider)

  var amountRow = el('div', 'dp-wallet-amount-row')
  amountRow.appendChild(el('span', 'dp-wallet-amount-label', '数量'))
  var amountInput = /** @type {HTMLInputElement} */ (el('input', 'dp-input dp-wallet-amount'))
  amountInput.type = 'number'
  amountInput.min = '0'
  amountInput.step = '1'
  amountInput.setAttribute('data-wallet-amount', wallet.key)
  amountInput.setAttribute('aria-label', '兑换数量')
  amountRow.appendChild(amountInput)
  amountRow.appendChild(el('span', 'dp-wallet-amount-unit', wallet.label))
  var summary = el('b', 'dp-wallet-summary')
  amountRow.appendChild(summary)
  box.appendChild(amountRow)
  var note = el('div', 'dp-wallet-note')
  box.appendChild(note)
  var go = button('dp-mini dp-wallet-go', { 'data-wallet-exchange': wallet.key }, function () {
    var amount = Math.floor(Number(range.value) || 0)
    if (amount > 0) send(dir, amount)
  })
  box.appendChild(go)

  function send(direction, amount) {
    ui.send('exchange', { key: wallet.key, direction: direction, amount: amount })
  }

  function sync(skipInput) {
    var max = maxFor(dir)
    range.max = String(max)
    amountInput.max = String(max)
    var amount = Math.min(max, Math.max(0, Math.floor(Number(range.value) || 0)))
    range.value = String(amount)
    if (skipInput !== true) amountInput.value = String(amount)
    range.disabled = max <= 0
    all.disabled = max <= 0
    range.style.setProperty('--wallet-fill', (max > 0 ? Math.round(amount / max * 100) : 0) + '%')
    if (dir === 'toGold') {
      var gold = Math.floor(amount * wallet.rate)
      note.textContent = '1 ' + wallet.label + ' = ' + wallet.rate + ' 🪙'
      summary.textContent = '→ 🪙 ' + gold
      go.textContent = '兑换 🪙 ' + gold
      go.disabled = amount <= 0 || gold <= 0
    } else {
      var cost = Math.ceil(amount * wallet.buyRate - 1e-9)
      note.textContent = '1 ' + wallet.label + ' = ' + wallet.buyRate + ' 🪙（含 5% 手续费）'
      summary.textContent = '· 花 🪙 ' + cost
      go.textContent = '兑换 ' + amount + ' ' + wallet.label
      go.disabled = amount <= 0 || cost > coins
    }
  }

  function setDir(next) {
    if (next === dir) return
    dir = next
    dirs[wallet.key] = next
    if (outTab !== null) outTab.setAttribute('aria-pressed', String(dir === 'toGold'))
    if (inTab !== null) inTab.setAttribute('aria-pressed', String(dir === 'fromGold'))
    var max = maxFor(dir)
    range.max = String(max)
    range.value = String(dir === 'toGold' ? max : Math.min(10, max))
    sync()
  }

  var initial = maxFor(dir)
  range.max = String(initial)
  range.value = String(dir === 'toGold' ? initial : Math.min(10, initial))
  range.addEventListener('input', sync)
  amountInput.addEventListener('input', function () {
    if (amountInput.value === '') {
      range.value = '0'
      sync(true)
      return
    }
    var raw = Number(amountInput.value)
    if (!Number.isFinite(raw)) return
    var next = Math.floor(raw)
    if (next < 0) next = 0
    var max = maxFor(dir)
    if (next > max) {
      next = max
      amountInput.value = String(max)
    }
    range.value = String(next)
    sync(true)
  })
  amountInput.addEventListener('blur', function () { sync() })
  sync()
  return box
}
