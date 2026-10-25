// 藏猪方块 0.2.6：随机题、三条命/放错拒绝、左右键/拖动、提示、持久化和旧数据迁移。
// 唯一解用 test/helpers/pig-puzzle.js 里独立写的排列穷举验证（不复用 server 的 solve）。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { test } from 'node:test'

import puzzle, { conflictsOf, hintFor, makePuzzle } from '../extensions/pig-puzzle/server.js'
import { ROOT, api, boardOf, bruteSolutions, fresh, pigsOf, regionConnected } from './helpers/pig-puzzle.js'

function seeded(seed = 123456, size = 5) {
  const data = fresh()
  data.puzzle = makePuzzle(seed, size)
  data.seed = data.puzzle.seed
  data.size = data.puzzle.size
  data.board = { pigs: [], excluded: [], undo: [], moves: 0, lives: 3, done: false, doneAt: null }
  data.records = []
  return data
}

function solutionOf(level) {
  const solutions = bruteSolutions(level)
  assert.equal(solutions.length, 1, '测试题必须唯一解')
  return solutions[0]
}

function placeAll(data, account, cells) {
  for (const cell of cells) {
    const mark = puzzle.view(data, account).cells[cell].mark
    if (mark === 'pig') continue
    assert.equal(puzzle.actions.tap(data, { cell, mode: 'pig' }, account).ok, true)
  }
}

test('扩展格式：0.2.6 三件套和已批准猪图；manifest 不带经济，图哈希未变', () => {
  for (const name of ['manifest.json', 'server.js', 'client.js', 'assets/pig.png']) {
    assert.ok(statSync(new URL(name, ROOT)).size > 0, name)
    assert.ok(statSync(new URL(name, ROOT)).size <= 512 * 1024, name + ' 超过 512KB')
  }
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8'))
  assert.equal(manifest.key, 'pig-puzzle')
  assert.equal(manifest.version, '0.2.6')
  assert.match(manifest.minGame, /^\d+\.\d+\.\d+$/)
  assert.equal(manifest.economy, undefined, '益智玩法不设自己的币，也不动金币')
  assert.deepEqual(manifest.assets, ['pig.png'])
  assert.equal(manifest.app.emoji, '🐖')
  assert.match(manifest.description, /随机/)
  assert.match(manifest.description, /不自动落猪/)
  assert.match(manifest.description, /3 次机会/)
  const provenance = readFileSync(new URL('PROVENANCE.md', ROOT), 'utf8')
  assert.match(provenance, /idle\.png/)
  const hash = createHash('sha256').update(readFileSync(new URL('assets/pig.png', ROOT))).digest('hex')
  assert.match(provenance, new RegExp(hash))
  assert.match(provenance, /0\.2\.0/)
})

test('生成：不同 seed 得到不同题，颜色区各连通、每区恰一个解格，且没有给定猪', () => {
  const layouts = new Set()
  for (const seed of [1, 2, 3, 7, 42, 999, 20261022]) {
    for (const size of [4, 5, 6]) {
      const level = makePuzzle(seed, size)
      assert.equal(level.size, size)
      assert.equal(level.region.length, size * size)
      assert.equal(new Set(level.region).size, size, '颜色区数量 = 棋盘边长')
      for (let color = 0; color < size; color += 1) assert.equal(regionConnected(level, color), true, '第 ' + (color + 1) + ' 区不连通')
      const solutions = bruteSolutions(level)
      assert.equal(solutions.length, 1, size + '×' + size + ' seed ' + seed + ' 必须唯一解')
      assert.equal(Object.hasOwn(level, 'solution'), false, 'makePuzzle 不返回解')
      assert.equal(solutions[0].length, size)
      layouts.add(size + ':' + level.region.join(','))
    }
  }
  assert.ok(layouts.size > 15, '多种 seed 必须长出多种区划，不能只是几张模板')
})

test('开局：view 里一个猪/排除/给定都没有；data 不存 solution', () => {
  const data = seeded(4242, 6)
  const view = puzzle.view(data, api())
  assert.equal(view.placed, 0)
  assert.equal(view.remaining, 6)
  assert.equal(view.cells.length, 36)
  assert.equal(view.cells.every(cell => cell.mark === 'empty'), true)
  assert.equal(view.cells.some(cell => 'given' in cell), false, '0.2 不再有给定猪')
  assert.equal(view.conflicts.length, 0)
  assert.equal(view.canUndo, false)
  assert.equal('solution' in view, false)
  assert.equal('solution' in data.puzzle, false)
  assert.doesNotMatch(JSON.stringify(view), /"solution"/)
  assert.doesNotMatch(JSON.stringify(data), /"solution"/)
})

