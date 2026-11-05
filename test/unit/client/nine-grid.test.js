// @ts-check
/** 打工/学习/背包第一层固定九宫格：内容少也占 3 行，背包首页固定 9 格。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SNAPSHOT, contentOf, findByAttr, mount, openPanel } from '../../helpers/bundle.js'

test('打工、学习第一层占满九宫格，背包首页固定 9 格并留「更多」', async () => {
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
  assert.equal(contentOf(bag.dom).querySelectorAll('.dp-nine-grid').length, 1, '背包分类层')
  assert.equal(contentOf(bag.dom).querySelectorAll('.dp-tile').length, 9, '背包首页 9 格')

  const more = findByAttr(contentOf(bag.dom), 'data-bag', 'more')
  assert.ok(more, '第 9 格是更多')
  more.fire('click')
  assert.ok(findByAttr(contentOf(bag.dom), 'data-bag', 'bait'), '更多里有鱼饵')
  assert.ok(findByAttr(contentOf(bag.dom), 'data-bag', 'worn'), '更多里有已穿戴')
  assert.ok(findByAttr(contentOf(bag.dom), 'data-bag', 'wallet'), '更多里有钱包')
})
