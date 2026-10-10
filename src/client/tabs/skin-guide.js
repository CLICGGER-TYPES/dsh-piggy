// @ts-check
/**
 * 换肤 App 里的「怎么做皮肤」页（G 批次）：要哪些图、叫什么名字、哪些必须、规格是什么，
 * 再给完整图文教程和示例皮肤包的链接。缩略图借用内置侦探猪的各个动作，看得出每张图画的是什么。
 * @module dsh-piggy/client/tabs/skin-guide
 */
import { artSource } from '../art-path.js'
import { button, el } from '../dom.js'
import { drillHeader } from '../widgets.js'
import { updatesBridge } from './update.js'
import { CHANNEL } from '../../../channel.js'

export const GUIDE_URL = CHANNEL.blobBase + '/docs/guides/creating-skins.md'
export const EXAMPLE_URL = CHANNEL.rawBase + '/docs/examples/skin-pack-example.zip'

/** 十一张图：文件名、必须/可选、什么时候出现、示意用哪张内置图。 */
const POSES = [
  { file: 'idle.png', need: true, when: '平时待着；缺少可选动作时也用它', art: 'skin-detective' },
  { file: 'eat.png', need: true, when: '吃东西', art: 'skin-detective-eat' },
  { file: 'bathe.png', need: true, when: '洗澡', art: 'skin-detective-bathe' },
  { file: 'play.png', need: true, when: '玩耍', art: 'skin-detective-play' },
  { file: 'pet.png', need: true, when: '被摸摸', art: 'skin-detective-pet' },
  { file: 'relaxed.png', need: false, when: '放松、番茄钟陪你专注', art: 'skin-detective-relaxed' },
  { file: 'work.png', need: false, when: '打工', art: 'skin-detective-work' },
  { file: 'study.png', need: false, when: '上学', art: 'skin-detective-study' },
  { file: 'trip.png', need: false, when: '旅行', art: 'skin-detective-trip' },
  { file: 'fish.png', need: false, when: '钓鱼', art: 'skin-detective' },
  { file: 'sleep.png', need: false, when: '打盹时横躺睡觉', art: 'skin-detective-sleep', ext: '.png' },
]

function openLink(url) {
  const shell = updatesBridge()
  if (shell !== null && typeof shell.openPage === 'function') shell.openPage(url)
  else window.open(url, '_blank', 'noopener')
}

export function renderSkinGuide(ui) {
  drillHeader(ui, 'skins', '📐 怎么做皮肤', '11 张图')
  ui.content.appendChild(el('div', 'dp-hint', '一套皮肤 = 一个 ZIP：里面放 skin.json 和下面这些透明 PNG 图（兼容旧 SVG 包）。前 5 张必须有，后 6 张可以不画。动作图缺少时用 idle；sleep 缺少时用默认睡姿。'))
  const grid = el('div', 'dp-guide-grid')
  for (const pose of POSES) {
    const cell = el('div', 'dp-guide-cell' + (pose.need ? '' : ' dp-guide-optional'))
    const img = /** @type {HTMLImageElement} */ (el('img', 'dp-guide-img'))
    img.src = artSource(pose.art)
    img.alt = ''
    cell.appendChild(img)
    cell.appendChild(el('b', null, pose.file))
    cell.appendChild(el('span', 'dp-guide-need', pose.need ? '必须' : '可选'))
    cell.appendChild(el('small', null, pose.when))
    grid.appendChild(cell)
  }
  ui.content.appendChild(grid)

  const rules = el('div', 'dp-pick')
  rules.appendChild(el('b', null, '规格'))
  for (const line of [
    '每张都是透明底 PNG，推荐长边 256px，最多 1024px',
    '猪的身体居中、脚底贴着同一条线（参照默认小猪），切换动作才不会跳',
    '保留完整黑色轮廓和白色装扮，不要白底或运行时抠白',
    '单张 ≤ 96 KB，整个 ZIP ≤ 2 MB',
    'ZIP 打开直接看到 skin.json 和 PNG，不要再包一层文件夹',
  ]) rules.appendChild(el('div', 'dp-guide-rule', '• ' + line))
  rules.appendChild(el('div', 'dp-guide-rule', '旧 SVG 皮肤仍可导入，继续沿用原有安全检查；同一动作只放一种格式。'))
  ui.content.appendChild(rules)

  const json = el('div', 'dp-pick')
  json.appendChild(el('b', null, 'skin.json 写什么'))
  json.appendChild(el('pre', 'dp-guide-code', '{\n  "key": "my-blue-pig",\n  "label": "蓝莓猪",\n  "author": "你的名字",\n  "description": "一句话介绍",\n  "emoji": "🫐"\n}'))
  json.appendChild(el('small', 'dp-dim', 'key 只能用小写字母、数字、短横线；以后更新皮肤保持同一个 key，再导入就会覆盖'))
  ui.content.appendChild(json)

  const links = el('div', 'dp-guide-links')
  const guide = button('dp-btn', { 'data-skin-guide-open': 'true' }, function () { openLink(GUIDE_URL) })
  guide.textContent = '📖 完整图文教程'
  const example = button('dp-btn', { 'data-skin-example': 'true' }, function () { openLink(EXAMPLE_URL) })
  example.textContent = '📦 下载示例皮肤包'
  links.appendChild(guide)
  links.appendChild(example)
  ui.content.appendChild(links)
}
