import assert from 'node:assert/strict'
import {test} from 'node:test'
import farm from '../extensions/farm/server.js'
import {farmClassicFiles} from '../scripts/farm-classic-files.mjs'
import {api,establishedFarm,H,T0,renderFarm} from './helpers/farm-ui.js'

test('六块托管地的纸感小农场与大农场均展示自然剩余时间，不再出现两小时排队', () => {
  const data=establishedFarm(), clock=api()
  data.exp=10000; data.helper.level=1; data.seeds.cabbage=12
  farm.actions.hire(data,{},clock)
  for(let plot=0;plot<6;plot++) farm.actions.plant(data,{plot,item:'cabbage'},clock)
  clock.now=T0+25*60000
  const view=farm.view(data,clock)
  for(const mode of ['panel','big']) {
    const ui=renderFarm(view,mode)
    for(let plot=0;plot<6;plot++) {
      ui.find('data-farm-plot',String(plot)).fire('click')
      assert.match(ui.text(),/帮工照料/)
      assert.doesNotMatch(ui.text(),/等帮工|还能干|六小时/)
      assert.equal(view.plots[plot].remainingMs,18*H-25*60000)
      assert.ok(view.plots[plot].progress>0)
    }
  }
  const classic=renderFarm(view,'panel',{},farmClassicFiles()['client.js'])
  assert.match(classic.text(),/持续照料/)
  assert.doesNotMatch(classic.text(),/还能干|六小时|等帮工/)
})
