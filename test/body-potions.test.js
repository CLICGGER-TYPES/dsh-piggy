import assert from 'node:assert/strict'
import {test} from 'node:test'
import {buy, useItem, hatchEgg, bodyWeightClass, bodyWeightView, ensureBodyWeight, idealWeightG, settleWeight, formStageView, migrate} from '../core.js'
import {SHOP} from '../data.js'
const NOW = 1800000000000
const keys = ['body-normal','body-round','body-fat','body-lock','body-reset']
function pig() {
  const s=hatchEgg(NOW);s.coins=1000
  for (const key of keys) s.inventory[key]=5
  return s
}
test('五种体型药统一100金币，收入背包且独立于疾病药池',()=>{
  const s=pig()
  for(const key of keys){const item=SHOP.find(i=>i.key===key);assert.equal(item.price,100);assert.equal(item.kind,'body');assert.equal(buy(s,key,NOW).ok,true);assert.equal(s.inventory[key],6)}
  assert.equal(s.coins,500)
})
test('三种药立即设置体型并消耗一瓶，不改变健康或疾病',()=>{
  const s=pig();s.illness={chain:0,stage:0,since:NOW};const illness=structuredClone(s.illness),health=s.health
  for(const [key,shape] of [['body-fat','fat'],['body-round','round'],['body-normal','normal']]){
    assert.equal(useItem(s,key,NOW).ok,true);assert.equal(bodyWeightClass(s),shape);assert.equal(s.inventory[key],4);assert.deepEqual(s.illness,illness);assert.equal(s.health,health)
  }
})
test('锁定只固定胖瘦，实际体重继续变化，初始药只解锁不重置体重',()=>{
  const s=pig();useItem(s,'body-fat',NOW);assert.equal(useItem(s,'body-lock',NOW).ok,true)
  const before=s.weightG;settleWeight(s,86400000*30);assert.ok(s.weightG<before);s.weightG=idealWeightG(s)
  assert.equal(bodyWeightClass(s),'fat');assert.equal(bodyWeightView(s,NOW).locked,true)
  const count=s.inventory['body-round'];assert.equal(useItem(s,'body-round',NOW).reason,'body-locked');assert.equal(s.inventory['body-round'],count)
  ensureBodyWeight(s);assert.equal(bodyWeightClass(s),'fat')
  const loaded=migrate(JSON.parse(JSON.stringify(s)),NOW);assert.equal(bodyWeightClass(loaded),'fat')
  const weight=loaded.weightG;assert.equal(useItem(loaded,'body-reset',NOW).ok,true);assert.equal(loaded.weightG,weight);assert.equal(bodyWeightClass(loaded),'normal')
})
test('重复锁定、未锁定时解除、同档位体型药均不吞药',()=>{
  const s=pig();for(const key of ['body-normal','body-reset']){assert.equal(useItem(s,key,NOW).ok,false);assert.equal(s.inventory[key],5)}
  useItem(s,'body-lock',NOW);assert.equal(useItem(s,'body-lock',NOW).ok,false);assert.equal(s.inventory['body-lock'],4)
})
test('死亡和未孵化不允许用药，锁定不覆盖死亡立绘',()=>{
  const s=pig();useItem(s,'body-fat',NOW);useItem(s,'body-lock',NOW);s.dead=true;s.diedAt=NOW;s.health=0
  assert.notEqual(formStageView(s,NOW).art,'pig-fat')
  for(const key of keys){assert.equal(useItem(s,key,NOW).ok,false);assert.ok(s.inventory[key]>=4)}
  const box=pig();box.hatched=false;assert.equal(useItem(box,'body-fat',NOW).reason,'box')
})
test('新增字段保持旧档兼容，非法锁定值被清理',()=>{
  const s=pig();assert.deepEqual(ensureBodyWeight(s),{playDay:'',plays:0});s.bodyWeight.lockedClass='bogus';ensureBodyWeight(s);assert.equal(bodyWeightClass(s),'normal')
})

test('生病仍显示病态，不因胖瘦锁而治疗；特殊皮肤和活动不会吞体型药',()=>{
  const s=pig();useItem(s,'body-fat',NOW);useItem(s,'body-lock',NOW)
  s.illness={chain:0,stage:1,startedAt:NOW,progressMs:0};s.health=3
  assert.equal(bodyWeightClass(s),'fat');assert.equal(formStageView(s,NOW).art,'pig-fat');assert.equal(s.health,3)
  useItem(s,'body-reset',NOW);s.skin='mint';assert.equal(useItem(s,'body-round',NOW).reason,'body-hidden');assert.equal(s.inventory['body-round'],5)
  s.skin='default';s.activity={kind:'work',key:'odd',startedAt:NOW,endsAt:NOW+60000};assert.equal(useItem(s,'body-round',NOW).reason,'away');assert.equal(s.inventory['body-round'],5)
})
