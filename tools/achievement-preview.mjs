// @ts-check
/** Isolated draft client. Test data never touches a real pet save. */
import http from 'node:http'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStore } from '../src/host/store.js'
import { registerRoutes } from '../src/host/routes.js'
import { createExtRuntime } from '../store/ext-runtime.js'
import { installPreviewExtensions, seedExtensionPreview } from './extension-achievement-fixtures.mjs'
import { hatchEgg, xpForLevel, FISH, ALL_SOUVENIRS, settleAchievements, ACHIEVEMENTS } from '../packages/pet-core/src/index.js'
const root=fileURLToPath(new URL('../',import.meta.url))
const folder=mkdtempSync(join(tmpdir(),'pig-achievement-preview-'))
const port=Number(process.env.PIG_ACHIEVEMENT_PORT||8780)

function demo(mode) {
  const now=Date.now()
  const state=/** @type {any} */(hatchEgg(now))
  state.inventory={apple:30,soap:30};state.coins=20000
  if(mode!=='fresh') {
    const complete = mode==='all' || mode==='near'
    state.xp=xpForLevel(complete?40:12)
    Object.assign(state.stats,{feeds:1,baths:complete?10:6,plays:complete?20:13,pets:complete?100:58,
      courses:1,jobs:complete?100:8,trips:complete?10:1,fishCaught:mode==='all'?100:mode==='near'?99:2})
    for(const fish of FISH.slice(0,mode==='all'?20:mode==='near'?19:2)) state.dex.fish[fish.key]={firstAt:now,count:1}
    for(const item of ALL_SOUVENIRS.slice(0,mode==='all'?10:mode==='near'?9:1)) state.dex.souvenirs[item.key]={firstAt:now,count:1}
    if(complete) for(const key of ['king','devil']) state.dex.forms[key]={firstAt:now,count:1}
    settleAchievements(state,now,{silent:true})
  }
  seedExtensionPreview(state,mode)
  settleAchievements(state,now,{silent:true})
  return state
}
installPreviewExtensions(folder)
writeFileSync(join(folder,'state.json'),JSON.stringify(demo('sample')))
const store=createStore(join(folder,'state.json'))
store.ext=createExtRuntime(store,{gameVersion:JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version})
await store.ext.ready
const routes=[]
registerRoutes({inject(deps,fn){fn({webServer:{register(route){routes.push(route);return ()=>{}}}})}},store)
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>成就第二期 · 试玩审稿</title>
<style>body{margin:0;background:#fbf7ef;font:16px system-ui;color:#514341}header{padding:32px;max-width:600px}h1{font-size:26px}p{line-height:1.8}header button{border:1px solid #c7d8cc;background:#f1f7ed;border-radius:14px;padding:12px 18px;color:#514341;cursor:pointer;margin:8px 8px 8px 0}header small{display:block;line-height:1.8;color:#827569}</style>
<header><h1>成就第二期 · 六段新的小故事</h1><p>原有 28 项 + 6 项新成就，共 ${ACHIEVEMENTS.length} 项。<br>右键小猪打开主菜单，进入「图鉴 → 成就」。</p>
<button data-fixture="sample">示例进度</button><button data-fixture="near">差一步达成</button><button data-fixture="fresh">从零试玩</button><button data-fixture="all">全部徽章</button>
<small>这是待合并功能的隔离试玩，游戏内已使用六张独立新徽章。<br>「差一步达成」后，在游戏菜园收获第一块成熟作物，可同时获得百次丰收与四季菜篮；在矿洞点击下一层，可获得矿洞尽头。<br>演示使用临时存档，所有示例进度均为虚构。</small>
<table style="border-spacing:0 12px;font-size:14px;text-align:left"><tr><th>候选</th><th>目标</th></tr>
<tr><td>水边博物学家</td><td>鱼类图鉴 20 种</td></tr><tr><td>鱼篓满满</td><td>捕获入袋 100 条鱼</td></tr><tr><td>行囊里的故事</td><td>纪念品图鉴 10 种</td></tr><tr><td>百次丰收</td><td>收获 100 次（每块地每季一次）</td></tr><tr><td>四季菜篮</td><td>收获 15 种作物</td></tr><tr><td>矿洞尽头</td><td>实际抵达第 20 层</td></tr></table>
<img src="/review/badges.png" alt="六枚徽章草图，依次为鱼类收藏、百条鱼、纪念品、百次丰收、作物种类、矿洞二十层" style="display:block;width:100%;max-width:580px" onerror="this.hidden=true">
</header>
<script>window.__ModuleLoader__={load(entry){window.entry=entry}}</script><script src="/client.js"></script>
<script>window.entry.factory(()=>{}).apply({});document.querySelectorAll('[data-fixture]').forEach(button=>button.addEventListener('click',async()=>{const response=await fetch('/fixture/'+button.dataset.fixture,{method:'POST'});if(response.ok)location.reload();else alert('演示存档切换失败')}))</script></html>`
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1')
    if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html;charset=utf-8'});res.end(html);return}
    if(url.pathname==='/client.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(readFileSync(join(root,'client.js')));return}
    if(url.pathname==='/review/badges.png'){res.writeHead(200,{'content-type':'image/png','cache-control':'no-store'});res.end(readFileSync(join(root,'docs/screenshots/achievements-phase-two-badges.png')));return}
    if(url.pathname.startsWith('/fixture/')&&req.method==='POST') {
      const mode=url.pathname.slice(9)
      if(!['sample','fresh','all','near'].includes(mode)){res.writeHead(400);res.end('invalid fixture');return}
      store.installCommittedState(demo(mode))
      store.flush(true)
      res.writeHead(200,{'content-type':'application/json'});res.end('{"ok":true}');return
    }
    const route=routes.find(one=>one.kind==='prefix'?url.pathname.startsWith(one.path):url.pathname===one.path)
    if(route){await route.handler(req,res);return}
    res.writeHead(404);res.end('not found')
  } catch(error) {res.writeHead(500);res.end(error instanceof Error?error.message:String(error))}
})
server.listen(port,'127.0.0.1',()=>console.log('Achievement draft: http://127.0.0.1:'+port))
function cleanup(){server.close();store.dispose();process.exit(0)}
process.on('SIGINT',cleanup);process.on('SIGTERM',cleanup)
