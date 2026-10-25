// 藏猪方块 0.2.6 客户端：三条命/红叉、锁定重试、规则子页、左键/右键/触屏/拖动/键盘/刷新。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import puzzle, { makePuzzle } from '../extensions/pig-puzzle/server.js'
import { api, bruteSolutions, fresh, mount, pending, plain } from './helpers/pig-puzzle.js'

function seeded(seed = 13579, size = 5) {
  const data = fresh()
  data.puzzle = makePuzzle(seed, size)
  data.seed = data.puzzle.seed
  data.size = data.puzzle.size
  data.board = { pigs: [], excluded: [], undo: [], moves: 0, lives: 3, done: false, doneAt: null }
  data.records = []
  return data
}

const solutionOf = level => {
  const solutions = bruteSolutions(level)
  assert.equal(solutions.length, 1)
  return solutions[0]
}

test('客户端：开局没有任何猪/排除/给定，尺寸和标记模式都能选', () => {
  const data = seeded(101, 5)
  const account = api()
  const m = mount(data, account)
  assert.equal(m.all('data-cell').length, 25)
  assert.equal(m.all('data-puzzle-cell').length, 25)
  assert.equal(m.all('data-cell').every(node => node.getAttribute('data-mark') === 'empty'), true)
  assert.equal(m.all('data-cell').some(node => node.getAttribute('data-given') === 'true'), false)
  assert.match(m.text(), /已放 0 \/ 5/)
  assert.match(m.text(), /机会 3 \/ 3/)
  assert.doesNotMatch(m.text(), /左键放猪 · 右键排除 · 新一局换题/, '顶部不再重复规则说明')
  assert.doesNotMatch(m.text(), /新一局换题/)
  assert.equal(m.all('data-size').length, 3)
  assert.equal(m.find('data-size', '5').getAttribute('data-on'), 'true')
  assert.equal(m.all('data-mode').length, 2)
  assert.equal(m.find('data-mode', 'pig').getAttribute('aria-pressed'), 'true')
  assert.equal(m.find('data-mode', 'exclude').getAttribute('aria-pressed'), 'false')
  assert.ok(m.find('aria-label', '触屏/键盘标记'))
})

test('客户端：左键放猪/清除，右键排除/清除，动作带明确模式', () => {
  const data = seeded(102, 4)
  const account = api()
  const solution = solutionOf(data.puzzle)
  const cell = solution[0]
  const m = mount(data, account)
  m.leftClick(cell)
  assert.equal(puzzle.view(data, account).cells[cell].mark, 'pig')
  assert.deepEqual(plain(m.sent.at(-1)), { op: 'tap', payload: { cell, mode: 'pig' } })
  m.rightClick(5)
  assert.deepEqual(plain(m.sent.at(-1)), { op: 'tap', payload: { cell: 5, mode: 'exclude' } })
  assert.equal(puzzle.view(data, account).cells[5].mark, 'excluded')
  // 再右键一次清除排除
  m.rightClick(5)
  assert.equal(puzzle.view(data, account).cells[5].mark, 'empty')
  // 左键再点猪清除
  m.leftClick(cell)
  assert.equal(puzzle.view(data, account).cells[cell].mark, 'empty')
  // 左键点排除格会转成猪（用解格，避免触发放错）
  m.rightClick(solution[1])
  m.leftClick(solution[1])
  assert.equal(puzzle.view(data, account).cells[solution[1]].mark, 'pig')
  assert.equal(puzzle.view(data, account).lives, 3)
  // 右键点猪是无操作，不发动作，猪还在
  const before = m.sent.length
  m.find('data-cell', String(solution[1])).fire('pointerdown', { button: 2, pointerType: 'mouse' })
  m.find('data-cell', String(solution[1])).fire('pointerup')
  assert.equal(m.sent.length, before)
  assert.equal(puzzle.view(data, account).cells[solution[1]].mark, 'pig')
  // 棋盘右键菜单被拦下
  let prevented = false
  m.find('data-cell', String(cell)).parentNode.fire('contextmenu', { preventDefault() { prevented = true } })
  assert.equal(prevented, true)
})

