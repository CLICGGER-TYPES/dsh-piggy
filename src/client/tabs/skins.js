// @ts-check
/** C6 换肤：内置与玩家皮肤共用一张货架，导入 ZIP 后立即穿上。 */

import { artSource } from '../art-path.js'
import { button, el } from '../dom.js'
import { drillTo } from '../widgets.js'
import { renderSkinGuide } from './skin-guide.js'

export function renderSkinsTab(ui) {
  if (ui.drill.skins === 'guide') { renderSkinGuide(ui); return }
  const intro = el('div', 'dp-pick dp-skin-intro')
  intro.appendChild(el('b', null, '给猪猪换件新衣服'))
  intro.appendChild(el('span', null, '厨师与宇航员完成对应工作后解锁；其他皮肤可直接使用。形态会优先显示。'))
  ui.content.appendChild(intro)

  const grid = el('div', 'dp-skin-grid')
  for (const skin of ui.view.skins.entries) grid.appendChild(skinCard(ui, skin))
  ui.content.appendChild(grid)
  ui.content.appendChild(importCard(ui))
  // G 批次：说清楚自己做皮肤要哪些图、什么规格（以前只有一行字）。
  const howto = button('dp-btn dp-skin-howto', { 'data-skin-guide': 'true' }, function () { drillTo(ui, 'skins', 'guide') })
  howto.textContent = '📐 怎么做皮肤：需要哪些图'
  ui.content.appendChild(howto)
}

function skinCard(ui, skin) {
  const card = el('div', 'dp-item dp-skin-row' + (skin.current ? ' dp-skin-current' : ''))
  if (!skin.unlocked) card.setAttribute('data-locked', 'true')
  const img = /** @type {HTMLImageElement} */ (el('img', 'dp-skin-art'))
  img.src = artSource(skin.art)
  img.alt = skin.label
  card.appendChild(img)
  const copy = el('span', 'dp-grow dp-skin-copy')
  copy.appendChild(el('b', null, (skin.unlocked ? skin.emoji : '🔒') + ' ' + (skin.unlockJob ? '职业 · ' : '') + skin.label))
  copy.appendChild(el('small', 'dp-dim', skin.unlocked
    ? (skin.description || ('作者：' + skin.author))
    : ('完成' + (ui.view.jobs.find(job => job.key === skin.unlockJob)?.label ?? skin.label.replace(/猪$/, '')) + '工作后解锁')))
  card.appendChild(copy)
  const pick = button('dp-mini', { 'data-skin': skin.key }, function () {
    if (skin.unlocked) ui.send('skin', { skin: skin.key })
  })
  pick.textContent = !skin.unlocked ? '未解锁' : (skin.current ? '使用中' : '使用')
  pick.disabled = !skin.unlocked || skin.current
  card.appendChild(pick)
  return card
}

function importCard(ui) {
  const wrap = el('label', 'dp-pick dp-tile-card dp-skin-import')
  wrap.appendChild(el('b', 'dp-pick-head', '📦 导入自己的皮肤'))
  wrap.appendChild(el('span', 'dp-dim', '选择按教程制作的 ZIP；导入成功后会自动使用。'))
  const input = /** @type {HTMLInputElement} */ (el('input'))
  input.type = 'file'
  input.accept = '.zip,application/zip'
  input.setAttribute('accept', '.zip,application/zip')
  input.setAttribute('data-skin-import', 'zip')
  input.addEventListener('change', function () {
    const file = input.files?.[0]
    if (!file) return
    // 以 base64 文本发送：桌面版的本地协议会把请求体当文本读，直接发二进制 ZIP 会被读坏
    // （G 批次实测：桌面版导入官方示例包也报「ZIP 目录损坏」）。宿主两种格式都认。
    file.arrayBuffer()
      .then(function (buffer) {
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
        return fetch('/dsh-piggy/skins/import', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: btoa(binary) })
      })
      .then(response => response.json())
      .then(data => {
        if (data.ok !== true) return ui.showBubble('导入失败：' + ((data.errors || [data.reason]).join('；') || '请检查皮肤包'))
        if (typeof ui.render === 'function') ui.render(data)
        else { ui.view = data; ui.renderContent() }
        ui.showBubble('皮肤导入成功 🎨')
      })
      .catch(() => ui.showBubble('导入失败：无法读取皮肤包'))
  })
  wrap.appendChild(input)
  wrap.appendChild(el('span', 'dp-mini dp-skin-file', '选择 ZIP'))
  return wrap
}
