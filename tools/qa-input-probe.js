// @ts-check
/** 只在隔离验收副本加载的输入观察器，不进入游戏包、不改 DOM、不执行游戏动作。 */
;(() => {
  const events = ['pointerdown', 'pointerup', 'contextmenu', 'pointercancel', 'lostpointercapture']
  for (const type of events) document.addEventListener(type, event => {
    const pointer = /** @type {MouseEvent} */ (event)
    const target = event.target instanceof Element ? event.target : null
    const host = document.querySelector('[data-dsh-pig]')
    const scene = document.querySelector('.dp-scene')
    const entry = { type, at: Date.now(), button: pointer.button, x: pointer.screenX, y: pointer.screenY,
      target: target?.classList.value ?? '', inScene: Boolean(target?.closest('.dp-scene')),
      panelOpen: host?.getAttribute('data-panel-open'), dragging: scene?.getAttribute('data-dragging') }
    // 外壳已有 console-message 日志口：只记事件与坐标，不记台词、存档或个人信息。
    console.warn('[qa-input] ' + JSON.stringify(entry))
  }, true)
})()
