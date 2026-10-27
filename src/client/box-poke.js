// @ts-check
import { BOX_POKES_TO_OPEN, BOX_POKE_LINES } from './constants.js'
import { externalBlockedMessage, isExternalMode } from './external-link.js'

/** Keep paperbox gesture progress inside the mounted scene. */
export function createBoxPoke({ getView, showBubble, react, host, burst, send }) {
  let boxPokes = 0
  return function pokeBox() {
        // 外部模式没有快照时根本没有内嵌纸盒：点猪不能发 hatch（桌面侧会拒绝），
        // 也不能像断线动作那样弹「这个操作没成」。
        if (isExternalMode(getView()) && getView().pig === null) {
          showBubble(externalBlockedMessage(getView()), 3800)
          return
        }
        boxPokes += 1
        react('poke', 560)
        if (boxPokes >= BOX_POKES_TO_OPEN) {
          boxPokes = 0
          host.removeAttribute('data-poke')
          showBubble('哇——！', 1200)
          burst(['✨', '🎉', '💨'], 6)
          send('hatch')
          return
        }
        host.setAttribute('data-poke', String(boxPokes))
        burst(['💨'], 2)
        showBubble(BOX_POKE_LINES[boxPokes - 1], 2200)
  }
}
