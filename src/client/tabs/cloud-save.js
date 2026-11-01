// @ts-check
/** Local cloud-repository settings. First sync/restore is deliberately a later flow. */
import { button, el } from '../dom.js'

const DEFAULT = Object.freeze({ version: 1, enabled: false, provider: 'github', remote: '', branch: 'main' })
let config = null
let loading = false
let busy = false
let editing = false
let draft = null
let message = ''
let failed = false

function cloudApi() {
  const shell = typeof window === 'undefined' ? null : /** @type {any} */ (window)
  return shell?.__dshPiggyShell?.cloudSave ?? shell?.__dshPiggyCloudSave ?? null
}

function providerName(key) {
  return key === 'github' ? 'GitHub' : key === 'gitee' ? 'Gitee' : '其他 Git'
}

function statusBox(box, text, isFailure = false) {
  const status = el('div', isFailure ? 'dp-cloud-status dp-cloud-error' : 'dp-cloud-status', text)
  status.setAttribute('role', 'status')
  status.hidden = text === ''
  box.appendChild(status)
}

function readConfig(ui, api, box) {
  if (loading || config !== null) return
  loading = true
  statusBox(box, '正在读取云存档设置…')
  Promise.resolve(api.get()).then(result => {
    if (result?.ok === true && result.config) {
      config = { ...DEFAULT, ...result.config }
      message = ''
      failed = false
    } else {
      config = { ...DEFAULT }
      message = result?.reason || '云存档设置无法读取'
      failed = true
    }
  }).catch(() => { config = { ...DEFAULT }; message = '云存档设置无法读取'; failed = true }).finally(() => {
    loading = false
    if (ui.tab === 'settings') ui.renderContent()
  })
}

