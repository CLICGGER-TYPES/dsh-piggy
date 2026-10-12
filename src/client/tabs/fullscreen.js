// @ts-check
/**
 * 设置 → 全屏时（桌面外壳 0.6.5 起）：别的程序全屏（玩游戏、看视频）时小猪隐藏还是照常显示。
 * 偏好存在外壳那边（主进程启动时就要用），这里只读写。旧外壳没有这个口子，就不显示这一项。
 */
import { button, el } from '../dom.js'

/** @type {{mode:string, supported:boolean, checking:boolean, reason:string, platform:string} | null} */
let current = null
let loading = false
let busy = false

const OPTIONS = [{ key: 'hide', label: '隐藏小猪' }, { key: 'show', label: '照常显示' }]

function note(value) {
  if (value === null) return '正在读取…'
  if (!value.supported) return '这台电脑检测不了全屏（' + (value.reason || '原因未知') + '），小猪会一直显示'
  if (value.mode === 'show') return value.platform === 'darwin' ? '全屏程序的桌面里也显示小猪' : '小猪压在全屏画面上面；独占全屏的游戏系统不让任何窗口盖上去'
  return '小猪所在的屏幕上有程序全屏时先藏起来，退出全屏再回来'
}

export function renderFullscreenSettings(ui, section, api) {
  const setting = section(ui, '全屏时（玩游戏、看视频）', note(current))
  if (current === null) {
    if (!loading) {
      loading = true
      api.get().then(value => { if (value?.mode) current = value }).catch(() => {}).finally(() => {
        loading = false
        if (ui.tab === 'settings') ui.renderContent()
      })
    }
    return
  }
  const row = el('div', 'dp-seg')
  for (const option of OPTIONS) {
    const pick = button('dp-seg-btn', { 'data-fullscreen-mode': option.key, 'aria-pressed': String(option.key === current.mode) }, function () {
      if (busy) return
      busy = true
      api.set(option.key).then(value => { if (value?.ok) current = value }).catch(() => {}).finally(() => {
        busy = false
        if (ui.tab === 'settings') ui.renderContent()
      })
    })
    pick.textContent = option.label
    pick.disabled = busy || option.key === current.mode
    row.appendChild(pick)
  }
  setting.box.appendChild(row)
}