test('左键：空 -> 猪 -> 清除；排除格左键会转成猪；右键：空 -> 排除 -> 清除', () => {
  const data = seeded(11, 4)
  const account = api()
  const solution = solutionOf(makePuzzle(11, 4))
  const cell = solution[0]
  assert.equal(puzzle.actions.tap(data, { cell, mode: 'pig' }, account).ok, true)
  assert.equal(puzzle.view(data, account).cells[cell].mark, 'pig')
  assert.equal(puzzle.actions.tap(data, { cell, mode: 'pig' }, account).ok, true)
  assert.equal(puzzle.view(data, account).cells[cell].mark, 'empty')
  assert.equal(puzzle.actions.tap(data, { cell, mode: 'exclude' }, account).ok, true)
  assert.equal(puzzle.view(data, account).cells[cell].mark, 'excluded')
  assert.equal(puzzle.actions.tap(data, { cell, mode: 'exclude' }, account).ok, true)
  assert.equal(puzzle.view(data, account).cells[cell].mark, 'empty')
  assert.equal(puzzle.actions.tap(data, { cell, mode: 'exclude' }, account).ok, true)
  assert.equal(puzzle.actions.tap(data, { cell, mode: 'pig' }, account).ok, true)
  let view = puzzle.view(data, account)
  assert.equal(view.cells[cell].mark, 'pig')
  assert.equal(boardOf(data).excluded.includes(cell), false, '转成猪要清掉排除')
  assert.equal(view.lives, 3, '放对、排除、清除都不扣机会')
  // 右键点猪是无操作，不会把猪清掉
  const before = structuredClone(data)
  assert.deepEqual(puzzle.actions.tap(data, { cell, mode: 'exclude' }, account), { ok: true, changed: false })
  assert.deepEqual(data, before)
  // 点一下只改这一格，不会补出别的猪
  assert.equal(view.placed, 1)
  assert.equal(puzzle.actions.tap(data, { cell: solution[1], mode: 'pig' }, account).ok, true)
  view = puzzle.view(data, account)
  assert.equal(view.placed, 2)
  assert.equal(view.cells.filter(entry => entry.mark === 'pig').length, 2)
  assert.equal(view.lives, 3)
})

test('拖动按模式成组：左拖放猪、右拖排除；整组一次撤销，猪/排除格不重复刷', () => {
  const data = seeded(12, 4)
  const account = api()
  const level = makePuzzle(12, 4)
  const solution = solutionOf(level)
  const pigCells = solution.slice(0, 3)
  const free = level.region.map((value, cell) => cell).filter(cell => !solution.includes(cell))
  assert.equal(puzzle.actions.drag(data, { cells: pigCells, mode: 'pig' }, account).ok, true)
  let view = puzzle.view(data, account)
  assert.deepEqual(pigCells.map(cell => view.cells[cell].mark), ['pig', 'pig', 'pig'])
  const excludeCells = free.slice(0, 2)
  assert.equal(puzzle.actions.drag(data, { cells: [pigCells[0], ...excludeCells], mode: 'exclude' }, account).ok, true)
  view = puzzle.view(data, account)
  assert.equal(view.cells[pigCells[0]].mark, 'pig', '排除拖过猪不扫掉')
  assert.deepEqual(excludeCells.map(cell => view.cells[cell].mark), ['excluded', 'excluded'])
  assert.equal(view.moves, 2)
  assert.equal(view.lives, 3, '排除成组不扣机会')
  assert.equal(puzzle.actions.undo(data, {}, account).ok, true)
  view = puzzle.view(data, account)
  assert.deepEqual(excludeCells.map(cell => view.cells[cell].mark), ['empty', 'empty'])
  assert.deepEqual(pigCells.map(cell => view.cells[cell].mark), ['pig', 'pig', 'pig'], '撤销只退这一组')
  assert.equal(view.moves, 1)
  assert.equal(puzzle.actions.undo(data, {}, account).ok, true)
  assert.equal(puzzle.view(data, account).placed, 0)
  assert.equal(puzzle.actions.drag(data, { cells: [5, 5], mode: 'pig' }, account).ok, false)
  assert.equal(puzzle.actions.drag(data, { cells: [5], mode: 'nope' }, account).ok, false)
})

