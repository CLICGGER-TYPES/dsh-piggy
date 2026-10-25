// @ts-check
/** 气泡与菜单避让：只改变菜单锚点及滚动上限，不改变猪的位置。 */
import { fitPanelAboveSpeech, fitPanelBelowSpeech } from './bubble-fit.js'
import { layoutBox } from './stage-dom.js'

/** @param {any} card @param {()=>void} fitPanel */
export function createStageSpeechPanel(card, fitPanel) {
  /** @type {''|'above'|'below'} */
  let shifted = ''
  const style = (name, value) => { if (card.style[name] !== value) card.style[name] = value }
  /** @param {any} menu @param {any} bubble @param {any} pig @param {any} workArea */
  return function fit(menu = null, bubble = null, pig = null, workArea = null) {
    if (menu === null || bubble === null) {
      if (shifted !== '') { shifted = ''; fitPanel() }
      return
    }
    const side = bubble.side === 'below' ? 'below' : 'above'
    if (shifted !== '' && shifted !== side) {
      shifted = ''
      fitPanel()
      return // 原始锚点恢复后，由已有布局观察器重新测量。
    }
    const next = side === 'below'
      ? fitPanelBelowSpeech(menu, bubble, pig, workArea)
      : fitPanelAboveSpeech(menu, bubble, pig, workArea)
    if (next === null) return
    const container = layoutBox(card.offsetParent)
    if (side === 'below') {
      style('top', next.y - container.y + 'px')
      style('bottom', 'auto')
    } else {
      style('top', 'auto')
      style('bottom', container.y + container.height - next.y - next.maxHeight + 'px')
    }
    style('maxHeight', next.maxHeight + 'px')
    shifted = side
  }
}
