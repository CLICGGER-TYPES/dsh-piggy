import assert from 'node:assert/strict'
import {test} from 'node:test'
import {panelViewportSize, panelContentRect, panelBoundsFor} from '../lib/panel-geometry.js'
import {pointerHitsShape} from '../lib/pointer-hit.js'

test('status and home retain one native viewport and one HUD edge',()=>{
 const pig={x:1110,y:620,width:86,height:86}
 const anchor={vertical:'above',maxHeight:520,area:{x:0,y:32,width:1280,height:768}}
 const bounds=[370,484,520,370].map(height=>panelBoundsFor(pig,anchor,panelViewportSize(anchor,{width:292,height},true)))
 for(const b of bounds)assert.deepEqual(b,bounds[0])
 assert.equal(panelContentRect(bounds[0],anchor,{width:292,height:370}).y,150)
 const box=panelContentRect(bounds[0],anchor,{width:292,height:370})
 assert.equal(pointerHitsShape({x:bounds[0].x+20,y:bounds[0].y+20},bounds[0],[box]),false)
 assert.equal(pointerHitsShape({x:bounds[0].x+20,y:bounds[0].y+200},bounds[0],[box]),true)
})
test('below panel stays top aligned; old game packages keep the prior sizing',()=>{
 const anchor={vertical:'below',maxHeight:520}
 const size={width:292,height:370}
 assert.deepEqual(panelViewportSize(anchor,size,false),size)
 assert.equal(panelViewportSize(anchor,size,true).height,520)
 assert.deepEqual(panelContentRect({width:292,height:520},anchor,size),{x:0,y:0,width:292,height:370})
})