test('放错不会留下错猪；完成由服务器逐条判定，完成后不能再改盘面', () => {
  const level = makePuzzle(77, 4)
  const data = seeded(77, 4)
  const account = api()
  const solution = solutionOf(level)
  const wrong = level.region.map((value, cell) => cell).find(cell => !solution.includes(cell))
  const before = structuredClone(data)
  const result = puzzle.actions.tap(data, { cell: wrong, mode: 'pig' }, account)
  assert.equal(result.ok, true)
  assert.equal(result.wrong, true)
  assert.equal(result.lives, 2)
  assert.equal(puzzle.view(data, account).conflicts.length, 0, '错猪根本不落盘，不会制造冲突')
  assert.deepEqual(data.board.pigs, before.board.pigs)
  assert.equal(data.board.moves, 0)
  assert.equal(data.board.undo.length, 0)
  placeAll(data, account, solution)
  const view = puzzle.view(data, account)
  assert.equal(view.done, true)
  assert.match(view.status, /完成/)
  assert.equal(view.lives, 2, '完成不会返还机会')
  assert.equal(data.records.length, 1)
  assert.equal(data.records[0].seed, data.seed)
  assert.equal(data.records[0].size, 4)
  assert.equal(data.records[0].at, account.now)
  const done = structuredClone(data)
  assert.deepEqual(puzzle.actions.tap(data, { cell: solution[0], mode: 'pig' }, account), { ok: false, reason: 'already' })
  assert.deepEqual(puzzle.actions.drag(data, { cells: [solution[0]], mode: 'exclude' }, account), { ok: false, reason: 'already' })
  assert.deepEqual(puzzle.actions.undo(data, {}, account), { ok: false, reason: 'already' })
  assert.deepEqual(puzzle.actions.hint(data, {}, account), { ok: false, reason: 'already' })
  assert.deepEqual(data, done)
})

test('重开保留同题，新一局换 seed；换尺寸也是新题；记录都保留', () => {
  const data = seeded(5, 5)
  const account = api()
  const level = data.puzzle
  placeAll(data, account, solutionOf(level))
  assert.equal(puzzle.view(data, account).done, true)
  const seed = data.seed
  const region = data.puzzle.region.slice()
  assert.equal(puzzle.actions.restart(data, {}, account).ok, true)
  let view = puzzle.view(data, account)
  assert.equal(view.done, false)
  assert.equal(view.placed, 0)
  assert.equal(data.seed, seed)
  assert.deepEqual(data.puzzle.region, region, '重开还是同一道题')
  assert.equal(data.records.length, 1)
  const result = puzzle.actions.new(data, {}, account, () => 0.314159)
  assert.equal(result.ok, true)
  assert.notEqual(data.seed, seed, '新一局必须换 seed')
  assert.equal(data.records.length, 1, '换题不删记录')
  assert.equal(puzzle.view(data, account).placed, 0)
  const beforeSize = data.size
  assert.equal(puzzle.actions.new(data, { size: 6 }, account, () => 0.271828).ok, true)
  assert.notEqual(data.size, beforeSize)
  assert.equal(puzzle.view(data, account).cells.length, 36)
  assert.equal(puzzle.actions.new(data, { size: 3 }, account).ok, false)
  assert.equal(puzzle.actions.new(data, { level: 2 }, account).ok, false)
})

