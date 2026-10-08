// @ts-check
/** Whether a screen-space cursor is over a renderer-reported clickable region. */
export function pointerHitsShape(cursor, bounds, rects) {
  const x = cursor.x - bounds.x
  const y = cursor.y - bounds.y
  return rects.some(rect => rect.width > 0 && rect.height > 0
    && x >= rect.x && x < rect.x + rect.width
    && y >= rect.y && y < rect.y + rect.height)
}
