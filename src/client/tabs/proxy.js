// @ts-check
/** Desktop-only network preferences; OS settings are never modified. */
import { button, el } from '../dom.js'

let preference = null
let loading = false
let busy = false
let draft = null
let message = ''
let failure = false

export function renderProxySettings(ui, section, api) {
  const setting = section(ui, '网络代理', '用于游戏更新、外壳更新和在线扩展；只改小猪，不改系统')
  if (preference === null) {
    setting.box.appendChild(el('small', 'dp-dim', message || '正在读取代理配置…'))
    if (!loading && !message) {
      loading = true
      api.get().then(value => {
        if (value?.mode) { preference = value; message = value.warning || '' }
        else message = value?.reason || '代理配置无法读取'
      }).catch(error => { message = String(error) }).finally(() => {
        loading = false
        if (ui.tab === 'settings') ui.renderContent()
      })
    }
    return
  }
  if (draft === null) draft = { ...preference }
  const modes = el('div', 'dp-seg')
  const endpoint = /** @type {HTMLInputElement} */ (el('input', 'dp-input'))
  endpoint.disabled = busy
  endpoint.type = 'text'
  endpoint.placeholder = '127.0.0.1:端口'
  endpoint.setAttribute('aria-label', '代理地址和端口')
  endpoint.setAttribute('data-proxy-address', 'true')
  endpoint.value = draft.address
  endpoint.addEventListener('input', () => { draft.address = endpoint.value })
  let mode = draft.mode
  const picks = []
  function choose(value) {
    mode = value
    draft.mode = value
    for (const pick of picks) pick.setAttribute('aria-pressed', String(pick.getAttribute('data-proxy-mode') === mode))
    endpoint.hidden = mode === 'system' || mode === 'direct'
  }
  for (const [key, label] of [['system', '跟随系统'], ['direct', '直连'], ['http', 'HTTP'], ['socks5', 'SOCKS5']]) {
    const pick = button('dp-seg-btn', { 'data-proxy-mode': key }, () => choose(key))
    pick.textContent = label
    modes.appendChild(pick)
    pick.disabled = busy
    picks.push(pick)
  }
  setting.box.appendChild(modes)
  setting.box.appendChild(endpoint)
  choose(mode)
  const controls = el('div', 'dp-seg')
  const status = el('div', failure ? 'dp-dim dp-proxy-error' : 'dp-dim', message)
  status.setAttribute('role', 'status')
  const actions = []
  async function run(action) {
    if (busy) return
    busy = true
    for (const control of actions) control.disabled = true
    for (const pick of picks) pick.disabled = true
    endpoint.disabled = true
    status.textContent = '处理中…'
    try {
      const result = await action()
      failure = result?.ok !== true
      if (result?.preference) { preference = result.preference; draft = { ...preference } }
      message = failure ? (result?.reason || '代理操作失败') : result.route ? '连接成功 · ' + result.route : '代理配置已生效'
    } catch (error) { failure = true; message = error instanceof Error ? error.message : String(error) }
    finally {
      busy = false
      if (ui.tab === 'settings') ui.renderContent()
    }
  }
  for (const [key, label, action] of [
    ['save', '应用', () => api.set({ mode, address: endpoint.value })],
    ['test', '测试已应用配置', () => api.test()],
    ['clear', '清除配置', () => api.clear()],
  ]) {
    const control = button('dp-mini', { 'data-proxy-action': key }, () => run(action))
    control.textContent = label
    control.disabled = busy
    actions.push(control)
    controls.appendChild(control)
  }
  setting.box.appendChild(controls)
  setting.box.appendChild(el('div', 'dp-dim', '清除后恢复跟随系统；直连可忽略系统代理'))
  setting.box.appendChild(status)
}