test('payload 严格校验；客户端塞 done/pigs/solution 不能伪造完成', () => {
  const data = seeded(8, 5)
  const account = api()
  const before = structuredClone(data)
  const badTaps = [null, undefined, [], 'cell', { cell: '0' }, { cell: -1 }, { cell: 25 }, { cell: 1.5 }, { cell: 0, mode: 'clear' }, { cell: 0, done: true }, { cell: 0, pigs: [0] }, { cell: 0, mode: 'pig', solution: [0] }]
  for (const payload of badTaps) assert.equal(puzzle.actions.tap(data, payload, account).ok, false, JSON.stringify(payload))
  const badDrags = [null, {}, { cells: [] }, { cells: '0,1' }, { cells: [0, 0] }, { cells: [25] }, { cells: [0], mode: 'clear' }, { cells: [0], solved: true }]
  for (const payload of badDrags) assert.equal(puzzle.actions.drag(data, payload, account).ok, false, JSON.stringify(payload))
  for (const payload of [{ extra: 1 }, { cells: [] }, null]) {
    assert.equal(puzzle.actions.undo(data, payload, account).ok, false)
    assert.equal(puzzle.actions.restart(data, payload, account).ok, false)
    assert.equal(puzzle.actions.hint(data, payload, account).ok, false)
  }
  assert.equal(puzzle.actions.new(data, { done: true }, account).ok, false)
  assert.deepEqual(data, before)
  puzzle.actions.tap(data, { cell: 7, mode: 'pig' }, account)
  assert.equal(puzzle.view({ ...structuredClone(data), done: true }, account).done, false)
  assert.equal(puzzle.view({ ...structuredClone(data), completed: true }, account).done, false)
})

test('提示只解释不落猪；给的格子与唯一解一致，跟着提示能推完', () => {
  for (const size of [4, 5, 6]) {
    const data = seeded(2026 + size, size)
    const account = api()
    const solution = solutionOf(data.puzzle)
    let steps = 0
    while (!puzzle.view(data, account).done && steps < 100) {
      steps += 1
      const placedBefore = puzzle.view(data, account).placed
      assert.equal(puzzle.actions.hint(data, {}, account).ok, true)
      const view = puzzle.view(data, account)
      assert.equal(view.placed, placedBefore, '提示不能自动落猪')
      const hint = view.hint
      assert.ok(hint && typeof hint.text === 'string' && hint.text.length > 0)
      if (hint.kind === 'place') {
        assert.ok(solution.includes(hint.cell), '提示说放猪的格子必须属于唯一解')
        const mark = view.cells[hint.cell].mark
        assert.notEqual(mark, 'pig')
        assert.equal(puzzle.actions.tap(data, { cell: hint.cell, mode: 'pig' }, account).ok, true)
      } else if (hint.kind === 'exclude') {
        assert.equal(solution.includes(hint.cell), false, '提示说排除的格子不能属于唯一解')
        const mark = view.cells[hint.cell].mark
        if (mark !== 'excluded') assert.equal(puzzle.actions.tap(data, { cell: hint.cell, mode: 'exclude' }, account).ok, true)
      } else {
        assert.ok(hint.kind === 'conflict' || hint.kind === 'none')
        assert.equal(hint.cell, null)
        break
      }
    }
    assert.equal(puzzle.view(data, account).done, true, size + '×' + size + ' 跟着提示应该能完成')
    assert.ok(steps <= 100)
  }
})

test('提示遇到冲突只说冲突；无解盘面不会把答案当提示', () => {
  const data = seeded(99, 4)
  const account = api()
  const solution = solutionOf(data.puzzle)
  // 模拟旧版本留下的冲突盘面：迁移/读取时原样保留，不用答案过滤。
  const row = Math.floor(solution[0] / 4)
  const wrong = row * 4 + ((solution[0] % 4) + 1) % 4
  data.board.pigs = [solution[0], wrong]
  assert.ok(conflictsOf(data.puzzle, pigsOf(data)).length > 0)
  assert.equal(puzzle.actions.hint(data, {}, account).ok, true)
  const hint = puzzle.view(data, account).hint
  assert.equal(hint.kind, 'conflict')
  assert.equal(hint.cell, null)
  assert.match(hint.text, /行|列|区|挨着/)

  const level = { size: 3, region: [0, 1, 2, 0, 1, 2, 0, 1, 2] }
  const reverse = hintFor(level, [], [])
  assert.equal(reverse.kind, 'exclude')
  assert.equal(reverse.cell, 1)
  assert.match(reverse.text, /排除/)
})

test('持久化：刷新后题目、盘面、步数和记录都在；view 不改传入 data', () => {
  const data = seeded(31415, 6)
  const account = api()
  const solution = solutionOf(data.puzzle)
  puzzle.actions.tap(data, { cell: solution[0], mode: 'pig' }, account)
  puzzle.actions.tap(data, { cell: solution[1], mode: 'exclude' }, account)
  puzzle.actions.drag(data, { cells: [8, 9, 14], mode: 'exclude' }, account)
  puzzle.actions.hint(data, {}, account)
  const snapshot = JSON.parse(JSON.stringify(data))
  const first = puzzle.view(data, account)
  const second = puzzle.view(snapshot, account)
  assert.deepEqual(second.level, first.level)
  assert.deepEqual(second.cells, first.cells)
  assert.equal(second.moves, first.moves)
  assert.equal(second.hint?.text, first.hint?.text)
  assert.equal(second.canUndo, true)
  // 刷新后还能继续撤销
  assert.equal(puzzle.actions.undo(snapshot, {}, account).ok, true)
  const before = structuredClone(data)
  puzzle.view(data, account)
  assert.deepEqual(data, before)
})

