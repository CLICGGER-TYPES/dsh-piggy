// @ts-check
/** 打工/学习/背包第一层固定九宫格：内容少也占 3 行，背包首页固定 9 格。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SNAPSHOT, contentOf, findByAttr, mount, openPanel } from '../../helpers/bundle.js'

test('打工/学习固定九宫格，背包和旅行放不下时按主屏分页', async () => {
  const job = {
    key: 'bricks', label: '搬砖', emoji: '🧱', trait: 'strong', minutes: 30, coins: 40,
    available: true, qualified: true, requirements: [], traitEmoji: '💪', traitLabel: '武力',
    traitPoints: 0, payPercent: 0, satiety: -6, cleanliness: -4,
  }
  const work = await mount({ status: { ...SNAPSHOT, jobs: [job] } })
  openPanel(work.dom, 'work')
  assert.equal(contentOf(work.dom).querySelectorAll('.dp-nine-grid').length, 1, '打工技能层')

  const subject = { key: 'chinese', label: '语文', emoji: '📖', traitLabel: '智力', lessons: 0, stageKey: '', available: true, affordable: true }
  const study = await mount({ status: { ...SNAPSHOT, subjects: [subject], interests: [] } })
  openPanel(study.dom, 'study')
  assert.equal(contentOf(study.dom).querySelectorAll('.dp-nine-grid').length, 1, '学习学段层')

  const bag = await mount({ status: { ...SNAPSHOT } })
  openPanel(bag.dom, 'bag')
  const pages = contentOf(bag.dom).querySelectorAll('.dp-pager-page')
  assert.equal(pages.length, 2, '背包放不下就分 2 页')
  assert.equal(pages[0].children.length, 9, '第一页 9 格')
  assert.equal(pages[1].children.length, 2, '第二页已穿戴 + 钱包')
  assert.equal(contentOf(bag.dom).querySelectorAll('.dp-home-dot').length, 2, '两页各有圆点')
  assert.ok(findByAttr(contentOf(bag.dom), 'data-bag', 'bait'), '鱼饵在第一页')
  assert.ok(findByAttr(contentOf(bag.dom), 'data-bag', 'worn'), '已穿戴在第二页')
  assert.ok(findByAttr(contentOf(bag.dom), 'data-bag', 'wallet'), '钱包在第二页')

  const trips = Array.from({ length: 12 }, (_, index) => ({
    key: 'trip-' + index, label: '地点' + index, emoji: '🌳',
    minutes: 30 * (index + 1), cost: 10 * (index + 1), affordable: true, locked: '',
  }))
  const travel = await mount({ status: { ...SNAPSHOT, trips } })
  openPanel(travel.dom, 'travel')
  const travelPages = contentOf(travel.dom).querySelectorAll('.dp-pager-page')
  assert.equal(travelPages.length, 2, '12 个目的地分 2 页')
  assert.equal(travelPages[0].children.length, 9, '旅行第一页 9 格')
  assert.equal(travelPages[1].children.length, 3, '旅行第二页 3 格')
  assert.equal(contentOf(travel.dom).querySelectorAll('.dp-home-dot').length, 2, '旅行两页各有圆点')
})
