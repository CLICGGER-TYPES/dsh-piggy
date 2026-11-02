import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {panelContentRect} from '../lib/panel-geometry.js'
import {pointerHitsShape} from '../lib/pointer-hit.js'
const source=readFileSync(new URL('../main.js',import.meta.url),'utf8')
const start=source.indexOf('function panelFocusLeft()'),end=source.indexOf('\n/**',start)
for(const [title,cursor,close] of [
 ['面板内按下时焦点暂空，不触发收起',{x:150,y:300},false],
 ['透明预留区点到别处，仍会收起',{x:150,y:120},true],
 ['桌面外部点击仍会收起',{x:10,y:10},true],
])test(title,()=>{
 const sent=[],tasks=[]
 const panelWin={isDestroyed:()=>false,isVisible:()=>true,getBounds:()=>({x:100,y:100,width:292,height:520})}
 const ctx={panelOpen:true,panelWin,win:{},extensionWindow:{current:()=>null},panelAnchor:{vertical:'above'},panelSize:{width:292,height:370},
  BrowserWindow:{getFocusedWindow:()=>null},screen:{getCursorScreenPoint:()=>cursor},panelContentRect,pointerHitsShape,
  sendPanel:m=>sent.push(m),setTimeout:fn=>tasks.push(fn)}
 const check=runInNewContext(source.slice(start,end)+'\npanelFocusLeft',ctx);check();tasks[0]()
 assert.equal(sent.length>0,close)
})