test('旧 0.1 data 非破坏迁移：旧盘面/记录进 legacy，通关记录继续显示', () => {
  const old = {
    current: 2,
    boards: {
      '1': { pigs: [1, 7, 8, 14], excluded: [0], undo: [], moves: 6, done: true, doneAt: 111 },
      '2': { pigs: [3], excluded: [], undo: [], moves: 1, done: false, doneAt: null },
    },
    records: [{ level: 1, at: 111, moves: 6 }, { level: 5, at: 222, moves: 18 }],
    hint: { kind: 'place', cell: 3, text: '旧提示' },
  }
  const original = structuredClone(old)
  assert.equal(puzzle.view(old, api()).level.size, 5, 'view 在副本上迁移')
  assert.deepEqual(old, original, 'view 不能改旧 data')

  const data = structuredClone(old)
  const account = api()
  const migratedSolution = solutionOf(makePuzzle(1, 5))
  assert.equal(puzzle.actions.tap(data, { cell: migratedSolution[0], mode: 'pig' }, account).ok, true)
  assert.equal(data.board.lives, 3, '旧 0.1 盘面迁移后补满 3 次机会')
  assert.deepEqual(data.legacy.current, original.current)
  assert.deepEqual(data.legacy.boards, original.boards)
  assert.deepEqual(data.legacy.records, original.records)
  assert.deepEqual(data.legacy.hint, original.hint)
  assert.equal('current' in data, false)
  assert.equal('boards' in data, false)
  assert.equal('hint' in data, false, '旧提示不跟到新题')
  assert.equal(data.records.length, 2)
  assert.deepEqual(data.records.map(record => record.title), ['旧关卡 1', '旧关卡 5'])
  assert.deepEqual(data.records.map(record => record.at), [111, 222])
  assert.deepEqual(data.records.map(record => record.moves), [6, 18])
  assert.equal(data.records.every(record => record.legacy === true), true)
  const view = puzzle.view(data, account)
  assert.equal(view.solved, 2)
  assert.match(view.records[0].title, /旧关卡/)
  assert.equal(view.placed, 1, '迁移后的新题只保留迁移后点的这一格')
  assert.equal(view.cells.filter(cell => cell.mark !== 'empty').length, 1)
})

test('旧 data 只有记录也保留；空 data 补出可玩的新题', () => {
  const onlyRecords = { records: [{ level: 3, at: 333, moves: 11 }] }
  const data = structuredClone(onlyRecords)
  const account = api()
  assert.equal(puzzle.actions.restart(data, {}, account).ok, true)
  assert.deepEqual(data.legacy.records, onlyRecords.records)
  assert.equal(data.records[0].title, '旧关卡 3')
  assert.ok(data.puzzle)

  const empty = {}
  const view = puzzle.view(empty, account)
  assert.equal(empty.puzzle, undefined, 'view 不往调用者的空对象里塞东西')
  assert.equal(view.cells.length, 25)
  assert.equal(view.placed, 0)
  assert.equal(view.cells.every(cell => cell.mark === 'empty'), true)
})

