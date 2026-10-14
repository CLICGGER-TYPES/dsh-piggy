// @ts-check
/**
 * 4 秒轮询：快照「画面上」没变就别重画。
 *
 * 整块内容拆了重建（菜园一屏 160 个节点、52 张图）是白干，还会把悬停卡抹掉。
 * 这里跑的是真的 client.js（只有 DOM 和 fetch 是假的），看的是内容 DOM 的节点身份：
 * 没重画 = 还是同一批节点。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { contentOf, mount, openPanel, settle, SNAPSHOT } from './helpers/bundle.js'

/** 一份带菜园 view 的快照：时间戳和生长期每 4 秒都在变，画面上看不出来。 */
function farmSnapshot() {
  const status = structuredClone(SNAPSHOT)
  status.extViews = {
    farm: {
      now: 1_791_950_400_000, balance: 240, level: 3,
      plots: [{ index: 0, progress: 0.5, remainingMs: 25_200_000, ripe: false }],
      helper: { usedHours: 0 },
    },
  }
  return status
}

test('轮询短路：同一份快照不重画，看不到的字段在动也不重画，真变了才重画', async () => {
  const status = farmSnapshot()
  const { dom, intervals } = await mount({ status })
  openPanel(dom)
  await settle() // 启动时还有一次「在线扩展目录」的请求，等它落地
  const content = contentOf(dom)
  const poll = intervals.find(entry => entry.delay === 4000).fn

  await poll()
  await settle()
  const painted = content.children[0]
  assert.notEqual(painted, undefined, '第一次轮询应该画出来')
  assert.ok(content.children.length > 0)

  await poll()
  await settle()
  assert.equal(content.children[0], painted, '同一份快照不该重建 DOM')

  // 只有「每 4 秒都在变、画面上看不出来」的字段变了：还是不重画
  status.extViews.farm.now += 4000
  status.extViews.farm.plots[0].remainingMs -= 4000
  status.extViews.farm.plots[0].progress += 0.0001
  status.extViews.farm.helper.usedHours += 0.0011
  await poll()
  await settle()
  assert.equal(content.children[0], painted, '看不到的变化不该重建 DOM')

  // 真的变了：重画（否则界面停在旧数字上）
  status.pig.coins += 1
  await poll()
  await settle()
  assert.notEqual(content.children[0], painted, '余额变了必须重画')
})