test('客户端：触屏先选放猪/排除，再点格子；鼠标左右键不受模式影响', () => {
  const data = seeded(103, 4)
  const account = api()
  const solution = solutionOf(data.puzzle)
  const m = mount(data, account)
  m.find('data-mode', 'exclude').fire('click')
  assert.equal(m.find('data-mode', 'exclude').getAttribute('aria-pressed'), 'true')
  m.touchClick(3)
  assert.deepEqual(plain(m.sent.at(-1)), { op: 'tap', payload: { cell: 3, mode: 'exclude' } })
  assert.equal(puzzle.view(data, account).cells[3].mark, 'excluded')
  m.touchClick(3)
  assert.equal(puzzle.view(data, account).cells[3].mark, 'empty')
  // 切回放猪，触屏放猪（用解格）
  m.find('data-mode', 'pig').fire('click')
  m.touchClick(solution[0])
  assert.deepEqual(plain(m.sent.at(-1)), { op: 'tap', payload: { cell: solution[0], mode: 'pig' } })
  assert.equal(puzzle.view(data, account).cells[solution[0]].mark, 'pig')
  // 即使触屏模式是排除，鼠标左键仍然是放猪
  m.find('data-mode', 'exclude').fire('click')
  m.leftClick(solution[1])
  assert.deepEqual(plain(m.sent.at(-1)), { op: 'tap', payload: { cell: solution[1], mode: 'pig' } })
  assert.equal(puzzle.view(data, account).cells[solution[1]].mark, 'pig')
  assert.equal(puzzle.view(data, account).lives, 3)
})

test('客户端：左拖放猪、右拖排除、整组一次撤销；拖动后的合成点击只吞一次', () => {
  const data = seeded(104, 5)
  const account = api()
  const solution = solutionOf(data.puzzle)
  const free = data.puzzle.region.map((value, cell) => cell).filter(cell => !solution.includes(cell))
  const pigCells = solution.slice(0, 3)
  const m = mount(data, account)
  m.find('data-cell', String(pigCells[0])).fire('pointerdown', { button: 0, pointerType: 'mouse' })
  m.find('data-cell', String(pigCells[1])).fire('pointerenter')
  m.find('data-cell', String(pigCells[2])).fire('pointerenter')
  m.find('data-cell', String(pigCells[2])).fire('pointerup')
  assert.deepEqual(plain(m.sent), [{ op: 'drag', payload: { cells: pigCells, mode: 'pig' } }])
  // 浏览器补发的 click 在重绘前到达，只吞一次
  m.find('data-cell', String(pigCells[0])).fire('click', { detail: 1 })
  assert.equal(m.sent.length, 1)
  m.applyLast()
  assert.deepEqual(pigCells.map(cell => puzzle.view(data, account).cells[cell].mark), ['pig', 'pig', 'pig'])
  m.sent.length = 0
  m.find('data-cell', String(solution[3])).fire('click', { detail: 0 })
  assert.deepEqual(plain(m.sent.at(-1)), { op: 'tap', payload: { cell: solution[3], mode: 'pig' } }, '键盘激活不能被旧拖动吞掉')
  m.applyLast()
  m.sent.length = 0
  // 右拖排除
  const excludeCells = free.slice(0, 2)
  m.find('data-cell', String(excludeCells[0])).fire('pointerdown', { button: 2, pointerType: 'mouse' })
  m.find('data-cell', String(excludeCells[1])).fire('pointerenter')
  m.find('data-cell', String(excludeCells[1])).fire('pointerup')
  assert.deepEqual(plain(m.sent), [{ op: 'drag', payload: { cells: excludeCells, mode: 'exclude' } }])
  m.applyLast()
  assert.deepEqual(excludeCells.map(cell => puzzle.view(data, account).cells[cell].mark), ['excluded', 'excluded'])
  // 撤销一次整组排除
  m.find('data-op', 'undo').fire('click')
  m.applyLast()
  assert.deepEqual(excludeCells.map(cell => puzzle.view(data, account).cells[cell].mark), ['empty', 'empty'])
  assert.deepEqual(pigCells.map(cell => puzzle.view(data, account).cells[cell].mark), ['pig', 'pig', 'pig'], '撤销只退这一组')
  assert.equal(puzzle.view(data, account).lives, 3)
})

