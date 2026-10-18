// @ts-check
/**
 * 摔晕表现：普通健康幼年猪临时显示 faint.png + 摇晃 + 眩晕符号；
 * 其他形态/皮肤只摇晃 + 符号，不套普通猪的病图。2.4 秒后自动恢复。
 * @module dsh-piggy/client/feel/dizzy
 */
import { clearEffectArt, showEffectArt, syncPigArt } from '../art.js'
import { playSound } from '../sound.js'
import { FEEL } from './config.js'

/**
 * @param {{ pig:any, pigArt:any, pigEmoji:any, burst:(fx:string[],n:number)=>void, getMode:()=>string }} c
 */
export function createDizzy(c) {
  let timer = null
  let disposed = false

  function healthyPiglet() {
    const stage = c.pig.getAttribute('data-stage') || ''
    const mood = c.pig.getAttribute('data-mood') || ''
    return (c.pig.getAttribute('data-art') || '') === 'piglet'
      && !c.pig.getAttribute('data-illness')
      && stage !== 'box' && stage !== 'grave' && stage !== 'dead-day'
      && mood !== 'sick' && mood !== 'dead'
  }

  function cancel() {
    if (c.pig.getAttribute('data-react') !== 'dizzy') return
    c.pig.removeAttribute('data-react')
    clearEffectArt()
    syncPigArt(c.pig, c.pigArt, c.pigEmoji)
  }

  function trigger() {
    if (disposed) return
    if (timer !== null) clearTimeout(timer)
    if (healthyPiglet()) showEffectArt('faint')
    c.pig.setAttribute('data-react', 'dizzy')
    syncPigArt(c.pig, c.pigArt, c.pigEmoji)
    c.burst(['💫', '✨', '💫'], 3)
    playSound('dizzy', { soft: c.getMode() === 'soft' })
    timer = setTimeout(function () {
      timer = null
      if (disposed) return
      c.pig.removeAttribute('data-react')
      clearEffectArt()
      syncPigArt(c.pig, c.pigArt, c.pigEmoji)
    }, FEEL.dizzyMs)
  }

  return {
    trigger: trigger,
    cancel: cancel,
    dispose: function () {
      disposed = true
      if (timer !== null) clearTimeout(timer)
      timer = null
    },
  }
}
