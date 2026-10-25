// @ts-check
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createStore } from '../store.js'
import { achievementsView, JOBS } from '../core.js'
import { snapshot } from '../snapshot.js'
const NOW=1_800_000_000_000

test('real successful actions persist badges; rejected care and polling never count twice', () => {
  const dir=mkdtempSync(join(tmpdir(),'pig-achievements-'))
  let store=createStore(join(dir,'state.json'),{now:()=>NOW})
  try {
    store.hatch()
    store.mutate(state=>{state.inventory.apple=2;return {ok:true}})
    assert.equal(store.act('feed','apple').ok,true)
    assert.equal(store.state.achievements.totals.feeds,1)
    store.state.activity={kind:'work',endsAt:NOW+60000,startedAt:NOW,key:'odd-job'}
    assert.equal(store.act('play').ok,false, 'play is still refused while away')
    assert.equal(store.state.achievements.totals.feeds,1)
    store.state.activity=null
    for(let i=0;i<4;i++) store.freshen()
    assert.equal(store.state.achievements.totals.feeds,1)
    const view=snapshot(store)
    const meal=view.dex.achievements.find(item=>item.key==='first-meal')
    assert.equal(meal.acquired,true)
    assert.equal(view.pending.filter(event=>event.kind==='achievement').length,1)
    assert.equal(snapshot(store).pending.filter(event=>event.kind==='achievement').length,0)
    store.dispose()
    store=createStore(join(dir,'state.json'),{now:()=>NOW})
    assert.equal(achievementsView(store.state).find(item=>item.key==='first-meal').firstAt,NOW)
    assert.equal(store.state.pending.length,0)
  } finally {store.dispose();rmSync(dir,{recursive:true,force:true})}
})

test('adopting through real store preserves partial lifetime counts and reset clears them', () => {
  const dir=mkdtempSync(join(tmpdir(),'pig-achievements-'))
  const store=createStore(join(dir,'state.json'),{now:()=>NOW})
  try {
    store.hatch()
    store.mutate(state=>{state.stats.baths=6;state.dead=true;return {ok:true}})
    assert.equal(store.adopt(),true)
    store.hatch()
    store.mutate(state=>{state.stats.baths=4;return {ok:true}})
    assert.equal(store.state.achievements.totals.baths,10)
    assert.equal(achievementsView(store.state).find(item=>item.key==='clean-ten').acquired,true)
    store.reset()
    assert.equal(achievementsView(store.state).some(item=>item.acquired),false)
  } finally {store.dispose();rmSync(dir,{recursive:true,force:true})}
})


test('work unlocks only after actual completion, including offline settlement', () => {
  const dir=mkdtempSync(join(tmpdir(),'pig-achievements-'))
  let now=NOW
  const store=createStore(join(dir,'state.json'),{now:()=>now})
  try {
    store.hatch()
    assert.equal(store.startWork(JOBS[0].key).ok,true)
    assert.equal(store.state.achievements.unlocked['first-job'],undefined)
    now=store.state.activity.endsAt-1
    store.freshen()
    assert.equal(store.state.achievements.unlocked['first-job'],undefined)
    now+=1
    store.freshen()
    assert.equal(store.state.achievements.unlocked['first-job'].firstAt,now)
    assert.equal(store.state.achievements.totals.jobs,1)
    store.freshen()
    assert.equal(store.state.achievements.totals.jobs,1)
  } finally {store.dispose();rmSync(dir,{recursive:true,force:true})}
})
