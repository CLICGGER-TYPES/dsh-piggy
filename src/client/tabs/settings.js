// @ts-check
/**
 * 设置：都是这台设备上的显示偏好，不进存档。
 * 每项一行：标题 + 一句说明 + 一排分段按钮（或一个开关）。以前每个选项单独占一行、
 * 各带一个「使用」按钮，小猪大小一项就四行，用户反馈「菜单设计不合理」（2026-10-04）。
 */
import { button, el } from '../dom.js'
import { autoCollapseEnabled, setAutoCollapse } from '../auto-collapse.js'
import { desktopShell } from '../desktop-shell.js'
import { emojiStyle, hasBundledEmoji, setEmojiStyle, applyEmojiStyle } from '../emoji-style.js'
import { PIG_SIZES, displayedPigSize, pigSize, setPigSize } from '../pig-size.js'
import { setWalk, walkEnabled } from '../life.js'
import { exportLogs } from '../log-export.js'
import { str } from '../values.js'
import { renderProxySettings } from './proxy.js'
import { extensionUpdateAvailable } from './extensions.js'

/** 一项设置：标题、说明，下面放控件。 */
function section(ui, title, note) {
  const box = el('div', 'dp-set')
  const head = el('div', 'dp-set-head')
  head.appendChild(el('b', null, title))
  if (note) head.appendChild(el('small', 'dp-dim', note))
  box.appendChild(head)
  ui.content.appendChild(box)
  return { box, head }
}

/** 一排分段按钮；当前选中的那个按下去、不能再点。 */
function segmented({ box }, attr, options, current, onPick) {
  const row = el('div', 'dp-seg')
  for (const option of options) {
    const pick = button('dp-seg-btn', { [attr]: option.key, 'aria-pressed': String(option.key === current) }, function () { onPick(option.key) })
    pick.textContent = option.label
    pick.disabled = option.key === current
    row.appendChild(pick)
  }
  box.appendChild(row)
}