test('客户端：丢失松手/取消/失焦/页面隐藏会清 pending，后续无关松手不补交', () => {
  const start = m => {
    m.find('data-cell', '0').fire('pointerdown', { button: 0 })
    m.find('data-cell', '2').fire('pointerenter')
    assert.equal(pending(m, 0), 'true')
    assert.equal(pending(m, 2), 'true')
  }
  const lost = (m, trigger) => {
    start(m)
    trigger(m)
    assert.equal(pending(m, 0), null)
    assert.equal(pending(m, 2), null)
    m.fireDocument('pointerup')
    assert.deepEqual(plain(m.sent), [])
  }
  lost(mount(seeded(105), api()), m => m.fireDocument('pointercancel'))
  lost(mount(seeded(106), api()), m => m.fireWindow('blur'))
  lost(mount(seeded(107), api()), m => {
    m.dom.document.hidden = true
    m.fireDocument('visibilitychange')
    m.dom.document.hidden = false
  })
  const m = mount(seeded(108), api())
  start(m)
  m.fireDocument('pointerup', { target: m.find('data-op', 'undo') })
  assert.deepEqual(plain(m.sent), [])
  assert.equal(pending(m, 0), null)
  // 新一次按下先清旧 pending，新组只发自己的格子
  m.find('data-cell', '4').fire('pointerdown', { button: 0 })
  assert.equal(pending(m, 0), null)
  m.find('data-cell', '5').fire('pointerenter')
  m.find('data-cell', '5').fire('pointerup')
  assert.deepEqual(plain(m.sent), [{ op: 'drag', payload: { cells: [4, 5], mode: 'pig' } }])
})

test('客户端：键盘方向键/Home/End 移动焦点，Enter/Space 用当前模式，X 排除，Delete 清除', () => {
  const data = seeded(109, 4)
  const account = api()
  const solution = solutionOf(data.puzzle)
  const m = mount(data, account)
  const board = m.find('data-cell', '0').parentNode
  const key = (name, target) => board.fire('keydown', { key: name, target, preventDefault() {} })
  key('ArrowRight', m.find('data-cell', '0'))
  assert.equal(m.dom.document.activeElement, m.find('data-cell', '1'))
  key('ArrowDown', m.find('data-cell', '1'))
  assert.equal(m.dom.document.activeElement, m.find('data-cell', '5'))
  key('End', m.find('data-cell', '5'))
  assert.equal(m.dom.document.activeElement, m.find('data-cell', '7'))
  key('Home', m.find('data-cell', '7'))
  assert.equal(m.dom.document.activeElement, m.find('data-cell', '4'))
  // 键盘 Enter 走 click detail=0，用当前模式
  m.find('data-mode', 'exclude').fire('click')
  m.find('data-cell', '4').fire('click', { detail: 0 })
  assert.deepEqual(plain(m.sent.at(-1)), { op: 'tap', payload: { cell: 4, mode: 'exclude' } })
  m.applyLast()
  assert.equal(puzzle.view(data, account).cells[4].mark, 'excluded')
  // X 键总是排除；再按一次清除
  key('x', m.find('data-cell', '4'))
  assert.deepEqual(plain(m.sent.at(-1)), { op: 'tap', payload: { cell: 4, mode: 'exclude' } })
  m.applyLast()
  assert.equal(puzzle.view(data, account).cells[4].mark, 'empty')
  // 放猪后 Delete 清除（用解格，确保放猪成功）
  const pigCell = solution[0]
  m.find('data-mode', 'pig').fire('click')
  m.find('data-cell', String(pigCell)).fire('click', { detail: 0 })
  m.applyLast()
  assert.equal(puzzle.view(data, account).cells[pigCell].mark, 'pig')
  key('Delete', m.find('data-cell', String(pigCell)))
  // 重绘后键盘事件落在新棋盘上，用当前节点再按
  m.find('data-cell', String(pigCell)).parentNode.fire('keydown', { key: 'Delete', target: m.find('data-cell', String(pigCell)), preventDefault() {} })
  assert.deepEqual(plain(m.sent.at(-1)), { op: 'tap', payload: { cell: pigCell, mode: 'pig' } })
  m.applyLast()
  assert.equal(puzzle.view(data, account).cells[pigCell].mark, 'empty')
  assert.equal(puzzle.view(data, account).lives, 3)
})

