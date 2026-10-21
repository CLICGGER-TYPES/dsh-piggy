// @ts-check
import { artMarginFor } from '../art-framing.js'
import { feelEnvelope } from '../feel/envelope.js'

/**
 * Drawing bounds during a hold, flight and its landing reaction. Keep these
 * separate from the square pig layout box used by home and panel positioning.
 * Reviewed artwork can be wider than that box; the feel layer can move it again.
 * @param {{x:number,y:number,width:number,height:number}} pig
 */
export function bodyVisualBounds(pig) {
  const art = artMarginFor(pig.width)
  const pose = feelEnvelope({ x: 0, y: 0, width: pig.width, height: pig.height }, undefined,
    { x: -art, y: 0, width: pig.width + art * 2, height: pig.height })
  const left = Math.max(art, -pose.x)
  const right = Math.max(art, pose.x + pose.width - pig.width)
  const top = Math.max(8, -pose.y)
  const bottom = Math.max(12, pose.y + pose.height - pig.height)
  return { x: pig.x - left, y: pig.y - top,
    width: pig.width + left + right, height: pig.height + top + bottom }
}