export function renderCloudSaveSettings(ui, section) {
  const api = cloudApi()
  if (api === null || typeof api.get !== 'function' || typeof api.set !== 'function' || typeof api.test !== 'function') return
  const setting = section(ui, '云存档', '连接 Git 仓库；首次同步会另行确认')
  const box = setting.box
  if (config === null) {
    readConfig(ui, api, box)
    if (message) statusBox(box, message, failed)
    return
  }
  if (draft === null) draft = { ...config }

  async function save(next, afterSave = () => {}) {
    if (busy) return
    busy = true
    failed = false
    message = '正在保存…'
    if (ui.tab === 'settings') ui.renderContent()
    try {
      const result = await api.set(next)
      if (result?.ok !== true || !result.config) throw new Error(result?.reason || '云存档设置无法保存')
      config = { ...DEFAULT, ...result.config }
      draft = { ...config }
      editing = false
      message = ''
      afterSave()
    } catch (error) {
      failed = true
      message = error instanceof Error ? error.message : '云存档设置无法保存'
    } finally {
      busy = false
      if (ui.tab === 'settings') ui.renderContent()
    }
  }

  function toggle() {
    const next = { ...config, enabled: !config.enabled }
    void save(next, () => {
      if (config.enabled && !config.remote) {
        editing = true
        draft = { ...config }
      }
    })
  }

  const toggleControl = button('dp-switch', {
    'data-cloud-enabled': config.enabled ? 'on' : 'off',
    'aria-pressed': String(config.enabled),
    'aria-label': '云存档',
  }, toggle)
  toggleControl.disabled = busy
  toggleControl.appendChild(el('span', 'dp-switch-knob'))
  toggleControl.appendChild(el('span', 'dp-switch-text', config.enabled ? '开' : '关'))
  setting.head.appendChild(toggleControl)

  if (!config.enabled) {
    const note = el('small', 'dp-cloud-note', config.remote ? '已关闭；仓库配置保留在本机' : '关闭时不连接仓库')
    box.appendChild(note)
    if (config.remote) {
      const saved = el('div', 'dp-cloud-summary')
      saved.appendChild(el('b', null, providerName(config.provider)))
      const address = el('span', 'dp-cloud-value', config.remote)
      saved.appendChild(address)
      box.appendChild(saved)
    }
    statusBox(box, message, failed)
    return
  }

  if (!config.remote || editing) {
    if (draft === null || !editing) draft = { ...config }
    const form = el('div', 'dp-cloud-form')
    const provider = /** @type {HTMLSelectElement} */ (el('select', 'dp-setting-field'))
    provider.setAttribute('aria-label', 'Git 平台')
    provider.setAttribute('data-cloud-provider', 'true')
    for (const [key, label] of [['github', 'GitHub'], ['gitee', 'Gitee'], ['git', '其他 Git']]) {
      const option = /** @type {HTMLOptionElement} */ (el('option', null, label))
      option.value = key
      provider.appendChild(option)
    }
    provider.value = draft.provider
    provider.disabled = busy
    provider.addEventListener('change', () => { draft.provider = provider.value })
    const providerLabel = el('label', 'dp-cloud-field')
    providerLabel.appendChild(el('span', 'dp-dim', 'Git 平台'))
    providerLabel.appendChild(provider)
    form.appendChild(providerLabel)

    const remote = /** @type {HTMLInputElement} */ (el('input', 'dp-setting-field'))
    remote.type = 'text'
    remote.autocomplete = 'off'
    remote.spellcheck = false
    remote.placeholder = draft.provider === 'github' ? 'https://github.com/用户名/仓库.git' : draft.provider === 'gitee' ? 'https://gitee.com/用户名/仓库.git' : 'https://Git 服务器/用户名/仓库.git'
    remote.setAttribute('aria-label', '仓库地址')
    remote.setAttribute('data-cloud-remote', 'true')
    remote.value = draft.remote
    remote.disabled = busy
    /** @type {HTMLButtonElement|null} */ let saveButton = null
    remote.addEventListener('input', () => {
      draft.remote = remote.value
      if (saveButton !== null) saveButton.disabled = busy || remote.value.trim() === ''
    })
    const remoteLabel = el('label', 'dp-cloud-field')
    remoteLabel.appendChild(el('span', 'dp-dim', '仓库地址'))
    remoteLabel.appendChild(remote)
    form.appendChild(remoteLabel)

    const advanced = el('details', 'dp-cloud-advanced')
    advanced.appendChild(el('summary', null, '高级设置'))
    const branch = /** @type {HTMLInputElement} */ (el('input', 'dp-setting-field'))
    branch.type = 'text'
    branch.autocomplete = 'off'
    branch.placeholder = 'main'
    branch.setAttribute('aria-label', '分支')
    branch.setAttribute('data-cloud-branch', 'true')
    branch.value = draft.branch || 'main'
    branch.disabled = busy
    branch.addEventListener('input', () => { draft.branch = branch.value })
    const branchLabel = el('label', 'dp-cloud-field')
    branchLabel.appendChild(el('span', 'dp-dim', '分支'))
    branchLabel.appendChild(branch)
    advanced.appendChild(branchLabel)
    form.appendChild(advanced)
    box.appendChild(form)

    const actions = el('div', 'dp-cloud-actions')
    const saveControl = button('dp-mini', { 'data-cloud-action': 'save' }, () => {
      void save({ ...draft, enabled: true, remote: remote.value.trim(), branch: branch.value.trim() || 'main' })
    })
    saveButton = saveControl
    saveControl.textContent = '保存'
    saveControl.disabled = busy || remote.value.trim() === ''
    actions.appendChild(saveControl)
    if (config.remote) {
      const cancel = button('dp-mini dp-mini-plain', { 'data-cloud-action': 'cancel' }, () => { draft = { ...config }; editing = false; ui.renderContent() })
      cancel.textContent = '取消'
      cancel.disabled = busy
      actions.appendChild(cancel)
    }
    box.appendChild(actions)
    statusBox(box, message || '填写仓库地址后保存', failed)
    return
  }

  const summary = el('div', 'dp-cloud-summary')
  summary.appendChild(el('b', null, providerName(config.provider)))
  summary.appendChild(el('span', 'dp-cloud-value', config.remote))
  summary.appendChild(el('span', 'dp-cloud-note', '分支 · ' + config.branch))
  summary.appendChild(el('span', 'dp-cloud-status', '状态 · 待连接'))
  summary.appendChild(el('span', 'dp-cloud-note', '最近同步 · 暂无'))
  box.appendChild(summary)

  const actions = el('div', 'dp-cloud-actions')
  const test = button('dp-mini', { 'data-cloud-action': 'test' }, async () => {
    if (busy) return
    busy = true
    failed = false
    message = '正在测试连接…'
    ui.renderContent()
    try {
      const result = await api.test({ ...config })
      failed = result?.ok !== true
      message = failed ? (result?.reason || '连接测试失败') : '连接测试通过；尚未同步存档'
    } catch { failed = true; message = '连接测试失败' }
    finally { busy = false; if (ui.tab === 'settings') ui.renderContent() }
  })
  test.textContent = '测试连接'
  test.disabled = busy
  actions.appendChild(test)
  const edit = button('dp-mini dp-mini-plain', { 'data-cloud-action': 'edit' }, () => { draft = { ...config }; editing = true; message = ''; ui.renderContent() })
  edit.textContent = '编辑'
  edit.disabled = busy
  actions.appendChild(edit)
  const close = button('dp-mini dp-mini-plain', { 'data-cloud-action': 'close' }, toggle)
  close.textContent = '关闭'
  close.disabled = busy
  actions.appendChild(close)
  box.appendChild(actions)
  statusBox(box, message, failed)
}
