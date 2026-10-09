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
  const setting = section(ui, '网络代理', '用于更新下载和在线扩展')
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
  const form = el('div', 'dp-proxy-form')
  const mode = /** @type {HTMLSelectElement} */ (el('select', 'dp-setting-field'))
  mode.setAttribute('aria-label', '代理模式')
  mode.setAttribute('data-proxy-mode', 'true')
  for (const [key, label] of [['system', '跟随系统代理'], ['direct', '直连（不使用代理）'], ['http', 'HTTP 代理'], ['socks5', 'SOCKS5 代理']]) {
    const option = /** @type {HTMLOptionElement} */ (el('option', null, label))
    option.value = key
    mode.appendChild(option)
  }
  mode.value = draft.mode
  mode.disabled = busy
  const endpoint = /** @type {HTMLInputElement} */ (el('input', 'dp-setting-field'))
  endpoint.disabled = busy
  endpoint.type = 'text'
  endpoint.placeholder = '例如 127.0.0.1:7890'
  endpoint.setAttribute('aria-label', '代理地址和端口')
  endpoint.setAttribute('data-proxy-address', 'true')
  endpoint.value = draft.address
  endpoint.addEventListener('input', () => { draft.address = endpoint.value })
  const address = el('label', 'dp-proxy-endpoint')
  address.appendChild(el('span', 'dp-dim', '代理地址'))
  address.appendChild(endpoint)
  function choose() {
    draft.mode = mode.value
    address.hidden = mode.value === 'system' || mode.value === 'direct'
  }
  mode.addEventListener('change', choose)
  choose()
  form.appendChild(mode)
  form.appendChild(address)
  setting.box.appendChild(form)
  const controls = el('div', 'dp-proxy-actions')
  const status = el('div', failure ? 'dp-proxy-status dp-proxy-error' : 'dp-proxy-status', message)
  status.hidden = !message
  status.setAttribute('role', 'status')
  const actions = []
  async function run(action) {
    if (busy) return
    busy = true
    for (const control of actions) control.disabled = true
    mode.disabled = true
    endpoint.disabled = true
    status.hidden = false
    status.textContent = '处理中…'
    try {
      const result = await action()
      failure = result?.ok !== true
      if (result?.preference) { preference = result.preference; draft = { ...preference } }
      message = failure ? (result?.reason || '代理操作失败') : result.route ? '连接正常' : '代理配置已生效'
    } catch (error) { failure = true; message = error instanceof Error ? error.message : String(error) }
    finally {
      busy = false
      if (ui.tab === 'settings') ui.renderContent()
    }
  }
  for (const [key, label, action] of [
    ['save', '应用', () => api.set({ mode: mode.value, address: endpoint.value })],
    ['test', '测试连接', () => api.test()],
    ['clear', '恢复系统', () => api.clear()],
  ]) {
    const control = button('dp-mini dp-proxy-' + key, { 'data-proxy-action': key }, () => run(action))
    control.textContent = label
    control.disabled = busy
    actions.push(control)
    controls.appendChild(control)
  }
  setting.box.appendChild(controls)
  setting.box.appendChild(status)
}
