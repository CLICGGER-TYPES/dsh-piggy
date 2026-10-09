// @ts-check
/** 第一次启动下载游戏的小窗口：显示进度，出错时给重试 / 打开下载页 / 退出（../first-run.js）。 */
/** @type {{ onStatus: (callback: (status: any) => void) => void, act: (action: string) => void, fit: (height: number) => void }} */
const bridge = /** @type {any} */ (window).piggyFirstRun
const text = /** @type {HTMLElement} */ (document.getElementById('text'))
const fill = /** @type {HTMLElement} */ (document.getElementById('fill'))
const error = /** @type {HTMLElement} */ (document.getElementById('error'))
const buttons = /** @type {HTMLElement} */ (document.getElementById('buttons'))

document.querySelectorAll('[data-act]').forEach(button => {
  button.addEventListener('click', () => bridge.act(String(button.getAttribute('data-act'))))
})

/** 窗口按内容高度调（出错时多了原因和按钮）。 */
const fit = () => bridge.fit(document.querySelector('main')?.getBoundingClientRect().height ?? 0)

bridge.onStatus(status => {
  const failed = status.state === 'error'
  error.hidden = !failed
  buttons.hidden = !failed
  if (failed) {
    text.textContent = '下载没成功。'
    error.textContent = status.message || ''
    fit()
    return
  }
  const percent = Math.round((status.fraction || 0) * 100)
  fill.style.width = (status.state === 'done' ? 100 : percent) + '%'
  if (status.fraction === 0) fit()
  text.textContent = status.state === 'done' ? '接回来了，小猪马上出来……' : '正在下载小猪' + (status.version ? ' v' + status.version : '') + '…… ' + percent + '%'
})