export function renderSettingsTab(ui) {
  // 更新：从主菜单收进设置（G 批次）。有新正式版时带红点，点进去还是原来的更新面板。
  const notice = ui.updateNotice
  const fresh = notice?.unread === true && notice.latest !== null
  const update = section(ui, '更新', fresh ? '有新版本 v' + notice.latest.version : '查看版本、更新或换回旧版本')
  const go = button('dp-mini dp-update-entry', { 'data-open-update': 'true' }, function () { ui.select('update') })
  go.textContent = '🔄 更新'
  if (fresh) go.appendChild(el('b', 'dp-tile-badge dp-update-dot', '!'))
  update.head.appendChild(go)

  const extFresh = extensionUpdateAvailable(ui)
  const extensions = section(ui, '扩展', '本地玩法、开关与在线扩展')
  const openExtensions = button('dp-mini dp-update-entry', { 'data-open-extensions': 'true' }, function () { ui.select('extensions') })
  openExtensions.textContent = '🧩 扩展'
  if (extFresh) openExtensions.appendChild(el('b', 'dp-tile-badge dp-update-dot', '!'))
  extensions.head.appendChild(openExtensions)

  const size = section(ui, '小猪大小', '普通猪、皮肤和睡姿一起调整；只改这台设备，不改存档')
  const sizeLabels = { small: '小', standard: '标准', large: '大', extra: '特大' }
  segmented(size, 'data-pig-size', PIG_SIZES.map(key => ({ key, label: sizeLabels[key] })), pigSize(), function (key) {
    setPigSize(key)
    const stageSize = ui.view.hatched ? ui.view.pig.stage.size : ui.view.boxStage.size
    ui.host.style.setProperty('--pig-size', displayedPigSize(stageSize) + 'px')
    ui.renderContent()
    ui.fitPanel()
    desktopShell()?.syncGeometry?.()
  })

  // 网页版和桌面版都自带了这套 emoji，所以两边都能选（旧外壳没有这个字体，就不显示）。
  if (hasBundledEmoji()) {
    const emoji = section(ui, 'Emoji 样式', '内置是随游戏附带的一整套 Noto 彩色 emoji，各系统看起来一样')
    segmented(emoji, 'data-emoji-style', [
      { key: 'bundled', label: '内置' },
      { key: 'system', label: '系统自带' },
    ], emojiStyle(), function (key) {
      setEmojiStyle(key)
      applyEmojiStyle(ui.host)
      ui.renderContent()
    })
  }

  // 免打扰跟着存档（猪自己的状态），从状态页挪到设置（G 批次）。
  const quiet = section(ui, '免打扰', '开着时猪不主动说话、不报日常消息；生病和意外照常提醒')
  const quietOn = ui.view.dialogue.quiet === true
  const quietToggle = button('dp-switch', { 'data-quiet': quietOn ? 'on' : 'off', 'aria-pressed': String(quietOn) }, function () {
    ui.send('quiet', { on: !quietOn })
  })
  quietToggle.appendChild(el('span', 'dp-switch-knob'))
  quietToggle.appendChild(el('span', 'dp-switch-text', quietOn ? '开' : '关'))
  quiet.head.appendChild(quietToggle)

  const close = section(ui, '点击别处时收起面板', '网页版点面板外、桌面版切到其他窗口时收起')
  const on = autoCollapseEnabled()
  const toggle = button('dp-switch', { 'data-auto-collapse': String(!on), 'aria-pressed': String(on) }, function () {
    setAutoCollapse(!autoCollapseEnabled())
    ui.renderContent()
  })
  toggle.appendChild(el('span', 'dp-switch-knob'))
  toggle.appendChild(el('span', 'dp-switch-text', on ? '开' : '关'))
  close.head.appendChild(toggle)

  // 桌面散步只有桌面版有（G 批次，默认关）。
  if (desktopShell() !== null) {
    const walk = section(ui, '桌面散步', '每 10–20 分钟沿屏幕底边走一段再走回来；拖它、开着面板、免打扰时不走')
    const walking = walkEnabled()
    const walkToggle = button('dp-switch', { 'data-walk': String(!walking), 'aria-pressed': String(walking) }, function () {
      setWalk(!walkEnabled())
      ui.renderContent()
    })
    walkToggle.appendChild(el('span', 'dp-switch-knob'))
    walkToggle.appendChild(el('span', 'dp-switch-text', walking ? '开' : '关'))
    walk.head.appendChild(walkToggle)
  }

  const proxy = desktopShell()?.proxy
  if (proxy) renderProxySettings(ui, section, proxy)

  // 日志：猪出问题时导出这一份，里面记着做了什么、哪一步失败了。
  const logs = section(ui, '日志', '遇到问题导出这一份，里面有版本、动作和报错')
  const exportButton = button('dp-mini', { 'data-export-logs': 'true' }, function () { runExport(ui, exportButton) })
  exportButton.textContent = '📄 导出'
  logs.head.appendChild(exportButton)
  if (exporting) exportButton.disabled = true
}

/** 导出期间按钮不再响应，免得点出好几份。 */
let exporting = false

function runExport(ui, exportButton) {
  if (exporting) return
  exporting = true
  exportButton.disabled = true
  exportButton.textContent = '导出中…'
  exportLogs().then(function (result) {
    exporting = false
    if (result.canceled === true) ui.renderContent()
    else if (result.ok === true) ui.showBubble(result.downloaded === true ? '日志已下载' : '日志已保存', 3200)
    else ui.showBubble('日志没导出：' + str(result.reason, '未知原因'), 4000)
    if (typeof ui.renderContent === 'function') ui.renderContent()
  }).catch(function (error) {
    exporting = false
    ui.showBubble('日志没导出：' + (error instanceof Error ? error.message : String(error)), 4000)
    ui.renderContent()
  })
}