test('客户端：提示只显示理由和高亮，不自动落猪；规则是独立子页，返回不丢盘面', () => {
  const data = seeded(110, 5)
  const account = api()
  const m = mount(data, account)
  assert.equal(puzzle.view(data, account).placed, 0)
  m.find('data-op', 'hint').fire('click')
  assert.deepEqual(plain(m.sent.at(-1)), { op: 'hint', payload: {} })
  m.applyLast()
  const view = puzzle.view(data, account)
  assert.ok(view.hint)
  assert.equal(view.placed, 0, '提示不能自动落猪')
  assert.equal(view.cells.filter(cell => cell.mark === 'pig').length, 0)
  assert.match(m.text(), new RegExp(view.hint.text.slice(0, 6)))
  assert.equal(m.find('data-cell', String(view.hint.cell)).getAttribute('data-hint'), 'true')

  const beforeData = JSON.stringify(data)
  const beforeSent = m.sent.length
  m.find('data-op', 'rules').fire('click')
  assert.equal(m.sent.length, beforeSent, '规则页不产生服务端动作')
  assert.equal(JSON.stringify(data), beforeData, '规则页不改盘面/记录/命数')
  assert.equal(m.all('data-cell').length, 0, '规则页没有棋盘')
  assert.equal(m.all('data-puzzle-cell').length, 0)
  assert.equal(m.find('data-op', 'hint'), undefined)
  assert.equal(m.find('data-op', 'restart'), undefined)
  assert.match(m.text(), /每局 3 次机会/)
  assert.match(m.text(), /排除不扣机会；撤销不返还机会/)
  assert.match(m.text(), /再试这道/)
  assert.ok(m.find('data-op', 'rules-back'))
  assert.equal(m.dom.document.activeElement && m.dom.document.activeElement.getAttribute('tabindex'), '-1',
    '打开规则页时焦点落到规则标题')
  let region = null
  m.dom.body.walk(node => { if (node.getAttribute('role') === 'region') region = node })
  assert.ok(region, '规则卡片是命名的 region')
  assert.equal(region.getAttribute('aria-labelledby'), 'pz-rules-title')

  m.find('data-op', 'rules-back').fire('click')
  assert.equal(m.all('data-cell').length, 25, '返回后棋盘和盘面都在')
  assert.equal(m.dom.document.activeElement, m.find('data-op', 'rules'), '返回后焦点回到规则按钮')

  // Escape 也能返回，且同样把焦点还给规则按钮。
  m.find('data-op', 'rules').fire('click')
  const root = m.dom.body.children[0]
  root.fire('keydown', { key: 'Escape', preventDefault() {} })
  assert.equal(m.all('data-cell').length, 25)
  assert.equal(m.dom.document.activeElement, m.find('data-op', 'rules'))
})

test('客户端：新一局换 seed，重开保留同题，换尺寸开新题；刷新后盘面/命数还在', () => {
  const data = seeded(111, 5)
  const account = api()
  const solution = solutionOf(data.puzzle)
  const free = data.puzzle.region.map((value, cell) => cell).filter(cell => !solution.includes(cell))
  const m = mount(data, account)
  const seed = data.seed
  const region = data.puzzle.region.slice()
  m.leftClick(solution[0])
  m.rightClick(free[0])
  m.leftClick(free[1])
  assert.equal(puzzle.view(data, account).lives, 2)
  const snapshot = JSON.parse(JSON.stringify(data))
  m.find('data-op', 'restart').fire('click')
  m.applyLast()
  assert.equal(data.seed, seed)
  assert.deepEqual(data.puzzle.region, region)
  assert.equal(puzzle.view(data, account).placed, 0)
  assert.equal(puzzle.view(data, account).lives, 3, '重开恢复 3 次机会')
  // 刷新：同一个磁盘数据重新挂载，猪/排除/步数/命数都在，旧红叉不复活。
  const reloaded = mount(snapshot, account)
  const reloadedView = puzzle.view(snapshot, account)
  assert.equal(reloadedView.cells[solution[0]].mark, 'pig')
  assert.equal(reloadedView.cells[free[0]].mark, 'excluded')
  assert.equal(reloadedView.lives, 2)
  assert.match(reloaded.text(), /已放 1 \/ 5/)
  assert.match(reloaded.text(), /机会 2 \/ 3/)
  assert.equal(reloaded.find('data-cell', String(free[1])).children.some(child => child.className.indexOf('pz-wrong') === 0), false,
    '刷新不重播已经发生过的错误')
  // 新一局
  m.find('data-op', 'new').fire('click')
  m.applyLast()
  assert.notEqual(data.seed, seed)
  assert.equal(puzzle.view(data, account).placed, 0)
  assert.equal(puzzle.view(data, account).lives, 3)
  // 换尺寸
  m.find('data-size', '6').fire('click')
  assert.deepEqual(plain(m.sent.at(-1)), { op: 'new', payload: { size: 6 } })
  m.applyLast()
  assert.equal(data.size, 6)
  assert.equal(data.records.length, 0)
  assert.equal(m.all('data-cell').length, 36)
  assert.match(m.text(), /6×6/)
})

