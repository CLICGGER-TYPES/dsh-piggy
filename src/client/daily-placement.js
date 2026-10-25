// @ts-check
/** Keep an actionable gift beside the pig during speech, using its current work area. */
import { nearestArea } from './desktop/geometry.js'
import { createRenderHold } from './render-hold.js'

/** @param {{x:number,y:number,width:number,height:number}} pig @param {{x:number,y:number,width:number,height:number}} area */
export function giftSideFor(pig, area) {
  const left = pig.x - area.x
  const right = area.x + area.width - pig.x - pig.width
  if (left < 42 || right < 42) return right > left ? 'right' : 'left'
  return pig.x + pig.width / 2 < area.x + area.width / 2 ? 'right' : 'left'
}

/** @param {{host:any,pig:any,daily:any,bubble:any,geometry:()=>any,onGeometry?:((fn:()=>void)=>any)}} deps */
export function attachDailyPlacement({ host, pig, daily, bubble, geometry, onGeometry }) {
  let scheduled = false
  let disposed = false
  function sync() {
    scheduled = false
    if (disposed || host.getAttribute('data-gift-held') === 'true') return
    let x = 0, y = 0, node = pig
    while (node && node !== document.body) {
      x += node.offsetLeft || 0; y += node.offsetTop || 0; node = node.offsetParent
    }
    const geo = geometry()
    const origin = geo?.window ?? { x: 0, y: 0 }
    const box = { x: origin.x + x, y: origin.y + y, width: pig.offsetWidth, height: pig.offsetHeight }
    const area = geo?.workArea ?? nearestArea({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, geo?.workAreas ?? [])
      ?? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
    const side = giftSideFor(box, area)
    if (host.getAttribute('data-gift-side') !== side) host.setAttribute('data-gift-side', side)
  }
  function schedule() {
    if (!disposed && !scheduled) { scheduled = true; queueMicrotask(sync) }
  }
  const hold = createRenderHold(daily)
  function release() { host.removeAttribute('data-gift-held'); sync() }
  function down(event) {
    if (event.button !== 0 || daily.getAttribute('data-action') !== 'openGift' || bubble.hidden) return
    host.setAttribute('data-gift-held', 'true')
    hold.defer(release)
  }
  daily.addEventListener('pointerdown', down)
  const observer = new MutationObserver(schedule)
  observer.observe(host, { attributes: true, subtree: true, attributeFilter: ['hidden', 'style', 'data-action', 'data-open'] })
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null
  resize?.observe(pig)
  const off = onGeometry?.(schedule)
  window.addEventListener('resize', schedule)
  sync()
  return () => {
    disposed = true
    hold.dispose(); daily.removeEventListener('pointerdown', down)
    host.removeAttribute('data-gift-held')
    observer.disconnect(); resize?.disconnect()
    if (typeof off === 'function') off()
    window.removeEventListener('resize', schedule)
  }
}
