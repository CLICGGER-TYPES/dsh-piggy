// @ts-check
/** 第一次启动下载游戏的小窗口：显示进度，出错时给重试 / 打开下载页 / 退出（lib/first-run.js）。 */
/** @type {{ onStatus: (callback: (status: any) => void) => void, act: (action: string) => void }} */
const bridge = /** @type {any} */ (window).piggyFirstRun
const text = /** @type {HTMLElement} */ (document.getElementById('text'))
const fill = /** @type {HTMLElement} */ (document.getElementById('fill'))
const error = /** @type {HTMLElement} */ (document.getElementById('error'))
const buttons = /** @type {HTMLElement} */ (document.getElementById('buttons'))

document.querySelectorAll('[data-act]').forEach(button => {
  button.addEventListener('click', () => bridge.act(String(button.getAttribute('data-act'))))
})

bridge.onStatus(status => {
  const failed = status.state === 'error'
  error.hidden = !failed
  buttons.hidden = !failed
  if (failed) {
    text.textContent = '下载没成功，检查一下网络再试。'
    error.textContent = status.message || ''
    return
  }
  const percent = Math.round((status.fraction || 0) * 100)
  fill.style.width = (status.state === 'done' ? 100 : percent) + '%'
  text.textContent = status.state === 'done' ? '接回来了，小猪马上出来……' : '正在下载小猪' + (status.version ? ' v' + status.version : '') + '…… ' + percent + '%'
})
