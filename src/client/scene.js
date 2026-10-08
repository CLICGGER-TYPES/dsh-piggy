// @ts-check
/**
 * 场景搭建：注入样式与字体，建出猪、气泡、进度条、图标栏与面板骨架。
 *
 * 只创建 DOM，不绑定事件、不读状态（见 docs/CONVENTIONS.md）；
 * 事件与渲染由 shell 负责。
 * @module dsh-piggy/client/scene
 */
import { MOUNTED } from './constants.js'
import { desktopShell } from './desktop-shell.js'
import { el } from './dom.js'
import { CSS } from './styles.js'

/** 网页版的 emoji 字体：跟着插件一起发，用不用得上由 --ac-font 说了算。 */
var WEB_EMOJI_FACE = '@font-face{font-family:"Piggy Emoji";font-style:normal;font-weight:400;'
  + 'font-display:swap;src:url(/dsh-piggy/emoji.woff2) format("woff2")}'

/** Build the widget once and hand every element back to the shell. */
export function createScene() {
var font = document.createElement('link')
font.rel = 'stylesheet'
font.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900'
  + '&family=Noto+Sans+SC:wght@400;500;700&display=swap'
document.head.appendChild(font)

var style = document.createElement('style')
// 网页版自带这套 emoji：很多机器没有对应的表情，或者长得跟别处完全不一样（Windows 10 缺新表情）。
// 桌面版由外壳提供同一个字体家族，这里不能再声明一次，否则同名字体两边打架。
style.textContent = (desktopShell() === null ? WEB_EMOJI_FACE : '') + CSS
document.head.appendChild(style)

var host = document.createElement('div')
host.setAttribute(MOUNTED, '')

// 只在显示时去掉审定 RGB 图片的白底；原文件保留，透明 PNG 不经过滤镜。
var namespace = 'http://www.w3.org/2000/svg'
var svgElement = function (tag) { return typeof document.createElementNS === 'function' ? document.createElementNS(namespace, tag) : document.createElement(tag) }
var filterSvg = svgElement('svg')
filterSvg.setAttribute('width', '0')
filterSvg.setAttribute('height', '0')
filterSvg.setAttribute('aria-hidden', 'true')
filterSvg.style.position = 'absolute'
filterSvg.style.pointerEvents = 'none'
var knockout = svgElement('filter')
knockout.setAttribute('id', 'dp-feedback-knockout')
knockout.setAttribute('color-interpolation-filters', 'sRGB')
var whiteMask = svgElement('feColorMatrix')
whiteMask.setAttribute('in', 'SourceGraphic')
whiteMask.setAttribute('type', 'matrix')
whiteMask.setAttribute('values', '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 -1 -1 0 3')
whiteMask.setAttribute('result', 'white-mask')
var threshold = svgElement('feComponentTransfer')
threshold.setAttribute('in', 'white-mask')
threshold.setAttribute('result', 'cutout-mask')
var alpha = svgElement('feFuncA')
alpha.setAttribute('type', 'linear')
alpha.setAttribute('slope', '10')
alpha.setAttribute('intercept', '-0.2')
threshold.appendChild(alpha)
var cutout = svgElement('feComposite')
cutout.setAttribute('in', 'SourceGraphic')
cutout.setAttribute('in2', 'cutout-mask')
cutout.setAttribute('operator', 'in')
knockout.appendChild(whiteMask)
knockout.appendChild(threshold)
knockout.appendChild(cutout)
filterSvg.appendChild(knockout)

var card = el('div', 'dp-card')
// The pig lives beside the panel, not inside it, so it stays transparent
// and unmoved when the panel opens.
var scene = el('div', 'dp-scene')

var hud = el('div', 'dp-hud')
var hudName = el('div', null, '猪猪')
var hudCoins = el('div', null, '🪙 0')
var hudHealth = el('div', null, '💚 5/5')
hud.appendChild(hudName)
hud.appendChild(hudCoins)
hud.appendChild(hudHealth)
scene.appendChild(hud)

var bubble = el('div', 'dp-bubble', '')
bubble.hidden = true
scene.appendChild(bubble)

// What the pig is doing while it is out: a prop to work/read/travel with,
// and a line showing how far through it is. Sits to the pig's left, so the
// pig itself never shifts when it appears.
var work = el('div', 'dp-work')
var prop = el('span', 'dp-prop', '💼')
var progressWrap = el('div', 'dp-progress')
var progressFill = document.createElement('i')
progressWrap.appendChild(progressFill)
work.appendChild(prop)
work.appendChild(progressWrap)
work.hidden = true
scene.appendChild(work)

// Shown while the box is still shut, so it reads as something to poke
// rather than a decorative cardboard box sitting in the corner.
var pokeHint = el('div', 'dp-poke-hint')
pokeHint.appendChild(el('span', null, '👆'))
pokeHint.appendChild(el('span', null, '戳三下'))
pokeHint.hidden = true
scene.appendChild(pokeHint)

// 签到 / 在线礼包的小气泡，位置在猪头上，样式在 css-tabs.js。
var dailyHint = el('button', 'dp-daily')
dailyHint.hidden = true
scene.appendChild(dailyHint)

var soul = el('span', 'dp-soul', '👻')
soul.hidden = true
scene.appendChild(soul)

// Drawn stages (the piglet, the elder pig) use an <img>; the rest fall
// back to the emoji. Both live in the pig box so the layout never cares.
var pigArt = document.createElement('img')
pigArt.className = 'dp-pig-img'
pigArt.alt = ''
pigArt.hidden = true
var pigSleep = document.createElement('img')
pigSleep.className = 'dp-pig-sleep'
pigSleep.alt = ''
pigSleep.draggable = false
var pigEmoji = el('span', 'dp-pig-emoji', '🐖')
var pig = el('div', 'dp-pig')
pig.appendChild(pigArt)
pig.appendChild(pigEmoji)
pig.appendChild(pigSleep)
var napBubble = el('span', 'dp-nap-zzz', 'Zzz')
napBubble.setAttribute('aria-hidden', 'true')
pig.appendChild(napBubble)
// 装扮点位：每个点位挂一件，位置全在 CSS 里（.dp-slot[data-slot=…]）。
var dressSlots = el('div', 'dp-dress')
pig.appendChild(dressSlots)
pig.appendChild(filterSvg)

// 番茄钟（C2）：专注中贴在猪立绘右上角的小角标，挂在猪身上所以跟着它走。
// 位置别越出猪头上方 20px，也不能高过说话气泡 —— 面板打开时它就够不着面板。
var pomoHint = el('div', 'dp-pomo')
pomoHint.setAttribute('data-pomo-pill', 'true')
pomoHint.hidden = true
pig.appendChild(pomoHint)
scene.appendChild(pig)
// Right-click is not discoverable on its own, so the native tooltip says so.
scene.title = '左键摸摸 · 右键打开面板 · 拖动可移动'

var bar = el('div', 'dp-bar')

var content = el('div', 'dp-content')
var footer = el('div', 'dp-panel-footer')
footer.hidden = true

// Panel first, pig second: as flex siblings in a bottom-anchored column,
// the pig ends up at a fixed screen position whether the panel is open or
// not, and the panel can only ever grow upwards from it.
card.appendChild(content)
card.appendChild(footer)
card.appendChild(bar)
host.appendChild(card)
host.appendChild(scene)
if (document.body !== null && document.body !== undefined) {
  document.body.appendChild(host)
} else {
  document.addEventListener('DOMContentLoaded', function () {
    try { document.body.appendChild(host) } catch (error) { /* shell not ready */ }
  }, { once: true })
}

  return { font, style, host, card, scene, hud, hudName, hudCoins, hudHealth, bubble, work, prop, progressWrap, progressFill, pokeHint, dailyHint, pomoHint, soul, pigArt, pigSleep, pigEmoji, pig, dressSlots, bar, content, footer }
}
