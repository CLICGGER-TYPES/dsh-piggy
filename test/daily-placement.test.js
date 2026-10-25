import test from 'node:test'
import assert from 'node:assert/strict'
import { giftSideFor } from '../src/client/daily-placement.js'

test('waiting gifts face inward at either screen edge and on negative-coordinate screens', () => {
  for (const area of [{x:0,y:0,width:1280,height:800},{x:-1920,y:-200,width:1920,height:1080}]) {
    for (const size of [54,72,216]) {
      assert.equal(giftSideFor({x:area.x+4,y:area.y+100,width:size,height:size},area),'right')
      assert.equal(giftSideFor({x:area.x+area.width-size-4,y:area.y+100,width:size,height:size},area),'left')
    }
  }
})

test('an oversized pig uses the side with more remaining room', () => {
  const area={x:0,y:0,width:200,height:300}
  assert.equal(giftSideFor({x:2,y:0,width:180,height:180},area),'right')
  assert.equal(giftSideFor({x:18,y:0,width:180,height:180},area),'left')
})

test('gift press survives speech expiry until click processing; cancel, blur and disposal release it', async () => {
  const { attachDailyPlacement } = await import('../src/client/daily-placement.js')
  const keys=['window','document','MutationObserver','ResizeObserver']
  const originals=keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)])
  function target() {
    const listeners=new Map()
    return { listeners,
      addEventListener(type,fn) { if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn) },
      removeEventListener(type,fn) { listeners.get(type)?.delete(fn) },
      fire(type,event={}) { for(const fn of listeners.get(type)??[])fn(event) },
    }
  }
  const attrs=new Map(), frames=new Map()
  const host={getAttribute:key=>attrs.get(key)??null,setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key)}
  const daily={...target(),getAttribute:()=> 'openGift'},bubble={hidden:false}
  const env={...target(),innerWidth:1280,innerHeight:800,
    requestAnimationFrame:fn=>{frames.set(1,fn);return 1},cancelAnimationFrame:id=>frames.delete(id)}
  let off=0,disconnects=0,stop
  try {
    globalThis.window=env;globalThis.document={body:{}}
    globalThis.MutationObserver=class {observe(){} disconnect(){disconnects++}}
    globalThis.ResizeObserver=class {observe(){} disconnect(){disconnects++}}
    stop=attachDailyPlacement({host,daily,bubble,pig:{offsetLeft:900,offsetTop:100,offsetWidth:54,offsetHeight:54,offsetParent:null},geometry:()=>null,onGeometry:()=>()=>off++})
    daily.fire('pointerdown',{button:0,pointerId:1})
    assert.equal(attrs.get('data-gift-held'),'true')
    bubble.hidden=true
    env.fire('pointerup',{pointerId:1})
    assert.equal(attrs.get('data-gift-held'),'true','pointerup must not move the target before click')
    frames.get(1)();frames.clear()
    assert.equal(attrs.has('data-gift-held'),false)
    for(const type of ['pointercancel','blur']) {
      bubble.hidden=false;daily.fire('pointerdown',{button:0,pointerId:2});env.fire(type,{pointerId:2})
      frames.get(1)();frames.clear();assert.equal(attrs.has('data-gift-held'),false)
    }
    bubble.hidden=false;daily.fire('pointerdown',{button:0,pointerId:3});stop();stop=null
    assert.equal(attrs.has('data-gift-held'),false)
    assert.equal(off,1);assert.equal(disconnects,2)
    assert.equal([...env.listeners.values()].reduce((sum,set)=>sum+set.size,0),0)
  } finally {
    stop?.()
    for(const [key,descriptor] of originals) {if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
  }
})
