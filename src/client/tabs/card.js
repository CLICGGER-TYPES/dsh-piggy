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

import { PET_NAME_MAX } from '../../../packages/pet-core/src/data/profile.js'
import { artSource } from '../art-path.js'
import { button, el } from '../dom.js'

/** How long each editable field may be (mirrors data/profile.js). */
var LIMITS = { catchphrase: 6, motto: 24, name: PET_NAME_MAX, owner: 12 }

/** 性格菜单的「点外面收起」监听；每次重画前先摘掉，避免挂着旧 DOM。 */
var menuCleanup = null

function detachMenu() {
  if (menuCleanup === null) return
  menuCleanup()
  menuCleanup = null
}

export function renderCardTab(ui) {
  detachMenu()
  var p = ui.view.pig
  var profile = ui.view.profile
  if (p === null) return
  if (profile === null) {
    ui.content.appendChild(el('div', 'dp-empty', '重启 dsh 之后才有居民卡'))
    return
  }
  var card = el('div', 'dp-vcard')

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

  if (profile.birthdayParts !== null) card.appendChild(editableProfileField(ui, profile, 'birthday'))
  else card.appendChild(field('生日', profile.birthday))
  if (profile.zodiac !== null) card.appendChild(field('星座', profile.zodiac.emoji + ' ' + profile.zodiac.label))
  if (profile.personality !== null && profile.personalities.length) card.appendChild(editableProfileField(ui, profile, 'personality'))
  else if (profile.personality !== null) card.appendChild(field('性格', profile.personality.emoji + ' ' + profile.personality.label))
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
  line.appendChild(el('b', 'dp-vcard-name', p.name))
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
  if (key === 'name') input.setAttribute('aria-label', '名字（最多' + PET_NAME_MAX + '个字）')
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

/**
 * 生日/性格和「叫你」「口头禅」一样：平时是一行值，鼠标移上去行尾出铅笔，
 * 点铅笔只就地改这一项；保存后才发 editProfile。
 */
function editableProfileField(ui, profile, key) {
  var editing = ui.cardEdit !== null && ui.cardEdit.field === key
  var row = el('div', 'dp-vcard-row' + (editing && key === 'birthday' ? ' dp-vcard-birthday' : ''))
  row.appendChild(el('span', 'dp-vcard-label', (key === 'birthday' ? '生日' : '性格') + '：'))
  if (editing) {
    if (key === 'birthday') appendBirthdayEditor(ui, row)
    else appendPersonalityEditor(ui, row, profile)
    return row
  }
  var value = key === 'birthday'
    ? profile.birthday
    : profile.personality.emoji + ' ' + profile.personality.label
  row.appendChild(el('span', 'dp-vcard-value', value))
  var btn = button('dp-vcard-edit', { 'data-card-edit': key }, function () {
    ui.cardEdit = key === 'birthday'
      ? { field: 'birthday', month: profile.birthdayParts.month, day: profile.birthdayParts.day }
      : { field: 'personality', personality: profile.personality.key }
    ui.renderContent()
  })
  btn.textContent = '✏️'
  btn.title = key === 'birthday' ? '改生日' : '改性格'
  row.appendChild(btn)
  return row
}

/** 生日：两个数字框 + 好/算了，只发 month/day。 */
function appendBirthdayEditor(ui, row) {
  var draft = ui.cardEdit
  var number = function (key, max, value) {
    var input = /** @type {HTMLInputElement} */ (el('input', 'dp-input dp-vcard-date'))
    input.type = 'number'
    input.min = '1'
    input.max = String(max)
    input.value = String(value)
    input.setAttribute('data-card-input', 'birthday-' + key)
    input.addEventListener('input', function () { draft[key] = Number(input.value) })
    return input
  }
  // 日期框要能看清数字：单独一行放两个大输入框，好/算了另起一行，
  // 避免和标签、按钮挤在同一行把框压到二十几像素。
  var fields = el('div', 'dp-vcard-date-fields')
  fields.appendChild(number('month', 12, draft.month))
  fields.appendChild(el('span', null, '月'))
  fields.appendChild(number('day', 31, draft.day))
  fields.appendChild(el('span', null, '日'))
  row.appendChild(fields)
  var actions = el('div', 'dp-vcard-edit-actions')
  row.appendChild(actions)
  appendProfileActions(ui, actions, 'birthday', function () {
    ui.send('editProfile', { month: draft.month, day: draft.day })
  })
}

/**
 * 性格：自绘下拉。原生 select 的弹出列表在 Electron 里会在鼠标松开时收掉，
 * 用户只能按住拖选；这里用卡片内的列表，点开后会一直留着。
 */
function appendPersonalityEditor(ui, row, profile) {
  var draft = ui.cardEdit
  var current = profile.personalities[0]
  profile.personalities.forEach(function (p) { if (p.key === draft.personality) current = p })
  var wrap = el('span', 'dp-vcard-select-wrap')
  var trigger = button('dp-vcard-select', {
    'data-card-input': 'personality',
    'aria-haspopup': 'listbox',
    'aria-expanded': draft.menuOpen === true ? 'true' : 'false'
  }, function () {
    draft.menuOpen = draft.menuOpen !== true
    ui.renderContent()
  })
  trigger.appendChild(el('span', 'dp-vcard-select-value', current.emoji + ' ' + current.label))
  trigger.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    draft.menuOpen = false
    ui.renderContent()
  })
  wrap.appendChild(trigger)
  if (draft.menuOpen === true) {
    var menu = el('div', 'dp-vcard-select-menu')
    menu.setAttribute('role', 'listbox')
    menu.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      draft.menuOpen = false
      ui.renderContent()
    })
    var activeOption = null
    profile.personalities.forEach(function (p) {
      var option = button('dp-vcard-select-option', {
        'data-card-option': p.key,
        role: 'option',
        'aria-selected': p.key === draft.personality ? 'true' : 'false'
      }, function () {
        draft.personality = p.key
        draft.menuOpen = false
        ui.renderContent()
      })
      if (p.key === draft.personality) {
        option.setAttribute('data-active', 'true')
        activeOption = option
      }
      option.appendChild(el('span', 'dp-vcard-select-emoji', p.emoji))
      option.appendChild(el('span', 'dp-vcard-select-label', p.label))
      menu.appendChild(option)
    })
    wrap.appendChild(menu)
    // 展开时把当前性格滚到菜单中间，省得每次从「元气」开始找。
    // 这时 row 还没挂到文档上，offsetTop 是 0；等本轮渲染结束再滚。
    if (activeOption !== null) {
      setTimeout(function () {
        if (typeof activeOption.offsetTop === 'number' && typeof menu.scrollTop === 'number') {
          menu.scrollTop = Math.max(0, activeOption.offsetTop - 56)
        }
      }, 0)
    }
    bindMenuDismiss(ui, row, draft)
  }
  row.appendChild(wrap)
  appendProfileActions(ui, row, 'personality', function () {
    ui.send('editProfile', { personality: draft.personality })
  })
}

/** 点菜单和这一行之外的地方收起；点「好/算了」不拦，照常保存。 */
function bindMenuDismiss(ui, row, draft) {
  detachMenu()
  var doc = (ui.content && ui.content.ownerDocument) || (typeof document === 'undefined' ? null : document)
  if (doc === null || typeof doc.addEventListener !== 'function') return
  var onDown = function (event) {
    var target = event.target
    if (typeof row.contains === 'function' && row.contains(target)) return
    draft.menuOpen = false
    detachMenu()
    ui.renderContent()
  }
  doc.addEventListener('pointerdown', onDown, true)
  menuCleanup = function () { doc.removeEventListener('pointerdown', onDown, true) }
}

function appendProfileActions(ui, row, key, save) {
  var ok = button('dp-mini', { 'data-card-save': key }, function () {
    ui.cardEdit = null
    save()
    ui.renderContent()
  })
  ok.textContent = '好'
  var cancel = button('dp-mini dp-mini-plain', { 'data-card-cancel': key }, function () {
    ui.cardEdit = null
    ui.renderContent()
  })
  cancel.textContent = '算了'
  row.appendChild(ok)
  row.appendChild(cancel)
}
