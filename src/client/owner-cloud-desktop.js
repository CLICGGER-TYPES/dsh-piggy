// @ts-check
/** Desktop-only direction controls; DSH has no upload action. */
import { button, el } from './dom.js'

const UPLOADING = '正在上传完整档…'
const READING = '正在读取云端存档…'

/**
 * @param {HTMLElement} box
 * @param {{enabled:boolean}} status
 * @param {string} busy
 * @param {(direction:'local-to-cloud'|'cloud-to-local') => void} onSync
 */
export function renderDesktopDirections(box, status, busy, onSync) {
  box.appendChild(el('p', 'dp-dim', '首次同步要手动选择方向；不会自动覆盖云端或本机。'))
  if (!status.enabled) {
    box.appendChild(el('div', 'dp-alert dp-legacy', '先在上面的「云存档」启用并填写仓库地址，才能做首次同步。'))
  }
  const actions = el('div', 'dp-actions')
  const upload = button('dp-mini dp-btn-wide', { 'data-owner-cloud-first-sync': 'local-to-cloud' }, () => {
    onSync('local-to-cloud')
  })
  upload.textContent = busy === 'upload' ? UPLOADING : '本机完整档上传到云端'
  upload.disabled = busy !== '' || !status.enabled
  actions.appendChild(upload)
  const download = button('dp-btn dp-btn-wide', { 'data-owner-cloud-first-sync': 'cloud-to-local' }, () => {
    onSync('cloud-to-local')
  })
  download.textContent = busy === 'download' ? READING : '从云端恢复到本机副本'
  download.disabled = busy !== '' || !status.enabled
  actions.appendChild(download)
  box.appendChild(actions)
}
