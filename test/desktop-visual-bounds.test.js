import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bodyVisualBounds } from '../src/client/desktop/visual-bounds.js'
import { feelEnvelope } from '../src/client/feel/envelope.js'
import { artMarginFor } from '../src/client/art-framing.js'
import { dragPigBounds, desktopViewportBounds } from '../apps/desktop/lib/window-geometry.js'
import { createFlight } from '../src/client/desktop/flight.js'
import { createPlacement } from '../src/client/desktop/place.js'

const pig = { x: 212, y: 146, width: 82, height: 82 }
const win = { x: 150, y: 30, width: 384, height: 348 }
const area = { x: 33, y: 16, width: 607, height: 384 }
const visual = bodyVisualBounds(pig)
const inside = (a,b) => a.x >= b.x - 1 && a.y >= b.y - 1 && a.x+a.width <= b.x+b.width+1 && a.y+a.height <= b.y+b.height+1

test('drawing bounds cover wide artwork after the real pig-pivot hold and tilt transforms', () => {
  const art = artMarginFor(pig.width)
  const ink = { x:pig.x-art,y:pig.y,width:pig.width+2*art,height:pig.height }
  for (const squash of [-.081,.18]) for (const tilt of [-20,20]) for (const hold of [0,.1]) {
    assert.ok(inside(feelEnvelope(pig,{squash,tilt,hold,hop:0},ink),visual))
  }
  assert.equal(pig.x,212,'drawing bounds do not mutate the home layout box')
})
test('right and bottom dragging from a safe initial frame prevents a clipping anchor', () => {
  const start = {x:win.x+pig.x,y:win.y+pig.y}
  const wanted = dragPigBounds(win,pig,start,{x:0,y:0},{x:500,y:500},[area],visual)
  const held = desktopViewportBounds(wanted,[area])
  const drawing = {x:visual.x+wanted.x-held.x,y:visual.y+wanted.y-held.y,width:visual.width,height:visual.height}
  assert.ok(inside(drawing,{x:0,y:0,width:held.width,height:held.height}))
  assert.ok(inside({...drawing,x:drawing.x+held.x,y:drawing.y+held.y},area))
})
test('drawing bounds can cross a connected negative-coordinate screen seam, but not its empty L corner', () => {
  const areas=[{x:-640,y:0,width:640,height:400},{x:0,y:0,width:640,height:400}]
  const start={x:-70,y:100}, origin={x:0,y:0}
  const crossing=dragPigBounds(win,pig,start,origin,{x:70,y:0},areas,visual)
  assert.equal(crossing.x+pig.x,0,'a seam must not clamp the pig back to one screen')
  const l=[areas[0],{x:0,y:200,width:640,height:400}]
  const corner=dragPigBounds(win,pig,start,origin,{x:70,y:0},l,visual)
  assert.ok(corner.x+visual.x+visual.width<=0 || corner.y+visual.y>=200)
})
test('legacy dragging keeps its square-box behavior when drawing bounds are absent', () => {
  const wanted=dragPigBounds(win,pig,{x:win.x+pig.x,y:win.y+pig.y},{x:0,y:0},{x:500,y:500},[area])
  assert.equal(wanted.x+pig.x+pig.width,area.x+area.width)
  assert.equal(wanted.y+pig.y+pig.height,area.y+area.height)
})
test('flight and landing retain the same drawing envelope used by dragging', () => {
  const body=createFlight({x:500,y:300,vx:1000,vy:600,area,pig,visual})
  for(let i=0;i<500&&!body.done;i++) {
    body.advance(16)
    const drawing={x:body.x-pig.width/2+visual.x-pig.x,y:body.y-pig.height+visual.y-pig.y,width:visual.width,height:visual.height}
    assert.ok(inside(drawing,area))
  }
})
test('oversized drawing bounds have finite deterministic placement rather than reversed intervals', () => {
  const tiny={x:-20,y:10,width:100,height:80}
  const huge={x:-40,y:-40,width:220,height:200}
  const result=dragPigBounds(win,pig,{x:0,y:0},{x:0,y:0},{x:1000,y:1000},[tiny],huge)
  assert.ok(Object.values(result).every(Number.isFinite))
  const body=createFlight({x:0,y:0,vx:100,vy:100,area:tiny,pig,visual:huge})
  body.advance(50)
  assert.ok(Number.isFinite(body.x)&&Number.isFinite(body.y))
})

test('initial placement fits an old edge save once and remains stable across repeated bubble and menu measurements', () => {
  const memory = new Map()
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key,value) => memory.set(key,value) }
  const placement = createPlacement()
  placement.rehome({x:216,y:52},{x:302,y:266,width:82,height:82},[area])
  const report={width:384,height:348,pig,visual,pigWindow:pig,pigNow:pig,shift:{x:0,y:0},artMargin:artMarginFor(82)}
  let bounds=placement.decide(report,win,[area])
  const fitted={...placement.home()}
  assert.ok(fitted.x<559 && fitted.y<400,'old square-box edge position must allow the drawing envelope')
  const slide=placement.clamp()
  assert.ok(inside({...visual,x:visual.x-slide.dx,y:visual.y-slide.dy},{x:0,y:0,width:bounds.width,height:bounds.height}))
  for(let i=0;i<100;i++) {
    bounds=placement.decide(report,bounds,[area])
    assert.deepEqual(placement.home(),fitted)
  }
})

test('stage bottom-edge settlement preserves the same feet when split mode restores that home', async () => {
  const { pigEnvelope } = await import('../src/client/stage-dom.js')
  const { constrainRectToAreas } = await import('../src/client/stage-position.js')
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  try {
    globalThis.document = { body: {} }
    for (const size of [54, 72, 128]) {
      const node = { offsetLeft: 500, offsetTop: 800-size, offsetWidth:size, offsetHeight:size, offsetParent:null }
      const bound = pigEnvelope(node)
      const moved = constrainRectToAreas(bound, [{x:0,y:0,width:1280,height:800}])
      const target = { x: node.offsetLeft + moved.offset.x, y: node.offsetTop + moved.offset.y }
      const local = { x: 120, y: 100, width:size, height:size }
      const placement = createPlacement()
      placement.rehome(target, {x:0,y:0,width:size,height:size}, [{x:0,y:0,width:1280,height:800}])
      placement.decide({width:400,height:400,pig:local,pigNow:local,pigWindow:local,visual:bodyVisualBounds(local),artMargin:artMarginFor(size)}, {x:0,y:0,width:400,height:400}, [{x:0,y:0,width:1280,height:800}])
      assert.ok(Math.abs(placement.home().y-(target.y+size)) <= 1, `size ${size}: split must not move stage feet again`)
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis,'document',descriptor)
    else delete globalThis.document
  }
})
