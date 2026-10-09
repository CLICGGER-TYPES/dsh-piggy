// @ts-check
/**
 * 「设置 → 扩展」里的「从文件导入」（宿主见 store/ext-import.js）。
 *
 * 选一个扩展包（.piggyext），或者一次选中扩展的三个文件（manifest.json、server.js、client.js），面板拼成扩展包发给宿主。
 * 官方扩展直接装；不是官方的，宿主先回 'unofficial'，这里在卡片上说明风险，点「仍要导入」才带 confirm 再发一次。
 * @module dsh-piggy/client/ext-import
 */
import { button, el } from './dom.js'
import { obj, str } from './values.js'

const NAMES = ['manifest.json', 'server.js', 'client.js']
/** 等用户确认的非官方扩展：{ bundle, label, version }。放在模块上，面板轮询重画也不丢。 */
let pending = null
let busy = false

/** 读选中的文件，拼成扩展包原文；读不懂返回 null。 @param {File[]} files */
async function bundleOf(files) {
  if (files.length === 1) return files[0].text()
  const texts = {}
  for (const file of files) if (NAMES.includes(file.name)) texts[file.name] = await file.text()
  if (!NAMES.every(name => typeof texts[name] === 'string')) return null
  let key = ''
  try { key = str(obj(JSON.parse(texts['manifest.json'])).key, '') } catch { return null }
  return JSON.stringify({ format: 'dsh-piggy-extension', version: 1, key, files: texts })
}

/** UTF-8 → base64（桌面版的本地协议把请求体当文本读，跟导入皮肤一样走 base64）。 @param {string} text */
function base64(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
  return btoa(binary)
}

const REASONS = {
  'invalid-bundle': '读不懂这个文件',
  'game-too-old': '这个扩展要更新的游戏',
  'too-large': '扩展包太大',
  'broken-extension': '扩展装上了但加载出错',
  'download-failed': '没能写进扩展目录',
  absent: '还没有猪',
}

/** @param {any} ui @param {string} bundle @param {boolean} confirm */
function send(ui, bundle, confirm) {
  busy = true
  ui.renderContent()
  fetch('/dsh-piggy/extensions/import', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: base64(JSON.stringify({ bundle, confirm })) })
    .then(response => response.json())
    .then(data => {
      busy = false
      const result = obj(data)
      if (result.ok === true) {
        pending = null
        if (typeof ui.render === 'function') ui.render(result)
        else { ui.view = result; ui.renderContent() }
        ui.showBubble('装好了：' + str(result.label, '扩展') + (result.official === true ? '' : '（本地导入）'))
        return
      }
      if (result.reason === 'unofficial') { pending = { bundle, label: str(result.label, str(result.key, '扩展')), version: str(result.version, '') }; ui.renderContent(); return }
      pending = null
      ui.renderContent()
      const why = REASONS[str(result.reason, '')] ?? '导入失败'
      ui.showBubble(why + (result.need ? '（要游戏 v' + str(result.need, '') + '）' : '') + (result.message ? '：' + str(result.message, '') : ''))
    })
    .catch(() => { busy = false; ui.renderContent(); ui.showBubble('导入失败：没能送到宿主') })
}

/** 扩展页里「从文件导入」那张卡片。 @param {any} ui */
export function importCard(ui) {
  const card = el('div', 'dp-set dp-ext-card dp-ext-import')
  const head = el('div', 'dp-set-head')
  head.appendChild(el('span', 'dp-ext-emoji', '📦'))
  head.appendChild(el('b', null, '从文件导入'))
  head.appendChild(el('small', 'dp-dim', '下载不了时，用别处拿到的扩展包（.piggyext），或一起选中扩展的三个文件。'))
  card.appendChild(head)
  if (pending !== null) {
    const ask = pending
    card.appendChild(el('div', 'dp-ext-note dp-ext-warn', '「' + ask.label + (ask.version ? ' ' + ask.version : '') + '」不是官方扩展。扩展里的代码在游戏里什么都能做，只装你信得过的人给的。'))
    const row = el('div', 'dp-ext-actions')
    const yes = button('dp-mini dp-ext-danger', { 'data-ext-import-confirm': 'true' }, () => send(ui, ask.bundle, true))
    yes.textContent = busy ? '导入中…' : '仍要导入'
    yes.disabled = busy
    const no = button('dp-mini dp-mini-plain', { 'data-ext-import-cancel': 'true' }, () => { pending = null; ui.renderContent() })
    no.textContent = '算了'
    row.appendChild(yes)
    row.appendChild(no)
    card.appendChild(row)
    return card
  }
  const pick = el('label', 'dp-mini dp-ext-import-pick')
  pick.appendChild(el('span', null, busy ? '导入中…' : '选择文件'))
  const input = /** @type {HTMLInputElement} */ (el('input'))
  input.type = 'file'
  input.multiple = true
  input.setAttribute('accept', '.piggyext,.json,.js')
  input.setAttribute('data-ext-import', 'file')
  input.disabled = busy
  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? [])
    if (files.length === 0) return
    bundleOf(files).then(bundle => {
      if (bundle === null) { ui.showBubble('要选一个 .piggyext，或者 manifest.json、server.js、client.js 三个一起选'); return }
      send(ui, bundle, false)
    }).catch(() => ui.showBubble('读不了这个文件'))
  })
  pick.appendChild(input)
  card.appendChild(pick)
  return card
}
