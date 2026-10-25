// @ts-check
/** One owner for the current speech, reply gesture and expiry timer.
 * Replacement stays immediate; this does not queue messages or change rewards.
 */
import { el } from './dom.js'
import { createRenderHold } from './render-hold.js'

/** @param {{bubble:any,pomoHint?:any}} deps */
export function createSpeech({ bubble, pomoHint = null }) {
  let timer = null
  let hold = null
  let version = 0
  let disposed = false

  function reset() {
    version += 1
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    if (hold !== null) hold.dispose()
    hold = null
    return version
  }

  function expire(current, restorePomo) {
    if (current !== version) return
    const close = () => {
      if (current !== version) return
      bubble.hidden = true
      if (hold !== null) hold.dispose()
      hold = null
      if (restorePomo && pomoHint !== null) pomoHint.hidden = pomoHint.getAttribute('data-pomo') !== 'on'
    }
    if (hold !== null && hold.defer(close)) return
    close()
  }

  function showBubble(text, ms) {
    if (disposed) return
    const current = reset()
    bubble.setAttribute('data-bubble-shown', 'true')
    bubble.textContent = ''
    bubble.appendChild(el('span', 'dp-bubble-text', text))
    bubble.hidden = false
    if (pomoHint !== null) pomoHint.hidden = true
    timer = window.setTimeout(() => {
      if (current !== version) return
      timer = null
      expire(current, true)
    }, ms || 2600)
  }

  /** @param {string} text @param {string[]} replies @param {(index:number)=>void} onReply @param {number} [ms] */
  function showLine(text, replies, onReply, ms) {
    if (disposed) return
    if (replies.length === 0) {
      showBubble(text, ms || 2600)
      return
    }
    const current = reset()
    bubble.textContent = ''
    bubble.appendChild(el('span', 'dp-bubble-text', text))
    const row = el('div', 'dp-bubble-replies', '')
    hold = createRenderHold(row)
    replies.forEach((label, index) => {
      const answer = el('button', 'dp-reply', label)
      answer.type = 'button'
      answer.addEventListener('click', event => {
        event.stopPropagation()
        if (current !== version || bubble.hidden) return
        reset()
        bubble.hidden = true
        onReply(index)
      })
      row.appendChild(answer)
    })
    bubble.appendChild(row)
    bubble.hidden = false
    timer = window.setTimeout(() => {
      if (current !== version) return
      timer = null
      expire(current, false)
    }, Math.max(6000, ms || 0))
  }

  function hideBubble() {
    reset()
    bubble.hidden = true
  }

  return { showBubble, showLine, hideBubble, dispose() {
    disposed = true
    hideBubble()
  } }
}
