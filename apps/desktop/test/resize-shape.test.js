import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createResizeShape} from '../lib/resize-shape.js'

test('resize keeps the old backing frame whole until a new-size presentation arrives',()=>{
  let frame, ended=0
  const calls=[]
  const contents={isDestroyed:()=>false,beginFrameSubscription:fn=>{frame=fn},endFrameSubscription:()=>{ended++}}
  const win={isDestroyed:()=>false,isVisible:()=>true,getBounds:()=>({width:412,height:384}),webContents:contents}
  const guard=createResizeShape(()=>win,s=>calls.push(s))
  const shape=[{x:215,y:240,width:80,height:80}]
  guard.begin({width:364,height:308});guard.update(shape)
  assert.deepEqual(calls,[[{x:0,y:0,width:412,height:384}]])
  frame({getSize:()=>({width:412,height:384})});assert.equal(calls.length,1)
  const latest=[{x:216,y:241,width:80,height:80}];guard.update(latest)
  frame({getSize:()=>({width:364,height:308})});assert.deepEqual(calls.at(-1),latest);assert.equal(ended,1)
})
test('unchanged geometry does not subscribe; a drag cancels a pending restore',()=>{
  let subscribed=0,ended=0,frame
  const shapes=[]
  const win={isDestroyed:()=>false,isVisible:()=>true,getBounds:()=>({width:364,height:308}),webContents:{isDestroyed:()=>false,beginFrameSubscription:fn=>{subscribed++;frame=fn},endFrameSubscription:()=>{ended++}}}
  const guard=createResizeShape(()=>win,s=>shapes.push(s))
  guard.begin({width:364,height:308});guard.update([]);assert.equal(subscribed,0)
  guard.begin({width:412,height:384});guard.update([{x:1}]);guard.cancel();frame({getSize:()=>({width:412,height:384})})
  assert.equal(ended,1);assert.equal(shapes.length,2)
})

test('accepting a WM-clamped actual size ends the rejected-size capture',()=>{
  let ended=0,frame
  const calls=[]
  const contents={isDestroyed:()=>false,beginFrameSubscription:fn=>{frame=fn},endFrameSubscription:()=>{ended++}}
  const win={isDestroyed:()=>false,isVisible:()=>true,getBounds:()=>({width:364,height:308}),webContents:contents}
  const guard=createResizeShape(()=>win,s=>calls.push(s))
  guard.begin({width:412,height:384});guard.update([{x:1}])
  guard.begin({width:364,height:308});guard.update([{x:2}])
  frame({getSize:()=>({width:412,height:384})})
  assert.equal(ended,1);assert.deepEqual(calls.at(-1),[{x:2}])
})

test('200% frame pixels and scale-tagged NativeImages both match the DIP viewport',()=>{
  for(const [size,imageScale] of [[{width:728,height:616},1],[{width:364,height:308},2]]){
    let frame,ended=0
    const calls=[]
    const contents={isDestroyed:()=>false,beginFrameSubscription:fn=>{frame=fn},endFrameSubscription:()=>{ended++}}
    const win={isDestroyed:()=>false,isVisible:()=>true,getBounds:()=>({width:412,height:384}),webContents:contents}
    const guard=createResizeShape(()=>win,s=>calls.push(s),()=>2)
    guard.begin({width:364,height:308});guard.update([{x:2}]);frame({getSize:()=>size,getScaleFactors:()=>[imageScale]})
    assert.equal(ended,1);assert.deepEqual(calls.at(-1),[{x:2}])
  }
})

test('fixed panel viewport waits for paint when only the visible content region changes',()=>{
 let frame,ended=0
 const calls=[]
 const contents={isDestroyed:()=>false,beginFrameSubscription:fn=>{frame=fn},endFrameSubscription:()=>{ended++}}
 const win={isDestroyed:()=>false,isVisible:()=>true,getBounds:()=>({width:292,height:520}),webContents:contents}
 const guard=createResizeShape(()=>win,s=>calls.push(s))
 guard.begin({width:292,height:520},true);guard.update([{x:0,y:150,width:292,height:370}])
 assert.deepEqual(calls,[[{x:0,y:0,width:292,height:520}]])
 frame({getSize:()=>({width:292,height:520})});assert.equal(ended,1);assert.equal(calls.at(-1)[0].y,150)
})
