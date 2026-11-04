// @ts-check
/** DSH-only copy and controls for complete-owner-archive cloud restore. */
import { button, el } from './dom.js'

/** DSH has no upload action, and its failures are not retryable conflicts. */
export const DSH_REASON_TEXT = Object.freeze({
  'loopback-only': '完整档云同步只在本机打开 DSH 时可用。远程访问不提供恢复入口；请用 127.0.0.1 或 localhost 直接打开 DSH。本机显示与声音偏好不受影响。',
  'owner-cloud-unsupported': '当前 DSH 或插件版本没有完整档云能力。升级插件并重新加载 DSH 后再试。',
  'bad-response': '当前 DSH 或插件版本没有完整档云能力。升级插件并重新加载 DSH 后再试。',
  'owner-switching': '正在切换完整档，请稍后重新检查。',
  network: '无法连接 DSH 后端；请检查宿主是否还在运行，然后重新检查。',
  timeout: '读取完整档云同步状态超时；可以重新检查。',
  'request-invalid': '这个恢复请求无效，当前存档没有改变。',
  method: '当前版本不支持这个操作。',
  unknown: '恢复请求的结果未知，不会自动重试；请检查当前完整档。',
  'remote-branch-empty': '云端这个分支还没有完整档；请先在另一台设备或桌面版上传。',
  'remote-has-history': '云端这个分支已有其他完整档历史，不能直接覆盖；请改用正确的云端存档。',
  'first-sync-required': '这个完整档还没有首次同步记录。',
})

const RETRY_CODES = new Set(['owner-switching', 'network', 'timeout'])

/** @param {string} code @param {unknown} reason */
function dshReason(code, reason) {
  if (Object.hasOwn(DSH_REASON_TEXT, code)) return DSH_REASON_TEXT[code]
  if (typeof reason === 'string' && Object.hasOwn(DSH_REASON_TEXT, reason)) return DSH_REASON_TEXT[reason]
  if (typeof reason === 'string' && reason !== '') return reason
  return '完整档云同步暂时不可用'
}

/**
 * The bridge is present but status could not be read. Stay read-only and only
 * offer a manual re-check for transient failures. 403/404 never get a button.
 * @param {HTMLElement} box
 * @param {{code?:string|null, reason?:string}} status
 * @param {() => void} onRetry
 */
export function renderDshUnavailable(box, status, onRetry) {
  const code = typeof status.code === 'string' ? status.code : ''
  box.appendChild(el('p', 'dp-dim', dshReason(code, status.reason)))
  if (code === 'loopback-only') {
    box.appendChild(el('p', 'dp-dim', '本机文件、后台同步和猪的状态都不受影响。'))
  }
  if (RETRY_CODES.has(code)) {
    const actions = el('div', 'dp-actions')
    const retry = button('dp-mini', { 'data-owner-cloud-retry': 'true' }, onRetry)
    retry.textContent = '重新检查'
    actions.appendChild(retry)
    box.appendChild(actions)
  }
}

/**
 * Only the cloud-to-local direction exists in the DSH panel. A ready archive
 * still shows the button so the user can restore again later.
 * @param {HTMLElement} box
 * @param {{enabled:boolean, ready:boolean}} status
 * @param {{busy:string, unknown:boolean, onRestore:() => void, onCheck:() => void}} options
 */
export function renderDshRestoreEntry(box, status, options) {
  if (!status.enabled) {
    box.appendChild(el('div', 'dp-alert dp-legacy',
      '在 DSH 插件配置里启用 ownerCloud 并填写仓库地址和分支，然后重新加载 DSH。页面只读，不能在这里修改配置。'))
    return
  }
  if (options.unknown) {
    box.appendChild(el('p', 'dp-dim', '结果未知时不会自动重试；先重新检查当前完整档，再决定是否再次恢复。'))
    const actions = el('div', 'dp-actions')
    const check = button('dp-mini', { 'data-owner-cloud-check': 'true' }, options.onCheck)
    check.textContent = '重新检查当前完整档'
    actions.appendChild(check)
    box.appendChild(actions)
    return
  }
  box.appendChild(el('p', 'dp-dim',
    '从云端恢复只读取远端完整档：先预览，确认后建立独立副本并切换；当前存档保留，不会覆盖云端或本机。'))
  const actions = el('div', 'dp-actions')
  const restore = button('dp-btn dp-btn-wide', {
    'data-owner-cloud-restore': 'true',
    'data-owner-cloud-first-sync': 'cloud-to-local',
  }, options.onRestore)
  restore.textContent = options.busy === 'download' ? '正在读取云端存档…' : '从云端恢复到本机副本'
  restore.disabled = options.busy !== ''
  actions.appendChild(restore)
  box.appendChild(actions)
}
