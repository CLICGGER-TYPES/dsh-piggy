// @ts-check
/**
 * 居民卡页签（B9，照动森居民卡 + animal-island-ui Form 页的卡片）。
 *
 * 淡色点点底的卡（女孩粉、男孩蓝）：左边头像，右边名字和等级；下面「标签：值」
 * 一行行（生日 / 星座 / 性格 / 口头禅），签名单独一个气泡，最底下一行收藏数。
 * 口头禅和签名旁边的铅笔按钮就地改，改的时候轮询不重画（见 panel.js）。
 * 加冕在主屏自己的 App 里（tabs/crown.js）；加冕后卡上多一行「形态」。
 * @module dsh-piggy/client/tabs/card
 */

import { artSource } from '../art-path.js'
import { button, el } from '../dom.js'

/** How long each editable field may be (mirrors data/profile.js). */
var LIMITS = { catchphrase: 6, motto: 24, name: 16, owner: 12 }

export function renderCardTab(ui) {
  var p = ui.view.pig
  var profile = ui.view.profile
  if (p === null) return
  if (profile === null) {
    ui.content.appendChild(el('div', 'dp-empty', '重启 dsh 之后才有居民卡'))
    return
  }
  var card = el('div', 'dp-vcard')
  card.setAttribute('data-sex', p.sex !== null ? p.sex.key : 'none')

  var top = el('div', 'dp-vcard-top')
  var avatar = el('div', 'dp-vcard-avatar')
  if (p.stage.art !== null) {
    var img = /** @type {HTMLImageElement} */ (el('img', 'dp-vcard-img'))
    img.src = artSource(p.stage.art)
    img.alt = ''
    avatar.appendChild(img)
  } else {
    avatar.appendChild(el('span', 'dp-vcard-e', p.stage.emoji))
  }
  top.appendChild(avatar)
  var who = el('div', 'dp-vcard-who')
  who.appendChild(nameLine(ui, p))
  who.appendChild(el('span', 'dp-vcard-sub', 'Lv.' + p.level.level + ' ' + p.level.titleEmoji + p.level.titleLabel))
  who.appendChild(el('span', 'dp-vcard-sub', p.stage.label))
  top.appendChild(who)
  card.appendChild(top)

  card.appendChild(field('生日', profile.birthday))
  if (profile.zodiac !== null) card.appendChild(field('星座', profile.zodiac.emoji + ' ' + profile.zodiac.label))
  if (profile.personality !== null) card.appendChild(field('性格', profile.personality.emoji + ' ' + profile.personality.label))
  var forms = ui.view.forms
  var worn = forms === null ? null : forms.forms.find(function (f) { return f.current }) || null
  if (worn !== null) card.appendChild(field('形态', worn.emoji + ' ' + worn.label))
  // 猪怎么称呼你从状态页挪到这里改；名字在上面名字旁边的蜡笔改。
  card.appendChild(editableField(ui, 'owner', '叫你', ui.view.dialogue.ownerName))
  card.appendChild(editableField(ui, 'catchphrase', '口头禅', profile.catchphrase))
  card.appendChild(editableField(ui, 'motto', '签名', profile.motto))

  var c = profile.counts
  card.appendChild(el('div', 'dp-vcard-foot',
    '养了 ' + c.days + ' 天 · 证书 ' + c.certificates + ' · 纪念品 ' + c.souvenirs + ' · 毕业 ' + c.graduations))
  ui.content.appendChild(card)
}

/** 「标签：值」 —— the value in a cream pill, like the reference form. */
function field(label, value) {
  var row = el('div', 'dp-vcard-row')
  row.appendChild(el('span', 'dp-vcard-label', label + '：'))
  row.appendChild(el('span', 'dp-vcard-value', value))
  return row
}

/**
 * A field the owner can change in place. The motto gets its own speech
 * bubble rather than a pill: it is the pig talking.
 */
function editableField(ui, key, label, value) {
  var editing = ui.cardEdit !== null && ui.cardEdit.field === key
  var row = el('div', 'dp-vcard-row' + (key === 'motto' ? ' dp-vcard-motto-row' : ''))
  row.appendChild(el('span', 'dp-vcard-label', label + '：'))
  if (editing) {
    appendEditor(ui, row, key)
    return row
  }
  // 称呼只给改的按钮、不把它印在面板上（用户 2026-10-01：「叫你『大爹』」那行删了）。
  if (key === 'owner') row.appendChild(el('span', 'dp-vcard-value dp-dim', '（悄悄记着，不写出来）'))
  else row.appendChild(el('span', key === 'motto' ? 'dp-vcard-value dp-vcard-motto' : 'dp-vcard-value', key === 'motto' ? '「' + value + '」' : value))
  row.appendChild(pencil(ui, key, label, value, 'dp-vcard-edit'))
  return row
}

/**
 * 名字那一行：平时只是名字，鼠标移上去旁边冒出蜡笔，点了就地改（没有单独的「名字」行）。
 */
function nameLine(ui, p) {
  var line = el('div', 'dp-vcard-nameline')
  if (ui.cardEdit !== null && ui.cardEdit.field === 'name') {
    appendEditor(ui, line, 'name')
    return line
  }
  line.appendChild(el('b', 'dp-vcard-name', p.name + (p.sex !== null ? ' ' + p.sex.symbol : '')))
  line.appendChild(pencil(ui, 'name', '名字', p.name, 'dp-vcard-edit dp-vcard-name-edit'))
  return line
}

function pencil(ui, key, label, value, className) {
  var btn = button(className, { 'data-card-edit': key }, function () {
    ui.cardEdit = { field: key, draft: value }
    ui.renderContent()
  })
  btn.textContent = '✏️'
  btn.title = '改' + label
  return btn
}

/** 输入框 + 好 + 算了，接在 `parent` 后面。 */
function appendEditor(ui, parent, key) {
  var input = /** @type {HTMLInputElement} */ (el('input', 'dp-input dp-vcard-input'))
  input.value = ui.cardEdit.draft
  input.maxLength = LIMITS[key]
  input.setAttribute('data-card-input', key)
  input.addEventListener('input', function () { ui.cardEdit = { field: key, draft: input.value } })
  var save = button('dp-mini', { 'data-card-save': key }, function () {
    var text = (ui.cardEdit === null ? '' : ui.cardEdit.draft).trim()
    ui.cardEdit = null
    // 名字和称呼的接口收的是 name，口头禅和签名收的是 text。
    if (text !== '') ui.send(key, key === 'name' || key === 'owner' ? { name: text } : { text: text })
    ui.renderContent()
  })
  save.textContent = '好'
  var cancel = button('dp-mini dp-mini-plain', { 'data-card-cancel': key }, function () {
    ui.cardEdit = null
    ui.renderContent()
  })
  cancel.textContent = '算了'
  parent.appendChild(input)
  parent.appendChild(save)
  parent.appendChild(cancel)
}
