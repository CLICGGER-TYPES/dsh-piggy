// 藏猪方块 0.2 生成器独立验收：至少 100 个 seed × 4/5/6，全部恰有一个解、区域连通、开局零标记。
// 这里的 bruteSolutions 是测试自己写的排列穷举，不复用 server 的 solve/提示实现。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import puzzle, { makePuzzle } from '../extensions/pig-puzzle/server.js'
import { api, bruteSolutions, regionConnected } from './helpers/pig-puzzle.js'

const SEEDS = Array.from({ length: 100 }, (_, index) => index + 1)

test('100 个 seed × 4/5/6：独立穷举全部恰有一解，颜色区连通，开局零标记', () => {
  const layouts = new Map([[4, new Set()], [5, new Set()], [6, new Set()]])
  const started = performance.now()
  for (const size of [4, 5, 6]) {
    for (const seed of SEEDS) {
      const level = makePuzzle(seed, size)
      assert.equal(level.seed, seed)
      assert.equal(level.size, size)
      assert.equal(level.region.length, size * size)
      assert.equal(new Set(level.region).size, size)
      assert.equal(level.region.every(value => Number.isInteger(value) && value >= 0 && value < size), true)
      for (let color = 0; color < size; color += 1) {
        assert.equal(regionConnected(level, color), true, size + '×' + size + ' seed ' + seed + ' 第 ' + (color + 1) + ' 区不连通')
      }
      const solutions = bruteSolutions(level)
      assert.equal(solutions.length, 1, size + '×' + size + ' seed ' + seed + ' 必须恰有一个解，实际 ' + solutions.length)
      assert.equal(solutions[0].length, size)
      assert.equal(Object.hasOwn(level, 'solution'), false)
      layouts.get(size).add(level.region.join(','))

      const data = { v: 2, seed, size, puzzle: level, board: { pigs: [], excluded: [], undo: [], moves: 0, done: false, doneAt: null }, records: [] }
      const view = puzzle.view(data, api())
      assert.equal(view.placed, 0, size + '×' + size + ' seed ' + seed + ' 开局不该有猪')
      assert.equal(view.cells.length, size * size)
      assert.equal(view.cells.every(cell => cell.mark === 'empty'), true, size + '×' + size + ' seed ' + seed + ' 开局不该有标记')
      assert.equal(view.cells.some(cell => 'given' in cell), false)
      assert.equal('solution' in view, false)
    }
    assert.ok(layouts.get(size).size >= 30, size + '×' + size + ' 只生成了 ' + layouts.get(size).size + ' 种区划，太像固定模板')
  }
  const elapsed = performance.now() - started
  assert.ok(elapsed < 30000, '300 道题的生成/验收耗时异常：' + elapsed.toFixed(0) + 'ms')
})

test('同一个 seed 可复现；不同 seed 不串题；尺寸不串味', () => {
  const first = makePuzzle(20261022, 6)
  const again = makePuzzle(20261022, 6)
  assert.deepEqual(again, first)
  assert.notDeepEqual(makePuzzle(20261023, 6).region, first.region)
  const small = makePuzzle(20261022, 4)
  assert.equal(small.size, 4)
  assert.equal(small.region.length, 16)
  assert.equal(bruteSolutions(small).length, 1)
  // 尺寸入口有边界，不会静默生成 3×3 或 7×7
  assert.equal(makePuzzle(1, 3).size, 5)
  assert.equal(makePuzzle(1, 7).size, 5)
})