test('客户端：完成态显示战绩和「没有金币奖励」，不再展示最近通关块，再来一局/重开都发对应动作', () => {
  const data = seeded(112, 4)
  const account = api()
  const m = mount(data, account)
  for (const cell of solutionOf(data.puzzle)) m.leftClick(cell)
  assert.equal(puzzle.view(data, account).done, true)
  assert.match(m.text(), /藏好了/)
  assert.match(m.text(), /没有金币奖励/)
  assert.match(m.text(), /已通关 1 局/)
  assert.doesNotMatch(m.text(), /最近通关/)
  let recordsNode = null
  m.dom.body.walk(node => { if (node.className === 'pz-records') recordsNode = node })
  assert.equal(recordsNode, null, '最近通关块不再占用棋盘下方的位置')
  assert.equal(m.find('data-op', 'hint').disabled, true)
  assert.equal(m.find('data-op', 'undo').disabled, true)
  const seed = data.seed
  m.find('data-op', 'restart').fire('click')
  m.applyLast()
  assert.equal(data.seed, seed)
  assert.equal(puzzle.view(data, account).done, false)
  assert.equal(data.records.length, 1, '重开保留记录')
  // 再做一次完成，记录累加
  for (const cell of solutionOf(data.puzzle)) m.leftClick(cell)
  assert.equal(data.records.length, 2)
})

test('客户端：解格只按真实点击落下，不会因为预置答案或 hint 自动出现', () => {
  const data = seeded(113, 5)
  const account = api()
  const solution = solutionOf(data.puzzle)
  const m = mount(data, account)
  assert.equal(m.all('data-cell').every(node => node.getAttribute('data-mark') === 'empty'), true)
  // 问两次提示后，盘面仍然是零个猪
  m.find('data-op', 'hint').fire('click')
  m.applyLast()
  m.find('data-op', 'hint').fire('click')
  m.applyLast()
  assert.equal(puzzle.view(data, account).placed, 0)
  assert.equal(m.all('data-cell').filter(node => node.getAttribute('data-mark') === 'pig').length, 0)
  // 点非解格会被拒绝，不会落错猪；只点一个解格也只出现这一只。
  const wrong = data.puzzle.region.map((value, cell) => cell).find(cell => !solution.includes(cell))
  m.leftClick(wrong)
  assert.equal(puzzle.view(data, account).placed, 0)
  assert.equal(m.all('data-cell').filter(node => node.getAttribute('data-mark') === 'pig').length, 0)
  assert.equal(puzzle.view(data, account).lives, 2)
  m.leftClick(solution[0])
  assert.equal(puzzle.view(data, account).placed, 1)
  assert.equal(m.all('data-cell').filter(node => node.getAttribute('data-mark') === 'pig').length, 1)
})

test('重新导入后替换旧样式，尺寸/标记/操作栏使用新版布局', () => {
  const data = seeded(101, 5)
  const m = mount(data, api())
  m.dom.document.getElementById = id => m.dom.head.children.find(node => node.id === id) || null
  const style = m.dom.document.getElementById('dsh-piggy-pig-puzzle-style')
  style.textContent = '.pz-actions{grid-template-columns:repeat(4,1fr)}'
  const count = m.dom.head.children.length
  m.refresh()
  assert.match(style.textContent, /\.pz-modebar/)
  assert.match(style.textContent, /\.pz-sizes/)
  assert.equal(m.dom.head.children.length, count)
})

