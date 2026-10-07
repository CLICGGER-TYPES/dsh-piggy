// @ts-check
/**
 * 面板窗口里的页面（外壳 0.6.0 起，role=panel）。
 *
 * 这个窗口里只显示面板（名牌 + 卡片），猪藏起来。窗口摆在哪由主进程定（贴着猪、
 * 放不下就换边，见 apps/desktop/main.js 的 panelBounds）；这里只做两件事：
 * 按主进程给的最高高度排好面板，再把排好的大小报上去。面板变高变矮只改这个窗口，
 * 猪的窗口一动不动——这就是拆窗口的意义。
 */

/** 面板窗口专用样式：宿主不再浮在角落、不留给猪的位置；名牌靠猪那一侧。 */
const PANEL_CSS = [
  'html,body{margin:0;padding:0;background:transparent;overflow:hidden}',
  '[data-piggy-role="panel"] [data-dsh-pig]{position:static!important;inset:auto!important;width:max-content!important;',
  // 名牌在 DOM 里排在卡片前面：面板在猪上方时名牌放底下（靠猪），在猪下方时放上面。
  'height:auto!important;display:flex!important;flex-direction:column-reverse;gap:6px;align-items:flex-end;pointer-events:auto!important;transform:none!important}',
  '[data-piggy-role="panel"] [data-dsh-pig][data-panel-vertical="below"]{flex-direction:column}',
  '[data-piggy-role="panel"] .dp-scene{display:none!important}',
  '[data-piggy-role="panel"] .dp-card{position:relative!important;inset:auto!important;margin:0!important}',
  '[data-piggy-role="panel"] .dp-hud{position:relative!important;inset:auto!important;flex-direction:row!important;gap:10px!important;margin:0!important}',
].join('\n')

let shell = /** @type {any} */ (null)
let anchor = { vertical: 'above', maxHeight: 520 }
let lastSize = ''
let scheduled = false

function host() { return /** @type {any} */ (document.querySelector('[data-dsh-pig]')) }

/** 量面板（名牌 + 卡片）多大，报给主进程；没变就不报。 */
function reportSize() {
  const h = host()
  if (h === null || typeof shell?.panel?.size !== 'function') return
  // 面板真打开、内容画好了才报：挂载时那块空卡片只有 64px 高，先报了它，窗口会先小后大地弹一下。
  if (h.getAttribute('data-open') !== 'true') return
  const width = Math.ceil(h.offsetWidth || 0)
  const height = Math.ceil(h.offsetHeight || 0)
  if (width < 1 || height < 1) return
  const key = width + 'x' + height
  if (key === lastSize) return
  lastSize = key
  shell.panel.size(width, height)
}

function schedule() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(function () { scheduled = false; reportSize() })
}

/**
 * 面板窗口版的「把面板摆好」：layout.js 的 fitPanel 在面板窗口里走这里。
 * 卡片最高 = 主进程给的空间 − 名牌；名牌放在靠猪的那一侧。
 * @param {any} ctx
 */
export function fitPanelWindow(ctx) {
  const vertical = anchor.vertical === 'below' ? 'below' : 'above'
  ctx.host.setAttribute('data-panel-vertical', vertical)
  ctx.host.setAttribute('data-panel-side', 'left')
  const hudHeight = ctx.hud && !ctx.hud.hidden ? (ctx.hud.offsetHeight || 0) + 6 : 0
  ctx.card.style.maxHeight = Math.max(120, Math.round(anchor.maxHeight - hudHeight)) + 'px'
  schedule()
}

/** loader.js 在挂载游戏之前调用（面板窗口）。 */
export function installPanel(bridge) {
  shell = bridge
  document.documentElement.setAttribute('data-piggy-role', 'panel')
  const style = document.createElement('style')
  style.setAttribute('data-piggy-panel-style', '')
  style.textContent = PANEL_CSS
  document.head.appendChild(style)
  ;/** @type {any} */ (window).__dshPiggyShell = {
    role: 'panel',
    split: true,
    panel: bridge.panel,
    onStateChanged: bridge.onStateChanged,
    // 面板窗口里没有猪可拖：这些是给「认桌面版」用的空动作（desktop-shell.js 按 beginDrag 认）。
    beginDrag: function () {},
    endDrag: function () {},
    dragHeartbeat: function () {},
    syncGeometry: schedule,
    setAnchor: function (next) { anchor = next },
  }
}

/** 游戏挂载之后调用：名牌挪进面板窗口的排版里，之后内容一变就重新报尺寸。 */
export function startPanel() {
  const h = host()
  if (h === null) return
  const hud = h.querySelector('.dp-hud')
  if (hud !== null) h.insertBefore(hud, h.firstChild)
  if (typeof MutationObserver === 'function') {
    new MutationObserver(schedule).observe(h, { subtree: true, childList: true, attributes: true, characterData: true })
  }
  window.addEventListener('resize', schedule)
  schedule()
}
