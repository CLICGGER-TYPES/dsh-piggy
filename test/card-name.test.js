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

test('旧存档修改次数为零，居民卡仍可打开性格生日编辑并重复保存',async()=>{
 const now=1800000000000,state=hatchEgg(now)
 state.profileEdits=0
 const {dom}=await mount({status:{...SNAPSHOT,profile:profileView(state,now),pig:PIG}})
 openPanel(dom,'card')
 let open=findByAttr(contentOf(dom),'data-card-once','open')
 assert.ok(open,'旧次数用完也显示入口')
 assert.ok(!contentOf(dom).allText().includes('只能改这一次'))
 open.fire('click')
 assert.ok(findByAttr(contentOf(dom),'data-card-once','personality'))
 findByAttr(contentOf(dom),'data-card-once','save').fire('click')
 await new Promise(resolve=>setTimeout(resolve,0))
 open=findByAttr(contentOf(dom),'data-card-once','open')
 assert.ok(open,'保存后入口保留')
 open.fire('click')
 assert.ok(findByAttr(contentOf(dom),'data-card-once','save'),'可再次编辑')
})
