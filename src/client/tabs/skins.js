// @ts-check
/** C6 换肤：内置与玩家皮肤共用一张货架，导入 ZIP 后立即穿上。 */

import { artFrameFor, frameCustomImage } from '../art.js'
import { applyFrame } from '../art-framing.js'
import { artSource } from '../art-path.js'
import { button, el } from '../dom.js'
import { chubbySkinNote } from '../skin-note.js'
import { cancelSkinContactPreview, clampSkinContact, clearSkinContact, effectiveSkinContact, endSkinContactPreview, framedSkinPoint, renewSkinContactPreview, setDeclaredSkinContact, setSkinContactOverride, skinContactSource, startSkinContactPreview, unframedSkinPoint } from '../skin-contact.js'
import { drillTo } from '../widgets.js'
import { renderSkinGuide } from './skin-guide.js'

export function renderSkinsTab(ui) {
  // 面板重绘/切页签/卸载：上一条按住预览在这里收掉（没有预览时是空操作）。
  cancelSkinContactPreview()
  if (ui.drill.skins === 'guide') { renderSkinGuide(ui); return }
  const intro = el('div', 'dp-pick dp-skin-intro')
  intro.appendChild(el('b', null, '给猪猪换件新衣服'))
  intro.appendChild(el('span', null, '厨师与宇航员完成对应工作后解锁；其他皮肤可直接使用。形态会优先显示。'))
  ui.content.appendChild(intro)

  // 胖体型穿皮肤会变回普通体型（体重叠层只画在默认皮肤上），提前说一句，不放大段说明。
  const note = chubbySkinNote(ui.view)
  if (note !== '') {
    const hint = el('div', 'dp-hint dp-skin-note', note)
    hint.setAttribute('data-skin-fat-note', 'true')
    ui.content.appendChild(hint)
  }

  const grid = el('div', 'dp-skin-grid')
  for (const skin of ui.view.skins.entries) grid.appendChild(skinCard(ui, skin))
  ui.content.appendChild(grid)
  // A-2: 特殊外观 / 导入皮肤的小手落点可以在这里校准；默认猪保持原来的自动估计。
  const currentSkin = ui.view.skins.entries.find(entry => entry.current === true)
  if (currentSkin !== undefined && currentSkin.key !== 'default' && currentSkin.unlocked) {
    ui.content.appendChild(contactCard(currentSkin))
  }
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

/**
 * A-2: 摸摸手落点校准（只对当前皮肤，内置特殊外观和导入皮肤都算）。
 *
 * 方框里的坐标是立绘方框的 normalized 坐标（和自动估计、皮肤包 contact 同一套），
 * 拖动时同时按住真的摸摸手，手会当着玩家面落到新位置——“真的作用手落点”不靠存参数。
 * 值只写本机 localStorage：不进存档、不改已有造型、不花钱。
 */
function contactCard(skin) {
  const art = skin.art
  const wrap = el('div', 'dp-pick dp-skin-contact')
  wrap.setAttribute('data-skin-contact', art)
  wrap.appendChild(el('b', 'dp-pick-head', '👋 摸摸手落在哪'))
  wrap.appendChild(el('span', 'dp-dim dp-contact-hint',
    '拖方框里的红点到小猪的头顶或背上，摸摸时手就落在那里。只存在这台设备，不进存档、不花钱。'))

  const pad = el('div', 'dp-contact-pad')
  pad.setAttribute('data-contact-pad', 'true')
  const img = /** @type {HTMLImageElement} */ (el('img', 'dp-contact-art'))
  // 取景表按相对 artSource 的路径查；img.src 属性在浏览器里是绝对地址，不能拿来当键。
  const src = artSource(art)
  img.src = src
  img.alt = skin.label
  img.draggable = false
  const frame = artFrameFor(src)
  // 和真实立绘同一套取景：方框里看到的就是小猪实际显示的样子。
  applyFrame(img, frame)
  // 自定义 PNG 在这里可能还没量过（首次导入时缓存是空的）：先按已知取景画，
  // 等图解码后由 frameCustomImage 回调刷新 zoom/offset，再重画红点、反解指针。
  let zoom = frame === null ? 1 : frame[0]
  let offsetX = frame === null ? 0 : frame[1]
  let offsetY = frame === null ? 0 : frame[2]
  pad.appendChild(img)
  const dot = el('i', 'dp-contact-dot')
  dot.setAttribute('data-contact-dot', 'true')
  pad.appendChild(dot)
  wrap.appendChild(pad)

  const row = el('div', 'dp-contact-row')
  const tryBtn = button('dp-mini', { 'data-contact-try': 'true' }, function () { onceHand(art) })
  tryBtn.textContent = '试试手'
  const autoBtn = button('dp-mini', { 'data-contact-auto': 'true' }, function () {
    clearSkinContact(art)
    paint()
    // 手正在播的话跟着回到自动位置（skin-contact 的变更已经通知 pet-snap 重画了）。
  })
  autoBtn.textContent = '恢复自动'
  row.appendChild(tryBtn)
  row.appendChild(autoBtn)
  const value = el('span', 'dp-contact-value')
  value.setAttribute('data-contact-value', 'true')
  wrap.appendChild(row)
  wrap.appendChild(value)

  const percent = number => Math.round(number * 1000) / 10 + '%'

  function paint() {
    const contact = effectiveSkinContact(art)
    const source = skinContactSource(art)
    if (contact === null) {
      dot.hidden = true
      value.textContent = '现在按自动估计（可见边的上沿中点）。点一下方框就能校准。'
    } else {
      dot.hidden = false
      const point = framedSkinPoint(contact, zoom, offsetX, offsetY)
      dot.style.left = point.x * 100 + '%'
      dot.style.top = point.y * 100 + '%'
      value.textContent = (source === 'pack' ? '皮肤包声明的落点 · ' : '本机校准的落点 · ')
        + percent(contact.x) + ' / ' + percent(contact.y)
    }
    autoBtn.hidden = source === 'auto'
  }
  paint()
  // 复用真实立绘的量法/缓存：已经量过的图同步回调，延迟加载的图等 load 量完再回调。
  frameCustomImage(img, src, false, function (measured) {
    zoom = measured === null ? 1 : measured[0]
    offsetX = measured === null ? 0 : measured[1]
    offsetY = measured === null ? 0 : measured[2]
    paint()
  })

  function pointFromEvent(event) {
    const rect = pad.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return null
    const layout = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
    return clampSkinContact(unframedSkinPoint(layout, zoom, offsetX, offsetY))
  }

  function place(event) {
    const point = pointFromEvent(event)
    if (point === null) return
    setSkinContactOverride(art, point)
    paint()
  }

  let dragging = false
  pad.addEventListener('pointerdown', function (event) {
    dragging = true
    event.preventDefault?.()
    try { pad.setPointerCapture?.(event.pointerId) } catch { /* 没有指针捕获也照样能拖 */ }
    place(event)
    previewHand(art, true)
  })
  pad.addEventListener('pointermove', function (event) {
    if (!dragging) return
    place(event)
    // 按住预览是租约：拖动时续约，最长 PET_PREVIEW_LEASE_MS 没有续约就自动松手。
    renewSkinContactPreview()
  })
  const stop = function () {
    if (!dragging) return
    dragging = false
    previewHand(art, false)
  }
  pad.addEventListener('pointerup', stop)
  pad.addEventListener('pointercancel', stop)
  pad.addEventListener('lostpointercapture', stop)
  return wrap
}

/**
 * 在真实小猪上播一次摸摸手：这就是玩家看到的落点本身，不是另一张示意图。
 * hold=true 时按住不放（拖校准点时一直可见），false 是松手——当前这一轮播完。
 *
 * 只发一条本机预览事件（skin-contact 的 PET_PREVIEW_KEY）：猪在本窗口就直接补发，
 * 桌面版拆窗口时猪窗口靠 storage 事件真正开始/结束预览——面板窗口没有小猪节点也能用。
 * 走的不是游戏 action：不触发 pet/touch、不给奖励、不写养成事件、不存手的状态。
 */
function previewHand(art, hold) {
  if (hold) startSkinContactPreview(art)
  else endSkinContactPreview()
}

/** 单次试播：按下→松手，完整播一轮（5×60ms），不改接触点、不碰游戏状态。 */
function onceHand(art) {
  startSkinContactPreview(art)
  endSkinContactPreview()
}

function importCard(ui) {  const wrap = el('label', 'dp-pick dp-tile-card dp-skin-import')
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
        // A-2: 皮肤包里可选的 contact 在这里落到本机（这时 data 还是原始快照，条目带着 contact）。
        // 落不到的（旧包、没声明）就不记，小手继续用自动估计。
        const imported = (data.skins?.entries ?? []).find(entry => entry.key === data.imported)
        if (imported !== undefined) setDeclaredSkinContact(imported.art, imported.contact)
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
