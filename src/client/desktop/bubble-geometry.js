// @ts-check
/**
 * Keep a speech bubble inside the drawable part of the existing pet window.
 * The scene may slide when the pig reaches a desktop edge; its speech must not
 * inherit that clipping. This never changes the window or the bubble's width.
 * If the intersection is narrower than the bubble, align its left edge; full
 * containment would require a separate width/layout decision.
 * All inputs use window-local CSS pixels.
 * @param {{x:number,width:number}} bubble
 * @param {{x:number,width:number}} pig
 * @param {{x:number,width:number}} windowBounds
 * @param {{x:number,width:number}} workArea
 */
export function fitBubbleHorizontally(bubble, pig, windowBounds, workArea) {
  const left = Math.max(0, workArea.x - windowBounds.x) + 6
  const right = Math.min(windowBounds.width, workArea.x + workArea.width - windowBounds.x) - 6
  const x = Math.max(left, Math.min(bubble.x, Math.max(left, right - bubble.width)))
  return { x, tailLeft: Math.max(10, Math.min(bubble.width - 20, pig.x + pig.width / 2 - x - 5)) }
}