test('每关开局零标记；点格子不会被答案或提示自动揭晓', () => {
  const data = seeded(2718, 5)
  const account = api()
  const solution = solutionOf(data.puzzle)
  assert.equal(puzzle.view(data, account).cells.every(cell => cell.mark === 'empty'), true)
  // 点一个非解格：放错被拒绝，盘面不落错猪，也不自动补别的猪。
  const wrong = data.puzzle.region.map((value, cell) => cell).find(cell => !solution.includes(cell))
  const wrongResult = puzzle.actions.tap(data, { cell: wrong, mode: 'pig' }, account)
  assert.equal(wrongResult.ok, true)
  assert.equal(wrongResult.wrong, true)
  let view = puzzle.view(data, account)
  assert.equal(view.placed, 0)
  assert.equal(view.cells[wrong].mark, 'empty')
  assert.equal(view.cells.filter(cell => cell.mark === 'pig').length, 0)
  assert.equal(view.lives, 2)
  // 再点一个解格：只落这一只，不自动补其他解格。
  puzzle.actions.tap(data, { cell: solution[0], mode: 'pig' }, account)
  view = puzzle.view(data, account)
  assert.equal(view.placed, 1)
  assert.equal(view.cells[solution[0]].mark, 'pig')
  assert.equal(view.cells.filter(cell => cell.mark === 'pig').length, 1)
  // 问提示后也只多一条文字/一个高亮，不落猪
  const placed = view.placed
  puzzle.actions.hint(data, {}, account)
  view = puzzle.view(data, account)
  assert.equal(view.placed, placed)
  assert.equal(view.cells.filter(cell => cell.mark === 'pig').length, placed)
})

test('三条命：放错扣 1 且不落猪，放对/排除不扣，反馈只留一格并递增', () => {
  const data = seeded(303, 5)
  const account = api()
  const level = data.puzzle
  const solution = solutionOf(level)
  const free = level.region.map((value, cell) => cell).filter(cell => !solution.includes(cell))
  let view = puzzle.view(data, account)
  assert.equal(view.lives, 3)
  assert.equal(view.maxLives, 3)
  assert.equal(view.locked, false)
  assert.equal(view.feedback, null)
  assert.doesNotMatch(JSON.stringify(view), /"solution"/)

  puzzle.actions.hint(data, {}, account)
  assert.ok(data.hint)
  const wrong = puzzle.actions.tap(data, { cell: free[0], mode: 'pig' }, account)
  assert.deepEqual(wrong, { ok: true, wrong: true, lives: 2, locked: false })
  assert.equal('hint' in data, false, '放错会清掉旧提示')
  view = puzzle.view(data, account)
  assert.equal(view.placed, 0)
  assert.equal(view.cells[free[0]].mark, 'empty', '错猪不留在盘上')
  assert.equal(view.moves, 0)
  assert.equal(view.canUndo, false)
  assert.equal(view.lives, 2)
  assert.equal(view.feedback.seq, 1)
  assert.equal(view.feedback.kind, 'wrong')
  assert.deepEqual(view.feedback.cells, [free[0]])
  assert.equal(view.feedback.at, account.now)
  assert.doesNotMatch(JSON.stringify(view), /"solution"/)

  puzzle.actions.tap(data, { cell: free[1], mode: 'pig' }, account)
  view = puzzle.view(data, account)
  assert.equal(view.lives, 1)
  assert.equal(view.feedback.seq, 2)
  assert.deepEqual(view.feedback.cells, [free[1]], '反馈只记录本次第一个错格')

  // 排除正确解格和错误格都不扣机会。
  assert.equal(puzzle.actions.tap(data, { cell: solution[0], mode: 'exclude' }, account).ok, true)
  assert.equal(puzzle.actions.tap(data, { cell: free[2], mode: 'exclude' }, account).ok, true)
  view = puzzle.view(data, account)
  assert.equal(view.lives, 1)
  assert.equal(view.cells[solution[0]].mark, 'excluded')
  assert.equal(view.cells[free[2]].mark, 'excluded')
  assert.equal(view.feedback, null, '成功的盘面动作会清掉旧错误反馈')

  // 把排除格改成正确猪也不扣机会。
  assert.equal(puzzle.actions.tap(data, { cell: solution[0], mode: 'pig' }, account).ok, true)
  view = puzzle.view(data, account)
  assert.equal(view.lives, 1)
  assert.equal(view.cells[solution[0]].mark, 'pig')
})

