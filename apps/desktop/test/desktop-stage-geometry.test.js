// @ts-check
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clampRectInto, constrainRectToAreas, geometryPayload, nearestWorkArea, rectContains,
  rectCoveredByAreas, rectsIntersect, stageBounds, toPageRect, toScreenRect, workAreasOf,
} from '../stage/geometry.js'
import {
  pointerHitsShape, sanitizeRect, sanitizeReport, sanitizeShape, shapeKey,
  validArchiveBytes, validArchiveName, validExtKey,
} from '../stage/shape.js'
import { createCleanup } from '../stage/lifecycle.js'

const left = { x: -1920, y: 0, width: 1920, height: 1080 }
const right = { x: 0, y: -200, width: 2560, height: 1440 }

test('stage bounds use the union of work areas and never accumulate', () => {
  const displays = [{ id: 1, workArea: left }, { id: 2, workArea: right }]
  const first = stageBounds(displays)
  assert.deepEqual(first, { x: -1920, y: -200, width: 4480, height: 1440 })
  assert.deepEqual(stageBounds(displays), first)
  assert.equal(stageBounds([]), null)
})

test('work areas are deduped and stable', () => {
  const areas = workAreasOf([{ workArea: right }, { workArea: left }, { workArea: right }])
  assert.equal(areas.length, 2)
  assert.deepEqual(areas[0], right)
  assert.deepEqual(areas[1], left)
})

test('gap points resolve to the nearest display, not the bounding box', () => {
  const areas = [left, { x: 0, y: 1200, width: 1000, height: 400 }]
  // A point in the hole below the left display but left of the lower display.
  assert.deepEqual(nearestWorkArea({ x: -40, y: 4000 }, areas), { x: 0, y: 1200, width: 1000, height: 400 })
  assert.deepEqual(nearestWorkArea({ x: -10, y: 10 }, areas), left)
})

test('a rect in a screen hole is moved fully into a visible work area', () => {
  const areas = [left, { x: 0, y: 1200, width: 1000, height: 400 }]
  const hole = { x: -400, y: 2000, width: 200, height: 100 }
  const moved = constrainRectToAreas(hole, areas)
  assert.equal(moved.moved, true)
  assert.equal(moved.area.x, 0)
  assert.ok(moved.rect.x >= 0 && moved.rect.x + moved.rect.width <= 1000)
  assert.ok(moved.rect.y >= 1200 && moved.rect.y + moved.rect.height <= 1600)
})

test('a rect already inside an area is untouched', () => {
  const rect = { x: 300, y: 300, width: 100, height: 100 }
  assert.deepEqual(constrainRectToAreas(rect, [left, right]).rect, rect)
})

test('a rect crossing a connected screen seam is left alone', () => {
  const seam = { x: -100, y: 300, width: 200, height: 100 }
  assert.equal(rectCoveredByAreas(seam, [left, right]), true)
  assert.deepEqual(constrainRectToAreas(seam, [left, right]).rect, seam)
  const hole = { x: -100, y: 300, width: 200, height: 100 }
  assert.equal(rectCoveredByAreas(hole, [left, { x: 0, y: 1000, width: 100, height: 100 }]), false)
})

test('oversized rects are pinned to the top-left instead of overflowing', () => {
  const area = { x: 100, y: 100, width: 300, height: 200 }
  assert.deepEqual(clampRectInto({ x: 500, y: 500, width: 900, height: 800 }, area), { x: 100, y: 100, width: 300, height: 200 })
})

test('screen/page conversion round-trips negative origins', () => {
  const origin = { x: -1920, y: -200 }
  const rect = { x: 10, y: 20, width: 30, height: 40 }
  assert.deepEqual(toPageRect(toScreenRect(rect, origin), origin), rect)
  assert.equal(rectContains(rect, { x: 10, y: 20 }), true)
  assert.equal(rectsIntersect(rect, { x: 39, y: 59, width: 10, height: 10 }), true)
  assert.equal(rectsIntersect(rect, { x: 40, y: 60, width: 10, height: 10 }), false)
})

