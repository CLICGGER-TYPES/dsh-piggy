// @ts-check
/** 桌面设置的联动许可；只通过外壳 IPC 开关，不向页面暴露发现文件或令牌。 */
import { button, el } from './dom.js'

const states = new WeakMap()

function redraw(state) {
  if (state.ui?.tab === 'settings') state.ui.renderContent()
}

function accept(state, value) {
  if (value === null || typeof value !== 'object') return
  state.value = value
  state.failed = value.ok === false || Boolean(value.error)
}

function stateFor(api, ui) {
  let state = states.get(api)
  if (state === undefined) {
    state = { value: null, failed: false, loading: true, busy: false, ui }
    states.set(api, state)
    api.onStatus?.(value => { accept(state, value); redraw(state) })
    Promise.resolve().then(() => api.get()).then(value => accept(state, value))
      .catch(() => { state.failed = true })
      .finally(() => { state.loading = false; redraw(state) })
  }
  state.ui = ui
  return state
}

export function renderExternalDesktopSettings(ui, section, api) {
  const setting = section(ui, '外部连接', '允许本机的 DSH 和其他 agent 把真实工作投给这只猪，并在 DSH 面板里照顾它')
  setting.box.setAttribute('data-external-desktop', 'true')
  if (typeof api?.get !== 'function' || typeof api?.set !== 'function') {
    setting.box.appendChild(el('small', 'dp-dim', '更新桌面外壳后可用'))
    return
  }
  const state = stateFor(api, ui)
  const enabled = state.value?.enabled === true
  const toggle = button('dp-switch', { 'data-external-allow': String(!enabled), 'aria-pressed': String(enabled), 'aria-label': '允许 DSH 联动' }, async () => {
    if (state.busy || state.loading) return
    state.busy = true
    redraw(state)
    try { accept(state, await api.set(!enabled)) }
    catch { state.failed = true }
    finally { state.busy = false; redraw(state) }
  })
  toggle.disabled = state.busy || state.loading
  toggle.appendChild(el('span', 'dp-switch-knob'))
  toggle.appendChild(el('span', 'dp-switch-text', enabled ? '开' : '关'))
  setting.head.appendChild(toggle)
  let text = '当前关闭；打开后可在 DSH 设置中连接这只猪'
  if (state.loading) text = '正在读取…'
  else if (state.busy) text = '正在切换…'
  else if (state.failed) text = '联动设置未完成，请重试；详细原因可在日志中查看'
  else if (enabled && state.value?.running === true) text = '已允许外部联动；只允许这台电脑连接'
  else if (enabled) text = '已开启许可，但连接服务尚未就绪，请重试'
  setting.box.appendChild(el('small', 'dp-dim', text))
}
