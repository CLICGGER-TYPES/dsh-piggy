// @ts-check
/**
 * 摔晕表现：普通健康幼年猪临时显示 faint.png + 摇晃 + 眩晕符号；
 * 其他形态/皮肤只摇晃 + 符号，不套普通猪的病图。2.4 秒后自动恢复。
 * @module dsh-piggy/client/feel/dizzy
 */
import { clearEffectArt, showEffectArt, syncPigArt } from '../art.js'
import { playAudioCue } from '../audio-context.js'
import { FEEL } from './config.js'

/**
 * @param {{ pig:any, pigArt:any, pigEmoji:any, burst:(fx:string[],n:number)=>void, getMode:()=>string, art?:{ sync:()=>boolean, showEffectArt:(name:string)=>void, clearEffectArt:()=>void }, audio?:{ play:(key:string, options?:{ soft?:boolean })=>boolean } }} c
 */
export function createDizzy(c) {
  let timer = null
  let disposed = false

  function artContext() {
    return c.art !== null && c.art !== undefined && typeof c.art.sync === 'function' ? c.art : null
  }

  function syncArt() {
    const art = artContext()
    if (art !== null) return art.sync()
    return syncPigArt(c.pig, c.pigArt, c.pigEmoji)
  }

  function showFaint() {
    const art = artContext()
    if (art !== null) art.showEffectArt('faint')
    else showEffectArt('faint')
  }

  function clearFaint() {
    const art = artContext()
    if (art !== null) art.clearEffectArt()
    else clearEffectArt()
  }

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
    clearFaint()
    syncArt()
  }

  function trigger() {
    if (disposed) return
    if (timer !== null) clearTimeout(timer)
    if (healthyPiglet()) showFaint()
    c.pig.setAttribute('data-react', 'dizzy')
    syncArt()
    c.burst(['💫', '✨', '💫'], 3)
    playAudioCue(c.audio, 'dizzy', { soft: c.getMode() === 'soft' })
    timer = setTimeout(function () {
      timer = null
      if (disposed) return
      c.pig.removeAttribute('data-react')
      clearFaint()
      syncArt()
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
