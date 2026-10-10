// @ts-check
/**
 * 加冕 App 暂留到 C4：展示猪猪王条件，通过王冠道具加冕。
 * 左边是那个形态的立绘，右边名字和条件，条件一条条打勾，齐了就能点加冕。
 * 已经是的那种标「当前形态」。
 *
 * 恶魔猪在商店购买契约后从背包签约。
 * @module dsh-piggy/client/tabs/crown
 */

import { artSource } from '../art-path.js'
import { button, el } from '../dom.js'

export function renderCrownTab(ui) {
  var forms = ui.view.forms
  if (forms === null) {
    ui.content.appendChild(el('div', 'dp-empty', '重启 dsh 之后才有加冕'))
    return
  }
  if (ui.view.dead) ui.content.appendChild(el('div', 'dp-empty', '它走了，救回来才能加冕'))
  for (var f = 0; f < forms.forms.length; f += 1) {
    if (forms.forms[f].item !== 'crown') continue
    ui.content.appendChild(formBlock(ui, forms.forms[f]))
  }
}

/** One form: its picture, its conditions as ticked chips, and the button once they are all met. */
function formBlock(ui, form) {
  var box = el('div', form.current ? 'dp-crown dp-crown-now' : 'dp-crown')
  box.setAttribute('data-form', form.key)
  var top = el('div', 'dp-crown-top')
  var pic = el('div', 'dp-crown-pic')
  if (form.art !== '') {
    var img = /** @type {HTMLImageElement} */ (el('img', 'dp-crown-img'))
    img.src = artSource(form.art)
    img.alt = ''
    pic.appendChild(img)
  } else {
    pic.appendChild(el('span', null, form.emoji))
  }
  top.appendChild(pic)
  var side = el('div', 'dp-crown-side')
  side.appendChild(el('div', 'dp-crown-head', form.emoji + ' ' + form.label))
  if (form.current) {
    side.appendChild(el('div', 'dp-crown-done', '✓ 当前形态'))
  } else {
    var chips = el('div', 'dp-crown-reqs')
    for (var r = 0; r < form.requirements.length; r += 1) {
      var row = form.requirements[r]
      chips.appendChild(el('span', row.met ? 'dp-crown-req dp-crown-ok' : 'dp-crown-req',
        (row.met ? '✓ ' : '✗ ') + row.label + ' ' + Math.min(row.have, row.need) + '/' + row.need))
    }
    side.appendChild(chips)
  }
  top.appendChild(side)
  box.appendChild(top)
  if (!form.current) {
    var go = button('dp-btn dp-btn-wide', { 'data-crown': form.key }, function () { ui.send('crown', { form: form.key }) })
    go.textContent = form.hasItem ? '👑 加冕' : '去商店买王冠'
    box.appendChild(go)
  }
  return box
}
