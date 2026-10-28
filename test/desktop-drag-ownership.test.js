import assert from 'node:assert/strict'
import { test } from 'node:test'
import { install, start } from '../src/client/desktop/index.js'

test('direct geometry requests cannot take placement ownership during native dragging, but release still reads geometry', () => {
  const saved = Object.fromEntries(['window','document','getComputedStyle','requestAnimationFrame'].map(key => [key,globalThis[key]]))
  const scene = { dragging: false, getAttribute: name =>
    name === 'data-dragging' || (name === 'data-window-dragging' && scene.dragging) ? 'true' : null }
  const body = {}
  const host = { style:{right:'0px',bottom:'0px',translate:''}, offsetLeft:0,offsetTop:0,offsetWidth:0,offsetHeight:0,offsetParent:body,
    querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null,getAttribute:()=>null }
  const raf = [], calls = []
  globalThis.document = { body, head:{appendChild(){}}, createElement:()=>({setAttribute(){}}),
    documentElement:{setAttribute(){},addEventListener(){}}, addEventListener(){},
    querySelector:selector=>selector.endsWith('.dp-scene')?scene:host }
  globalThis.window = {innerWidth:384,innerHeight:348,screenX:0,screenY:0}
  globalThis.getComputedStyle = () => ({display:'block',visibility:'visible',opacity:'1'})
  globalThis.requestAnimationFrame = fn => raf.push(fn)
  try {
    install({role:'pet',platform:'linux',panel:{toggle(){}},beginDrag(){},endDrag(){calls.push('end')},
      place(request){calls.push(['place',request]);return null},geometry:()=>null})
    const shell=window.__dshPiggyShell
    shell.syncGeometry()
    assert.deepEqual(calls,[['place',{}]],'holding the pig without moving must still refresh the hand drawing geometry')
    calls.length=0
    scene.dragging=true
    shell.syncGeometry()
    assert.deepEqual(calls,[],'even place({}) mutates native drag/flight ownership and must not run here')
    shell.endDrag()
    assert.deepEqual(calls,['end',['place',{}]],'release still needs its ordered final native geometry read')
    scene.dragging=false
    for(const fn of raf.splice(0))fn()
    assert.equal(calls.filter(x=>Array.isArray(x)).length,2,'ordinary placement resumes after the gesture releases ownership')
  } finally {
    for(const [key,value] of Object.entries(saved)) {
      if(value===undefined)delete globalThis[key]
      else globalThis[key]=value
    }
  }
})

test('飞行倾斜继续提交当前墨迹输入，只有原生拖动暂停，常规布局始终不争用飞行', () => {
  const saved = Object.fromEntries(['window', 'document', 'getComputedStyle', 'requestAnimationFrame', 'setInterval'].map(key => [key, globalThis[key]]))
  const scene = { dragging: false, getAttribute: name => name === 'data-window-dragging' && scene.dragging ? 'true' : null }
  const body = {}, frames = [], calls = []
  let inkX = 20
  const ink = { textContent: 'pig', parentElement: null, matches: () => false,
    getBoundingClientRect: () => ({ left: inkX, top: 30, width: 20, height: 20 }) }
  const host = { style: {}, querySelector: () => null, querySelectorAll: selector => selector.includes('.dp-pig-emoji') ? [ink] : [] }
  globalThis.document = { body, head: { appendChild() {} }, createElement: () => ({ setAttribute() {} }),
    documentElement: { setAttribute() {}, addEventListener() {} }, addEventListener() {},
    querySelector: selector => selector.endsWith('.dp-scene') ? scene : host }
  globalThis.window = { innerWidth: 384, innerHeight: 348, screenX: 0, screenY: 0, addEventListener() {} }
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1' })
  globalThis.requestAnimationFrame = fn => { frames.push(fn); return frames.length }
  globalThis.setInterval = () => 1
  try {
    install({ role: 'pet', platform: 'darwin', panel: { toggle() {} }, beginDrag() {}, endDrag() {}, place: request => { calls.push(request); return null }, geometry: () => null })
    window.__dshPiggyShell.flight.setFlying(true)
    start()
    frames.shift()(0)
    assert.deepEqual(calls, [{ hitShape: [{ x: 20, y: 30, width: 20, height: 20 }] }])
    inkX = 35
    frames.shift()(32)
    assert.equal(calls.at(-1).hitShape[0].x, 35, '飞行倾斜的当前墨迹不能冻结在起飞一帧')
    assert.ok(calls.every(request => Object.keys(request).join() === 'hitShape'), '飞行不能运行常规 bounds/shape 摆放')
    scene.dragging = true; inkX = 50; frames.shift()(64)
    assert.equal(calls.length, 2, '原生拖动仍独占输入捕获')
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
})