test('第三次放错锁定同题：不自动重开，板面不动，重试同题/换新题都恢复 3 条命并保留记录', () => {
  const data = seeded(404, 4)
  const account = api()
  const level = data.puzzle
  const solution = solutionOf(level)
  const free = level.region.map((value, cell) => cell).filter(cell => !solution.includes(cell))
  data.records = [{ title: '旧记录', size: 4, seed: 1, at: 100, moves: 3, legacy: false }]
  assert.equal(puzzle.actions.tap(data, { cell: solution[0], mode: 'pig' }, account).ok, true)
  const seed = data.seed
  const region = data.puzzle.region.slice()
  for (let index = 0; index < 3; index += 1) {
    assert.equal(puzzle.actions.tap(data, { cell: free[index], mode: 'pig' }, account).ok, true)
  }
  let view = puzzle.view(data, account)
  assert.equal(view.lives, 0)
  assert.equal(view.locked, true)
  assert.equal(view.done, false)
  assert.equal(view.placed, 1, '锁定不自动重开，之前的正确猪还在')
  assert.equal(view.moves, 1)
  assert.equal(view.feedback.kind, 'locked')
  assert.deepEqual(view.feedback.cells, [free[2]])
  assert.equal(data.seed, seed, '锁定不换题')
  assert.deepEqual(data.puzzle.region, region, '锁定不换区划')
  assert.equal(data.records.length, 1, '锁定不写失败记录')

  const locked = structuredClone(data)
  assert.deepEqual(puzzle.actions.tap(data, { cell: solution[1], mode: 'pig' }, account), { ok: false, reason: 'locked' })
  assert.deepEqual(puzzle.actions.drag(data, { cells: [solution[1]], mode: 'pig' }, account), { ok: false, reason: 'locked' })
  assert.deepEqual(puzzle.actions.undo(data, {}, account), { ok: false, reason: 'locked' })
  assert.deepEqual(puzzle.actions.hint(data, {}, account), { ok: false, reason: 'locked' })
  assert.deepEqual(data, locked, '锁定状态下服务端不再改盘面')

  // 重试同一道题：seed/区划/记录不变，盘面清空，机会回满。
  assert.equal(puzzle.actions.restart(data, {}, account).ok, true)
  view = puzzle.view(data, account)
  assert.equal(data.seed, seed)
  assert.deepEqual(data.puzzle.region, region)
  assert.equal(view.locked, false)
  assert.equal(view.lives, 3)
  assert.equal(view.placed, 0)
  assert.equal(view.feedback, null)
  assert.equal(data.records.length, 1)

  // 换新题：seed 变，记录仍保留，机会回满。
  assert.equal(puzzle.actions.new(data, {}, account, () => 0.424242).ok, true)
  view = puzzle.view(data, account)
  assert.notEqual(data.seed, seed)
  assert.equal(view.lives, 3)
  assert.equal(view.locked, false)
  assert.equal(view.placed, 0)
  assert.equal(data.records.length, 1)
})

test('撤销不返还机会：放错后的命数不会因为撤销回来', () => {
  const data = seeded(505, 4)
  const account = api()
  const level = data.puzzle
  const solution = solutionOf(level)
  const free = level.region.map((value, cell) => cell).filter(cell => !solution.includes(cell))
  assert.equal(puzzle.actions.tap(data, { cell: free[0], mode: 'pig' }, account).ok, true)
  assert.equal(puzzle.view(data, account).lives, 2)
  assert.equal(puzzle.actions.tap(data, { cell: solution[0], mode: 'pig' }, account).ok, true)
  assert.equal(puzzle.view(data, account).moves, 1)
  assert.equal(puzzle.view(data, account).canUndo, true)
  assert.equal(puzzle.actions.undo(data, {}, account).ok, true)
  let view = puzzle.view(data, account)
  assert.equal(view.lives, 2, '撤销不返还放错失去的机会')
  assert.equal(view.placed, 0)
  assert.equal(view.moves, 0)
  // 再次放对后放错，再撤销：仍然只回到 2 条命，不会回到 3。
  assert.equal(puzzle.actions.tap(data, { cell: solution[0], mode: 'pig' }, account).ok, true)
  assert.equal(puzzle.actions.tap(data, { cell: free[1], mode: 'pig' }, account).ok, true)
  assert.equal(puzzle.view(data, account).lives, 1)
  assert.equal(puzzle.actions.undo(data, {}, account).ok, true)
  view = puzzle.view(data, account)
  assert.equal(view.lives, 1)
  assert.equal(view.placed, 0)
})

