import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mount,settle,SNAPSHOT,hostOf,findByClass} from './helpers/bundle.js'
import {processPending} from '../src/client/pending.js'
const gift={id:10,at:100,kind:'gift',text:'在线礼包：金币 +20'}
const line={id:11,at:100,kind:'line',text:'这份小惊喜，有你在才好玩',replies:['一起拆']}

test('领礼包后奖励和当次台词都保留，回复不被奖励回执抹掉',async()=>{
 const {dom,calls}=await mount({status:{...SNAPSHOT,daily:{...SNAPSHOT.daily,canSignIn:false,unclaimed:1}},actResult:{...SNAPSHOT,ok:true,reward:'金币 +20',pending:[gift,line]}})
 findByClass(hostOf(dom),'dp-daily').fire('click');await settle()
 const text=findByClass(hostOf(dom),'dp-bubble').allText()
 assert.ok(text.includes('金币 +20'),text);assert.ok(text.includes(line.text),text)
 const reply=findByClass(hostOf(dom),'dp-reply');assert.ok(reply);reply.fire('click');await settle()
 const requests=calls.filter(c=>c.method==='POST').map(c=>JSON.parse(c.body))
 assert.ok(requests.some(r=>r.action==='reply'&&r.line===line.id))
 assert.ok(!requests.some(r=>r.action==='pet'))
})
function harness(events,quiet=false){
 const shown=[],bubbles=[];globalThis.window={}
 const ctx={view:{pending:events,dialogue:{quiet}},lastPendingId:0,lastPendingAt:0,isOpen:false,
  showBubble:(...args)=>bubbles.push(args),toast(){},react(){},burst(){}}
 processPending(ctx,e=>shown.push(e));return {ctx,shown,bubbles}
}
test('同一批多个奖励只展示一次，保留最后一条可回复台词和全部奖励',()=>{
 const newer={...line,id:13,text:'今天的运气，分你一半',replies:['好呀']}
 const h=harness([gift,line,{...gift,id:12,text:'在线礼包：苹果 ×1'},newer])
 assert.equal(h.shown.length,1);assert.equal(h.shown[0].id,13)
 for(const text of ['金币 +20','苹果 ×1',newer.text])assert.ok(h.shown[0].text.includes(text))
 assert.deepEqual(h.shown[0].replies,['好呀']);assert.equal(h.bubbles.length,0)
 processPending(h.ctx,e=>h.shown.push(e));assert.equal(h.shown.length,1)
})
test('免打扰或没有猪台词时仍能看到领取结果',()=>{
 const h=harness([gift],true);assert.equal(h.shown.length,0);assert.ok(h.bubbles[0][0].includes('金币 +20'))
})
