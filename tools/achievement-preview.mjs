// @ts-check
/** Isolated draft client. Test data never touches a real pet save. */
import http from 'node:http'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStore } from '../store.js'
import { registerRoutes } from '../routes.js'
import { createExtRuntime } from '../store/ext-runtime.js'
import { installPreviewExtensions, seedExtensionPreview } from './extension-achievement-fixtures.mjs'
import { hatchEgg, xpForLevel, FISH, ALL_SOUVENIRS, settleAchievements } from '../packages/pet-core/src/index.js'
const root=fileURLToPath(new URL('../',import.meta.url))
const folder=mkdtempSync(join(tmpdir(),'pig-achievement-preview-'))
const port=Number(process.env.PIG_ACHIEVEMENT_PORT||8780)

function demo(mode) {
  const now=Date.now()
  const state=/** @type {any} */(hatchEgg(now))
  state.inventory={apple:30,soap:30};state.coins=20000
  if(mode!=='fresh') {
    state.xp=xpForLevel(mode==='all'?40:12)
    Object.assign(state.stats,{feeds:1,baths:mode==='all'?10:6,plays:mode==='all'?20:13,pets:mode==='all'?100:58,
      courses:1,jobs:mode==='all'?100:8,trips:mode==='all'?10:1,fishCaught:mode==='all'?5:2})
    for(const fish of FISH.slice(0,mode==='all'?5:2)) state.dex.fish[fish.key]={firstAt:now,count:1}
    for(const item of ALL_SOUVENIRS.slice(0,mode==='all'?3:1)) state.dex.souvenirs[item.key]={firstAt:now,count:1}
    if(mode==='all') for(const key of ['king','devil']) state.dex.forms[key]={firstAt:now,count:1}
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
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>小猪成就 · 可试玩初稿</title>
<style>body{margin:0;background:#fbf7ef;font:16px system-ui;color:#514341}header{padding:32px;max-width:600px}h1{font-size:26px}p{line-height:1.8}header button{border:1px solid #c7d8cc;background:#f1f7ed;border-radius:14px;padding:12px 18px;color:#514341;cursor:pointer;margin:8px 8px 8px 0}header small{display:block;line-height:1.8;color:#827569}</style>
<header><h1>每一枚徽章，都是一只小猪</h1><p>28 项小猪成就，包含菜园、矿洞、扭蛋和盲盒。<br>右键小猪打开主菜单，进入「图鉴 → 成就」。</p>
<button data-fixture="sample">查看示例进度</button><button data-fixture="fresh">从零试玩</button><button data-fixture="all">查看全部徽章</button>
<small>这是隔离的演示存档；名字、门槛、图案和页面都还可以调整。<br>从零试玩后，进入菜园收获一块已成熟的作物，观察成就解锁。示例数据不是你的真实游戏记录。</small></header>
<script>window.__ModuleLoader__={load(entry){window.entry=entry}}</script><script src="/client.js"></script>
<script>window.entry.factory(()=>{}).apply({});document.querySelectorAll('[data-fixture]').forEach(button=>button.addEventListener('click',async()=>{await fetch('/fixture/'+button.dataset.fixture,{method:'POST'});location.reload()}))</script></html>`
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1')
    if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html;charset=utf-8'});res.end(html);return}
    if(url.pathname==='/client.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(readFileSync(join(root,'client.js')));return}
    if(url.pathname.startsWith('/fixture/')&&req.method==='POST') {
      const mode=url.pathname.slice(9)
      if(!['sample','fresh','all'].includes(mode)){res.writeHead(400);res.end('invalid fixture');return}
      store.mutate(state=>{for(const key of Object.keys(state))delete state[key];Object.assign(state,demo(mode));return {ok:true}})
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