test('拖动整组原子：含错格整组不落、只扣 1 条命、只报第一个错格，不部分应用', () => {
  const data = seeded(606, 5)
  const account = api()
  const level = data.puzzle
  const solution = solutionOf(level)
  const free = level.region.map((value, cell) => cell).filter(cell => !solution.includes(cell))
  const payload = [solution[0], free[0], solution[1], free[1]]
  const before = structuredClone(data)
  const result = puzzle.actions.drag(data, { cells: payload, mode: 'pig' }, account)
  assert.deepEqual(result, { ok: true, wrong: true, lives: 2, locked: false })
  assert.equal(puzzle.view(data, account).placed, 0, '不应用部分正确子集')
  assert.equal(data.board.moves, before.board.moves)
  assert.equal(data.board.undo.length, before.board.undo.length)
  let view = puzzle.view(data, account)
  assert.equal(view.lives, 2, '一次拖动只扣 1 条命')
  assert.equal(view.feedback.kind, 'wrong')
  assert.deepEqual(view.feedback.cells, [free[0]], '只报本组第一个错格，不摊开整组')
  assert.doesNotMatch(JSON.stringify(view), /"solution"/)

  // 全对的一组照常落下，整组只占一格撤销。
  assert.equal(puzzle.actions.drag(data, { cells: [solution[0], solution[1]], mode: 'pig' }, account).ok, true)
  view = puzzle.view(data, account)
  assert.deepEqual([solution[0], solution[1]].map(cell => view.cells[cell].mark), ['pig', 'pig'])
  assert.equal(view.moves, 1)
  assert.equal(view.canUndo, true)
  assert.equal(view.lives, 2)
  assert.equal(puzzle.actions.undo(data, {}, account).ok, true)
  view = puzzle.view(data, account)
  assert.deepEqual([solution[0], solution[1]].map(cell => view.cells[cell].mark), ['empty', 'empty'])
  assert.equal(view.lives, 2, '撤销整组也不返还机会')

  // 两个错格仍然只扣 1 条命，并按传输顺序只报第一个。
  const second = seeded(607, 5)
  const secondSolution = solutionOf(second.puzzle)
  const secondFree = second.puzzle.region.map((value, cell) => cell).filter(cell => !secondSolution.includes(cell))
  assert.equal(puzzle.actions.drag(second, { cells: [secondFree[1], secondFree[0]], mode: 'pig' }, account).ok, true)
  assert.equal(puzzle.view(second, account).lives, 2)
  assert.deepEqual(puzzle.view(second, account).feedback.cells, [secondFree[1]])
})

test('v2 迁移保留 seed/记录/旧盘面/撤销栈：不按答案过滤旧错猪，只补三条命', () => {
  const level = makePuzzle(707, 5)
  const solution = solutionOf(level)
  const free = level.region.map((value, cell) => cell).filter(cell => !solution.includes(cell))
  const v2 = {
    v: 2,
    seed: level.seed,
    size: level.size,
    puzzle: { ...level },
    board: {
      pigs: [solution[0], free[0]],
      excluded: [free[1]],
      undo: [{ pigs: [solution[0]], excluded: [], moves: 1 }],
      moves: 2,
      done: false,
      doneAt: null,
    },
    records: [{ title: level.title, size: level.size, seed: level.seed, at: 123, moves: 9, legacy: false }],
    hint: { kind: 'place', cell: solution[1], text: '旧提示', seed: level.seed },
  }
  const original = structuredClone(v2)
  const account = api()
  const view = puzzle.view(v2, account)
  assert.deepEqual(v2, original, 'view 不改旧 data')
  assert.equal(view.lives, 3)
  assert.equal(view.maxLives, 3)
  assert.equal(view.locked, false)
  assert.equal(view.placed, 2)
  assert.equal(view.cells[free[0]].mark, 'pig', '旧错猪不按答案过滤')
  assert.equal(view.solved, 1)
  assert.doesNotMatch(JSON.stringify(view), /"solution"/)

  const data = structuredClone(v2)
  assert.equal(puzzle.actions.tap(data, { cell: free[2], mode: 'exclude' }, account).ok, true)
  assert.equal(data.v, 3)
  assert.equal(data.seed, level.seed)
  assert.deepEqual(data.puzzle.region, level.region)
  assert.equal(data.records.length, 1)
  assert.deepEqual(data.board.pigs, [solution[0], free[0]].sort((a, b) => a - b))
  assert.equal(data.board.excluded.includes(free[2]), true)
  assert.equal(data.board.lives, 3)
  assert.equal(data.board.undo.length, 2, '旧撤销栈保留，新动作再压一组')
  assert.deepEqual(data.board.undo[0], { pigs: [solution[0]], excluded: [], moves: 1 })
  assert.equal('solution' in data, false)
  assert.doesNotMatch(JSON.stringify(data), /"solution"/)
})
