import assert from 'node:assert/strict'
import {test} from 'node:test'
import {hatchEgg,migrate,rename,profileView} from '../../../src/host/core.js'
import {PIG,SNAPSHOT,mount,openPanel,contentOf,findByAttr} from '../../helpers/bundle.js'

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

test('旧存档修改次数为零，居民卡仍可用铅笔改生日和性格并重复保存',async()=>{
 const now=1800000000000,state=hatchEgg(now)
 state.profileEdits=0
 const {dom}=await mount({status:{...SNAPSHOT,profile:profileView(state,now),pig:PIG}})
 openPanel(dom,'card')
 assert.ok(!contentOf(dom).allText().includes('只能改这一次'))
 const birthday=findByAttr(contentOf(dom),'data-card-edit','birthday')
 assert.ok(birthday,'生日行有铅笔')
 birthday.fire('click')
 assert.ok(findByAttr(contentOf(dom),'data-card-input','birthday-month'))
 findByAttr(contentOf(dom),'data-card-save','birthday').fire('click')
 await new Promise(resolve=>setTimeout(resolve,0))
 assert.ok(findByAttr(contentOf(dom),'data-card-edit','birthday'),'保存后生日铅笔保留')
 const personality=findByAttr(contentOf(dom),'data-card-edit','personality')
 assert.ok(personality,'性格行有铅笔')
 personality.fire('click')
 const trigger=findByAttr(contentOf(dom),'data-card-input','personality')
 assert.ok(trigger,'性格触发器在')
 trigger.fire('click')
 const options=contentOf(dom).querySelectorAll('.dp-vcard-select-option')
 assert.ok(options.length>1,'性格菜单展开后不会立刻消失')
 options[1].fire('click')
 assert.equal(contentOf(dom).querySelectorAll('.dp-vcard-select-option').length,0,'选完收起菜单')
 findByAttr(contentOf(dom),'data-card-save','personality').fire('click')
 await new Promise(resolve=>setTimeout(resolve,0))
 assert.ok(findByAttr(contentOf(dom),'data-card-edit','personality'),'保存后性格铅笔保留')
})