test('标题已占用的高度从棋盘预算扣除，操作栏独立于滚动区', () => {
  const m = mount(seeded(101, 5), api(), { beforeRender(dom, app) {
    app.content.style.setProperty('--ext-panel-height', '280px')
    const heading = dom.document.createElement('header')
    heading.offsetHeight = 38
    app.content.appendChild(heading)
  } })
  let root, scroll, footer, actions
  m.dom.body.walk(node => {
    if (node.className === 'pz') root = node
    if (node.className === 'pz-scroll') scroll = node
    if (node.className === 'pz-footer') footer = node
    if (node.className === 'pz-actions') actions = node
  })
  assert.equal(root.style.getPropertyValue('--pz-avail'), '242px')
  assert.equal(scroll.parentNode, root)
  assert.equal(footer.parentNode, root)
  assert.equal(actions.parentNode, footer)
  assert.equal(m.all('data-puzzle-seed')[0].style.getPropertyValue('--pz-size'), '5',
    '棋盘把阶数交给 CSS 计算自身宽高')
  assert.deepEqual(actions.children.map(node => node.getAttribute('data-op')), ['undo', 'restart', 'rules', 'hint', 'new'],
    '两行操作的 DOM 顺序要和视觉一致：先撤销/重开/规则，再提示/新一局')
  assert.equal(actions.children.length, 5, '紧凑高度也要保留全部操作')
  assert.equal(actions.children[3].className, 'dp-btn', '提示是奶油次要按钮')
  assert.equal(actions.children[4].className, 'dp-mini', '新一局是唯一的青绿主要动作')
  assert.equal(actions.children.every(node => node.textContent.length > 0), true)
  m.refresh()
  assert.equal(m.all('data-cell').length, 25)
})

test('棋盘内部滚动在宿主轮询后保持，新题才回到开头', () => {
  const m = mount(seeded(101, 5), api())
  const scroll = () => { let found; m.dom.body.walk(node => { if (node.className === 'pz-scroll') found = node }); return found }
  scroll().scrollTop = 56; scroll().fire('scroll'); m.refresh()
  assert.equal(scroll().scrollTop, 56)
  m.act('new', { size: 6 })
  assert.equal(scroll().scrollTop, 0)
})

