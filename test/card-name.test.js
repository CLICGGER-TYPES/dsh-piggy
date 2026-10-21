import assert from 'node:assert/strict'
import {test} from 'node:test'
import {hatchEgg,migrate,rename,profileView} from '../core.js'
import {PIG,SNAPSHOT,mount,openPanel,contentOf,findByAttr} from './helpers/bundle.js'

test('居民卡输入上限5字；新名字保存同限，旧档长名字保留',async()=>{
 const now=1800000000000,state=hatchEgg(now)
 assert.equal(rename(state,'一二三四五',now),'一二三四五')
 assert.equal(rename(state,'一二三四五六',now),null)
 assert.equal(state.name,'一二三四五')
 state.name='旧档里超过五个字的名字'
 assert.equal(migrate(JSON.parse(JSON.stringify(state)),now).name,state.name)
 const {dom}=await mount({status:{...SNAPSHOT,profile:profileView(state),pig:{...PIG,name:state.name}}})
 openPanel(dom,'card')
 assert.ok(contentOf(dom).allText().includes(state.name))
 findByAttr(contentOf(dom),'data-card-edit','name').fire('click')
 assert.equal(findByAttr(contentOf(dom),'data-card-input','name').maxLength,5)
})