test('geometry payload reports the same work areas and keeps seq', () => {
  const payload = geometryPayload({ window: { x: -1920, y: -200, width: 4480, height: 1440 }, workAreas: [left, right], displays: [{ id: 1, workArea: left, scaleFactor: 2 }], seq: 7 })
  assert.equal(payload.seq, 7)
  assert.deepEqual(payload.workAreas, [left, right])
  assert.equal(payload.displays[0].scaleFactor, 2)
})

test('shape sanitizing clamps to the window and drops bad rects', () => {
  const bounds = { width: 400, height: 300 }
  assert.deepEqual(sanitizeRect({ x: -20, y: -5, width: 50, height: 30 }, bounds), { x: 0, y: 0, width: 30, height: 25 })
  assert.deepEqual(sanitizeRect({ x: 390, y: 290, width: 50, height: 50 }, bounds), { x: 390, y: 290, width: 10, height: 10 })
  assert.equal(sanitizeRect({ x: NaN, y: 0, width: 10, height: 10 }, bounds), null)
  assert.equal(sanitizeRect({ x: 0, y: 0, width: 0, height: 10 }, bounds), null)
  assert.deepEqual(sanitizeShape([{ x: 0, y: 0, width: 10, height: 10 }, null], bounds), [{ x: 0, y: 0, width: 10, height: 10 }])
})

test('reports only accept the agreed visible keys', () => {
  const report = sanitizeReport({
    shape: [{ x: 0, y: 0, width: 10, height: 10 }],
    visible: { pig: { x: 0, y: 0, width: 10, height: 10 }, secret: 'nope' },
    interacting: true,
    extra: 'nope',
  }, { width: 100, height: 100 })
  assert.deepEqual(Object.keys(report.visible).sort(), ['bubble', 'gift', 'hud', 'menu', 'overlay', 'pig'])
  assert.equal(report.interacting, true)
  assert.equal('extra' in report, false)
})

test('shape keys and mouse hit testing are stable', () => {
  const rects = [{ x: 10, y: 10, width: 20, height: 20 }]
  assert.equal(shapeKey(rects), shapeKey(rects.map(rect => ({ ...rect }))))
  const bounds = { x: -100, y: -100, width: 400, height: 400 }
  assert.equal(pointerHitsShape({ x: -89, y: -89 }, bounds, rects), true)
  assert.equal(pointerHitsShape({ x: -90, y: -90 }, bounds, rects), true)
  assert.equal(pointerHitsShape({ x: -91, y: -91 }, bounds, rects), false)
  assert.equal(pointerHitsShape({ x: -70, y: -70 }, bounds, rects), false)
})

test('external inputs are constrained to the published names', () => {
  assert.equal(validExtKey('farm'), true)
  assert.equal(validExtKey('../farm'), false)
  assert.equal(validArchiveName('piggy-save-20261023-1200.zip'), true)
  assert.equal(validArchiveName('/tmp/piggy.zip'), false)
  assert.equal(validArchiveBytes(new Uint8Array([1, 2])), true)
  assert.equal(validArchiveBytes(new Uint8Array(0)), false)
  assert.equal(validArchiveBytes('zip'), false)
})

test('cleanup runs in reverse order once and survives a failing task', async () => {
  const calls = []
  const cleanup = createCleanup(() => calls.push('error'))
  cleanup.add(() => calls.push(1))
  cleanup.add(() => { calls.push(2); throw new Error('boom') })
  cleanup.add(() => calls.push(3))
  const first = cleanup.dispose()
  const second = cleanup.dispose()
  assert.equal(first, second)
  assert.deepEqual(await first, { ok: false })
  assert.deepEqual(calls, [3, 2, 'error', 1])
  cleanup.add(() => calls.push(4))
  assert.deepEqual(calls, [3, 2, 'error', 1, 'error'])
})
