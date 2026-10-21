import assert from 'node:assert/strict'
import {test} from 'node:test'
import {hatchEgg,migrate,pickLine,profileView,editProfile,say,replyToLine} from '../core.js'
import {PERSONALITIES,LINES,LINE_MEMORY,REPLY_HAPPINESS} from '../data.js'
const now=1800000000000
const make=personality=>{const s=hatchEgg(now);s.personality=personality;s.catchphrase='';return s}

test('12种性格可分配、显示、选择；老六种键和用户内容不变',()=>{
 assert.deepEqual(PERSONALITIES.map(p=>p.label),['元气','悠闲','傲娇','贴心','自恋','温和','黏人','害羞','好奇','调皮','呆萌','认真'])
 assert.equal(new Set(PERSONALITIES.map(p=>p.key)).size,12)
 const seen=new Set(Array.from({length:300},(_,i)=>hatchEgg(now+i*7919).personality))
 assert.equal(seen.size,12)
 for(const p of PERSONALITIES){
  const s=make(p.key);s.catchphrase='自己写的';s.motto='我的签名';s.profileEdits=0
  const copy=migrate(JSON.parse(JSON.stringify(s)),now)
  assert.equal(copy.personality,p.key);assert.equal(copy.catchphrase,s.catchphrase);assert.equal(copy.motto,s.motto);assert.equal(copy.profileEdits,0)
  assert.equal(profileView(copy,now).personalities.length,12)
  const fresh=make('normal');assert.equal(editProfile(fresh,{personality:p.key}).ok,true);assert.equal(fresh.personality,p.key)
 }
})
test('台词标签合法、不可变；每个场景有通用句，高频场景12种性格均有专属覆盖',()=>{
 const keys=new Set(PERSONALITIES.map(p=>p.key))
 for(const [scene,pool]of Object.entries(LINES)){
  assert.ok(pool.some(line=>line.personalities===undefined),scene+' common fallback')
  for(const line of pool)if(line.personalities){
   assert.ok(Object.isFrozen(line.personalities));assert.ok(line.personalities.length>0)
   assert.equal(new Set(line.personalities).size,line.personalities.length)
   for(const key of line.personalities)assert.ok(keys.has(key),line.text+': '+key)
  }
 }
 for(const scene of ['pet','idle','hungry','lonely','morning','evening'])for(const p of PERSONALITIES)
  assert.ok(LINES[scene].some(line=>line.personalities?.includes(p.key)),scene+': '+p.key)
})
test('逐场景逐性格选句，不串专属台词；原表下标记忆和不重复规则保持',()=>{
 for(const p of PERSONALITIES)for(const [scene,pool]of Object.entries(LINES)){
  const s=make(p.key),eligible=pool.filter(l=>!l.personalities||l.personalities.includes(p.key)),recent=[]
  for(let i=0;i<eligible.length+4;i++){
   const result=pickLine(s,scene,()=>0);const index=s.dialogue.lastByScene[scene].at(-1)
   assert.equal(result.text,pool[index].text.split('[主人]').join(s.dialogue.ownerName))
   assert.ok(!pool[index].personalities||pool[index].personalities.includes(p.key))
   const memory=Math.min(LINE_MEMORY,eligible.length-1)
   if(memory)assert.ok(!recent.slice(-memory).includes(index),scene+' '+p.key)
   recent.push(index)
  }
 }
})
test('未知性格只说通用句，旧单数字记忆、切性格后仍使用总表下标',()=>{
 const s=make('unknown');s.dialogue.lastByScene.pet=1
 for(let i=0;i<8;i++){pickLine(s,'pet',()=>0);assert.equal(LINES.pet[s.dialogue.lastByScene.pet.at(-1)].personalities,undefined)}
 for(const p of PERSONALITIES){s.personality=p.key;pickLine(s,'pet',()=>0);const index=s.dialogue.lastByScene.pet.at(-1);assert.ok(!LINES.pet[index].personalities||LINES.pet[index].personalities.includes(p.key))}
})
test('性格改变不改已显示对话/回复；回复仍只奖励一次',()=>{
 const s=make('clingy');s.happiness=50
 const pool=LINES.pet.filter(l=>!l.personalities||l.personalities.includes('clingy'))
 const i=pool.findIndex(l=>l.replies?.length)
 say(s,'pet',now,()=> (i+.5)/pool.length)
 const message=s.pending.at(-1),label=message.replies[0],open=JSON.stringify(s.dialogue.open)
 assert.equal(editProfile(s,{personality:'cranky'}).ok,true)
 assert.equal(JSON.stringify(s.dialogue.open),open)
 assert.equal(replyToLine(s,message.id,0).reply,label)
 assert.equal(s.happiness,50+REPLY_HAPPINESS)
 assert.equal(replyToLine(s,message.id,0).ok,false)
})