test('客户端：格子无描边、棋盘透明，去掉行列坐标和格内区号但保留区域底色与 ARIA', () => {
  const data = seeded(114, 5)
  const m = mount(data, api())
  m.dom.document.getElementById = id => m.dom.head.children.find(node => node.id === id) || null
  const css = m.dom.document.getElementById('dsh-piggy-pig-puzzle-style').textContent

  const base = css.match(/\.pz-cell\{([^}]*)\}/)
  assert.ok(base, '缺少 .pz-cell 基础样式')
  assert.match(base[1], /border:0;/, '格子是纯色块，不画任何描边（包括淡黑线）')
  assert.match(base[1], /border-radius:4px/, '格子保持小圆角')
  assert.doesNotMatch(base[1], /box-shadow/, '常态格子没有阴影')

  const board = css.match(/\.pz-board\{display:grid;([^}]*)\}/)
  assert.ok(board, '缺少 .pz-board 基础样式')
  assert.match(board[1], /gap:4px/, '格子之间靠留白缝区分')
  assert.match(board[1], /padding:0;/, '棋盘不再嵌套奶油色内框')
  assert.match(board[1], /border:0;/, '棋盘自身无边框')
  assert.match(board[1], /background:transparent/, '棋盘背景透明')
  assert.match(css, /\.pz-scroll \.pz-board\{[^}]*min-width:calc\(var\(--pz-size\) \* 36px - 4px\)/,
    '最小外宽按 4px 缝和 32px 格计算')
  assert.doesNotMatch(css, /\.pz-(axis|corner)/, '不再使用行列坐标样式')
  assert.doesNotMatch(css, /\.pz-(region|records)/, '不再使用格内区号和最近通关样式')
  let axes = 0
  m.dom.body.walk(node => { if (node.className === 'pz-axis' || node.className === 'pz-corner') axes += 1 })
  assert.equal(axes, 0, '棋盘外不再渲染坐标格')

  const boardNode = m.find('data-puzzle-seed', String(data.seed))
  assert.equal(boardNode.style.gridTemplateColumns, 'repeat(5, minmax(0, 1fr))', '网格只留数据列')
  const cells = m.all('data-cell')
  assert.equal(cells.length, 25)
  for (const node of cells) {
    const cell = Number(node.getAttribute('data-cell'))
    const region = Number(node.getAttribute('data-region'))
    assert.equal(node.children.some(child => child.className === 'pz-region'), false,
      '格子左上角不再显示区号数字')
    assert.match(String(node.style.backgroundColor), /^#[0-9a-f]{6}$/i, '区域底色仍按区上色')
    assert.match(node.getAttribute('aria-label'),
      new RegExp('第 ' + (Math.floor(cell / 5) + 1) + ' 行第 ' + (cell % 5 + 1) + ' 列，第 ' + (region + 1) + ' 区'),
      'ARIA 仍给出行列和区域')
  }

  assert.match(css, /\.pz-status\{[^}]*min-height:20px;[^}]*line-height:20px;[^}]*border:0;[^}]*background:transparent/,
    '状态行是普通文字，不加描边和底色')
  assert.match(css, /\.pz-mode\[data-on="true"\],\.pz-size\[data-on="true"\]\{background:var\(--ac-primary,#19c8b9\);color:#fff/,
    '只有选中的分段项是青绿白字')
  assert.match(css, /\.pz-cell:focus-visible\{outline:/, '键盘焦点保留功能性 outline')
  assert.match(css, /\.pz-cell\[data-hint="true"\]\{[^}]*outline:/, '提示高亮仍可辨认')
  assert.match(css, /\.pz-wrong\{[^}]*color:#d9534f;[^}]*animation:pz-wrong/, '红叉是错误色并有短动画')
  assert.match(css, /\.pz-wrong-hold\{animation:none;opacity:1\}/, '同一错误在轮询重绘时保持静态，不重播动画')
  assert.match(css, /@keyframes pz-wrong\{/, '红叉有独立的短关键帧')
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{/,
    '有减少动态效果的媒体查询')
  assert.ok(css.includes('.pz-wrong{animation:none;opacity:1}'),
    '减少动态效果时红叉改为静态')
  assert.match(css, /\.pz-failed\{[^}]*border:2px solid/, '锁定提示用现有奶油卡片和描边')
  assert.match(css, /\.pz-rules-page \.pz-scroll\{display:flex;flex-direction:column;gap:8px\}/,
    '规则子页自己占满滚动区，不把棋盘挤在下面')
})

const wrongChildren = node => node.children.filter(child => String(child.className).indexOf('pz-wrong') === 0)

test('客户端：放错只在目标格亮短红叉，轮询不重播、超时移除、刷新不复活', async () => {
  const data = seeded(201, 4)
  const account = api()
  const solution = solutionOf(data.puzzle)
  const free = data.puzzle.region.map((value, cell) => cell).filter(cell => !solution.includes(cell))
  const m = mount(data, account)
  assert.equal(puzzle.view(data, account).lives, 3)
  m.leftClick(free[0])
  const view = puzzle.view(data, account)
  assert.equal(view.lives, 2)
  assert.equal(view.feedback.seq, 1)
  assert.deepEqual(view.feedback.cells, [free[0]])
  assert.match(m.text(), /机会 2 \/ 3/)
  assert.equal(m.all('data-cell').filter(node => wrongChildren(node).length > 0).length, 1, '只在一个格子亮红叉')
  const target = m.find('data-cell', String(free[0]))
  const cross = wrongChildren(target)[0]
  assert.equal(cross.textContent, '×')
  assert.equal(cross.getAttribute('aria-hidden'), 'true')
  assert.equal(wrongChildren(m.find('data-cell', String(free[1]))).length, 0)

  // 宿主轮询重绘同一条反馈：不新增节点，也不重播缩放动画。
  m.refresh()
  m.refresh()
  assert.equal(m.all('data-cell').filter(node => wrongChildren(node).length > 0).length, 1)
  assert.equal(wrongChildren(m.find('data-cell', String(free[0])))[0].className, 'pz-wrong pz-wrong-hold')
  assert.equal(puzzle.view(data, account).feedback.seq, 1, '刷新不改变反馈序号')

  await new Promise(resolve => setTimeout(resolve, 780))
  assert.equal(m.all('data-cell').filter(node => wrongChildren(node).length > 0).length, 0, '红叉寿命结束后本地移除')
  m.refresh()
  assert.equal(m.all('data-cell').filter(node => wrongChildren(node).length > 0).length, 0, '过期反馈不会被轮询复活')
})

test('客户端：第三次放错锁定盘面，不自动重开；再试这道/换一局都恢复机会', () => {
  const data = seeded(202, 4)
  const account = api()
  const solution = solutionOf(data.puzzle)
  const free = data.puzzle.region.map((value, cell) => cell).filter(cell => !solution.includes(cell))
  const m = mount(data, account)
  const seed = data.seed
  for (let index = 0; index < 3; index += 1) m.leftClick(free[index])
  let view = puzzle.view(data, account)
  assert.equal(view.lives, 0)
  assert.equal(view.locked, true)
  assert.equal(view.done, false)
  assert.equal(view.placed, 0)
  assert.match(m.text(), /机会用完了/)
  assert.ok(m.find('data-retry', 'same'), '锁定后给出再试这道')
  assert.ok(m.find('data-retry', 'new'), '锁定后给出换一局')
  assert.equal(m.find('data-op', 'hint').disabled, true)
  assert.equal(m.find('data-op', 'undo').disabled, true)
  assert.equal(m.find('data-cell', String(solution[0])).getAttribute('data-locked'), 'true')
  const sent = m.sent.length
  const cell = m.find('data-cell', String(solution[0]))
  cell.fire('pointerdown', { button: 0, pointerType: 'mouse' })
  cell.fire('pointerup')
  cell.fire('click', { detail: 1 })
  assert.equal(m.sent.length, sent, '锁定后点棋盘不再发动作')
  assert.equal(data.seed, seed, '锁定不自动换题')

  // 刷新：失败的盘面和 0 条命都在，失败页还在，旧红叉不复活。
  const lockedSnapshot = JSON.parse(JSON.stringify(data))
  const reloaded = mount(lockedSnapshot, account)
  assert.equal(puzzle.view(lockedSnapshot, account).locked, true)
  assert.equal(puzzle.view(lockedSnapshot, account).lives, 0)
  assert.match(reloaded.text(), /机会用完了/)
  assert.ok(reloaded.find('data-retry', 'same'))
  assert.ok(reloaded.find('data-retry', 'new'))
  assert.equal(reloaded.all('data-cell').filter(node => wrongChildren(node).length > 0).length, 0)

  m.find('data-retry', 'same').fire('click')
  m.applyLast()
  view = puzzle.view(data, account)
  assert.equal(data.seed, seed)
  assert.equal(view.locked, false)
  assert.equal(view.lives, 3)
  assert.equal(view.placed, 0)
  assert.match(m.text(), /机会 3 \/ 3/)

  // 再锁一次，选「换一局」：seed 变，机会回满。
  for (let index = 3; index < 6; index += 1) m.leftClick(free[index])
  assert.equal(puzzle.view(data, account).locked, true)
  m.find('data-retry', 'new').fire('click')
  m.applyLast()
  view = puzzle.view(data, account)
  assert.notEqual(data.seed, seed)
  assert.equal(view.locked, false)
  assert.equal(view.lives, 3)
})

test('客户端：一次含错格的拖动整组不落，只在一个错格亮红叉、只扣一条命', () => {
  const data = seeded(204, 5)
  const account = api()
  const solution = solutionOf(data.puzzle)
  const free = data.puzzle.region.map((value, cell) => cell).filter(cell => !solution.includes(cell))
  const m = mount(data, account)
  const payload = [solution[0], free[0], solution[1], free[1]]
  const first = m.find('data-cell', String(payload[0]))
  first.fire('pointerdown', { button: 0, pointerType: 'mouse' })
  for (const cell of payload.slice(1)) m.find('data-cell', String(cell)).fire('pointerenter')
  m.find('data-cell', String(payload[3])).fire('pointerup')
  assert.deepEqual(plain(m.sent), [{ op: 'drag', payload: { cells: payload, mode: 'pig' } }])
  m.applyLast()
  const view = puzzle.view(data, account)
  assert.equal(view.placed, 0, '不部分应用正确子集')
  assert.equal(view.moves, 0)
  assert.equal(view.lives, 2)
  assert.deepEqual(view.feedback.cells, [free[0]])
  assert.equal(m.all('data-cell').filter(node => node.getAttribute('data-mark') === 'pig').length, 0)
  assert.equal(m.all('data-cell').filter(node => wrongChildren(node).length > 0).length, 1, '只显示第一个错格')
  assert.equal(wrongChildren(m.find('data-cell', String(free[0]))).length, 1)
  assert.equal(wrongChildren(m.find('data-cell', String(free[1]))).length, 0)
})
