/**
 * 假 DOM 的 `fire` 只调用目标自己的监听器；浏览器里 pointerdown/up/click 会
 * 从 target 一路冒到 scene。这里按真实顺序调用祖先监听器，并尊重 stopPropagation。
 *
 * @param {any} target
 * @param {string} type
 * @param {any} [event]
 */
export function press(target, type, event = {}) {
  const detail = { button: 0, pointerId: 1, ...event, target }
  let stopped = false
  Object.defineProperty(detail, 'stopPropagation', {
    configurable: true,
    value() { stopped = true },
  })
  for (let node = target; node && !stopped; node = node.parentNode) {
    for (const fn of [...(node.listeners?.[type] ?? [])]) fn.call(node, detail)
  }
  return detail
}
