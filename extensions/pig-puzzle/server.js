// @ts-check
// 藏猪方块 0.2.6：在线益智扩展候选，规则见 docs/design/new-play-rules-20261021.md。
// 每行、每列、每个颜色区各一只猪；猪之间八邻域不能相邻（斜角也不行）。
// 关卡由 seed 现场生成：随机解 -> 连通颜色区 -> 用穷举计数把多余解修掉，最终只留唯一解。
// 每局 3 次机会：只有往“唯一解之外”放猪才扣机会，错猪不落盘；排除和撤销不扣也不返还机会。
// 机会用完只锁定盘面，不自动重开；重试同题或换新题都恢复 3 次机会。
// 扩展不设金币、门票、奖励，也不碰养成存档；删除扩展由宿主清自己的 data。

const MIN_SIZE = 4
const MAX_SIZE = 6
const DEFAULT_SIZE = 5
const MAX_ATTEMPTS = 80
const MAX_REPAIR = 80
const MAX_SOLUTIONS = 64
const MAX_UNDO = 40
const MAX_RECORDS = 20
const MAX_CACHE = 48
const MAX_LIVES = 3
const HINT_KINDS = ['place', 'exclude', 'conflict', 'none']
const FEEDBACK_KINDS = ['wrong', 'locked']
const MODES = ['pig', 'exclude']
const reject = reason => ({ ok: false, reason })
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const onlyKeys = (value, keys) => plainObject(value) && Object.keys(value).every(key => keys.includes(key))
const inRange = (value, low, high) => Number.isInteger(value) && value >= low && value <= high

// ---- seed 生成器：可复现、跨尺寸不串味 ----

/** @param {number} seed */
function mulberry32(seed) {
  let state = seed | 0
  return function random() {
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** @param {number} seed @param {number} size */
const randomFor = (seed, size) => mulberry32((seed >>> 0) ^ Math.imul(size, 0x9E3779B1))
/** @template T @param {T[]} list @param {() => number} random @returns {T[]} */
function shuffled(list, random) {
  const out = list.slice()
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[out[index], out[swap]] = [out[swap], out[index]]
  }
  return out
}
const neighborsOf = (size, cell) => {
  const row = Math.floor(cell / size)
  const col = cell % size
  return [
    row > 0 ? cell - size : -1,
    row < size - 1 ? cell + size : -1,
    col > 0 ? cell - 1 : -1,
    col < size - 1 ? cell + 1 : -1,
  ].filter(next => next >= 0)
}
/** 随机挑一个合法解：每行一只、每列一只、相邻两行的列差至少 2。 */
function randomSolution(size, random) {
  const cols = new Array(size).fill(-1)
  const used = new Array(size).fill(false)
  function walk(row) {
    if (row === size) return true
    for (const col of shuffled(Array.from({ length: size }, (_, index) => index), random)) {
      if (used[col] || (row > 0 && Math.abs(cols[row - 1] - col) < 2)) continue
      used[col] = true
      cols[row] = col
      if (walk(row + 1)) return true
      used[col] = false
      cols[row] = -1
    }
    return false
  }
  return walk(0) ? cols.map((col, row) => row * size + col) : null
}
/**
 * 独立于提示的穷举求解器：固定猪必须用上，排除格不能用；最多返回 limit 个解。
 * @param {number} size @param {number[]} region @param {number[]} fixed @param {number[]} excluded @param {number} limit
 * @returns {number[][]}
 */
function solve(size, region, fixed, excluded, limit) {
  const fixedCol = new Map()
  for (const cell of fixed) fixedCol.set(Math.floor(cell / size), cell % size)
  const blocked = new Set(excluded)
  const solutions = []
  const cols = new Array(size).fill(-1)
  const usedCol = new Set()
  const usedRegion = new Set()
  function walk(row) {
    if (solutions.length >= limit) return
    if (row === size) { solutions.push(cols.map((col, index) => index * size + col)); return }
    for (const col of fixedCol.has(row) ? [fixedCol.get(row)] : Array.from({ length: size }, (_, index) => index)) {
      const cell = row * size + col
      if (blocked.has(cell) || usedCol.has(col) || usedRegion.has(region[cell])) continue
      if (row > 0 && Math.abs(cols[row - 1] - col) < 2) continue
      usedCol.add(col); usedRegion.add(region[cell]); cols[row] = col
      walk(row + 1)
      usedCol.delete(col); usedRegion.delete(region[cell]); cols[row] = -1
    }
  }
  walk(0)
  return solutions
}
/** @param {number} size @param {number[]} cells */
function connectedByGrid(size, cells) {
  if (cells.length === 0) return false
  const set = new Set(cells)
  const seen = new Set([cells[0]])
  const queue = [cells[0]]
  for (let at = queue.pop(); at !== undefined; at = queue.pop()) {
    for (const next of neighborsOf(size, at)) {
      if (set.has(next) && !seen.has(next)) { seen.add(next); queue.push(next) }
    }
  }
  return seen.size === set.size
}
/** @param {number} size @param {number[]} region */
const regionsAreConnected = (size, region) => Array.from({ length: size }, (_, color) =>
  region.map((value, cell) => value === color ? cell : -1).filter(cell => cell >= 0)).every(cells => connectedByGrid(size, cells))
/** 多源随机生长：每个颜色区从自己的解格出发，按相邻格长出去，天然连通。 */
function growRegions(size, solution, random) {
  const region = new Array(size * size).fill(-1)
  const queues = solution.map((cell, color) => { region[cell] = color; return [cell] })
  let remaining = size * size - size
  while (remaining > 0) {
    const active = shuffled(queues.map((queue, color) => queue.length > 0 ? color : -1).filter(color => color >= 0), random)
    let progress = false
    for (const color of active) {
      const queue = queues[color]
      const at = queue.splice(Math.floor(random() * queue.length), 1)[0]
      if (at === undefined) continue
      for (const next of shuffled(neighborsOf(size, at), random)) {
        if (region[next] !== -1) continue
        region[next] = color
        queue.push(next)
        remaining -= 1
        progress = true
        break
      }
      if (progress) break
    }
    if (!progress) return null
  }
  return region
}
/** @param {number} size @param {number[]} region @returns {number[][]} */
const regionGroups = (size, region) => Array.from({ length: size }, (_, color) =>
  region.map((value, cell) => value === color ? cell : -1).filter(cell => cell >= 0))
/**
 * 随机区划往往不止一个解。每次拿一个非目标解，把一个非目标解格挪进相邻的、
 * 也含该解格的区：旧区仍连通才挪。目标解不受伤，其他解只会变少不会变多。
 */
function repairRegions(size, region, solution, random) {
  for (let step = 0; step < MAX_REPAIR; step += 1) {
    const solutions = solve(size, region, [], [], MAX_SOLUTIONS)
    if (solutions.length === 0) return null
    if (solutions.length === 1) return region
    const target = solution.join(',')
    let moved = false
    for (const alternative of solutions) {
      if (alternative.join(',') === target) continue
      const groups = regionGroups(size, region)
      const cell = shuffled(alternative.filter(entry => !solution.includes(entry)), random).find(entry => {
        const from = region[entry]
        if (groups[from].length < 2 || !connectedByGrid(size, groups[from].filter(unit => unit !== entry))) return false
        const into = neighborsOf(size, entry).map(next => region[next])
          .filter((color, index, list) => color !== from && list.indexOf(color) === index)
          .filter(color => alternative.some(unit => region[unit] === color))
        if (into.length === 0) return false
        region[entry] = shuffled(into, random)[0]
        return true
      })
      if (cell !== undefined) { moved = true; break }
    }
    if (!moved) return null
  }
  return null
}
/** 正常 seed 走不到这里；极端重试失败时用已验证的唯一解形状兜底。 */
const FALLBACK_REGIONS = {
  4: [0, 0, 3, 1, 0, 0, 3, 1, 2, 0, 3, 3, 2, 2, 3, 3],
  5: [1, 1, 1, 0, 0, 1, 1, 1, 0, 3, 2, 2, 3, 3, 3, 4, 4, 3, 3, 3, 4, 4, 3, 3, 3],
  6: [1, 1, 1, 1, 0, 2, 1, 1, 1, 1, 0, 2, 1, 1, 1, 2, 2, 2, 3, 3, 3, 2, 4, 2, 5, 3, 4, 4, 4, 4, 5, 3, 3, 3, 4, 4],
}
const CACHE = new Map()
const SOLUTION_CACHE = new Map()
/**
 * 唯一解只给服务端判“放错”和测试用，不写进 data，也不返回 view。
 * 生成器保证正常题唯一；如果读到手工改坏的多解题，返回 null 而不是猜一个。
 * @param {{ size: number, region: number[] }} level
 * @returns {number[]|null}
 */
function solutionFor(level) {
  const key = level.size + ':' + level.region.join(',')
  if (!SOLUTION_CACHE.has(key)) {
    const found = solve(level.size, level.region, [], [], 2)
    if (SOLUTION_CACHE.size >= MAX_CACHE) SOLUTION_CACHE.delete(SOLUTION_CACHE.keys().next().value)
    SOLUTION_CACHE.set(key, found.length === 1 ? found[0] : null)
  }
  return SOLUTION_CACHE.get(key)
}
/**
 * 由 seed 生成一道题。返回的题不包含解，只包含尺寸、区划和展示文案。
 * @param {number} seed @param {number} size
 * @returns {{ seed: number, size: number, region: number[], title: string, note: string }}
 */
export function makePuzzle(seed, size) {
  const cleanSize = inRange(size, MIN_SIZE, MAX_SIZE) ? size : DEFAULT_SIZE
  const cleanSeed = Math.abs(Math.trunc(Number.isFinite(seed) ? seed : 1)) % 0x7FFFFFFF
  const key = cleanSeed + ':' + cleanSize
  const cached = CACHE.get(key)
  if (cached !== undefined) return { seed: cleanSeed, size: cleanSize, region: cached.slice(), title: titleOf(cleanSize), note: noteOf(cleanSize) }
  const random = randomFor(cleanSeed, cleanSize)
  let region = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const solution = randomSolution(cleanSize, random)
    const grown = solution === null ? null : growRegions(cleanSize, solution, random)
    const repaired = grown === null ? null : repairRegions(cleanSize, grown, solution, random)
    if (repaired === null || solve(cleanSize, repaired, [], [], 2).length !== 1 || !regionsAreConnected(cleanSize, repaired)) continue
    region = repaired
    break
  }
  if (region === null) region = FALLBACK_REGIONS[cleanSize].slice()
  if (solve(cleanSize, region, [], [], 2).length !== 1) throw new Error('pig-puzzle fallback is not unique')
  if (CACHE.size >= MAX_CACHE) CACHE.delete(CACHE.keys().next().value)
  CACHE.set(key, region.slice())
  return { seed: cleanSeed, size: cleanSize, region: region.slice(), title: titleOf(cleanSize), note: noteOf(cleanSize) }
}
const titleOf = size => size + '×' + size + ' 随机局'
const noteOf = size => (size === 6
  ? '每行、每列、每个颜色区各一只猪；拖动会按当前标记模式连划，撤销一次退回一整组。'
  : '每行、每列、每个颜色区各一只猪，猪之间斜着也不能挨。新一局换一道题，重开还是这道题。')

// ---- 规则、提示、存档 ----
const rowOf = (level, cell) => Math.floor(cell / level.size)
const colOf = (level, cell) => cell % level.size
const adjacent = (level, a, b) => Math.max(Math.abs(rowOf(level, a) - rowOf(level, b)), Math.abs(colOf(level, a) - colOf(level, b))) === 1
const unitName = (kind, index) => (kind === 'row' ? '第 ' + (index + 1) + ' 行' : kind === 'col' ? '第 ' + (index + 1) + ' 列' : '第 ' + (index + 1) + ' 区')

/** @returns {{ rows: number[][], cols: number[][], colors: number[][] }} */
function unitsOf(level) {
  const size = level.size
  const all = Array.from({ length: size * size }, (_, cell) => cell)
  return {
    rows: Array.from({ length: size }, (_, row) => all.filter(cell => Math.floor(cell / size) === row)),
    cols: Array.from({ length: size }, (_, col) => all.filter(cell => cell % size === col)),
    colors: Array.from({ length: size }, (_, color) => all.filter(cell => level.region[cell] === color)),
  }
}
/** @param {any} level @returns {Array<[string, number[][]]>} */
function unitGroups(level) {
  const units = unitsOf(level)
  return [['row', units.rows], ['col', units.cols], ['color', units.colors]]
}
/** @param {any} value @param {number} size @returns {number[]} */
function cellList(value, size) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(cell => Number.isInteger(cell) && cell >= 0 && cell < size * size))].sort((a, b) => a - b)
}
export function conflictsOf(level, pigs) {
  const found = []
  const list = cellList(pigs, level.size)
  for (const [kind, all] of unitGroups(level)) {
    all.forEach((cells, unit) => {
      const here = cells.filter(cell => list.includes(cell))
      if (here.length > 1) found.push({ kind, unit, cells: here })
    })
  }
  list.forEach((a, index) => list.slice(index + 1).forEach(b => {
    if (adjacent(level, a, b)) found.push({ kind: 'adjacent', unit: null, cells: [a, b] })
  }))
  return found
}
/** 不冲突、也没被排除的格子。只看当前盘面，不查答案。 */
export function candidateCells(level, pigs, excluded) {
  const safePigs = cellList(pigs, level.size)
  const blocked = new Set([...safePigs, ...cellList(excluded, level.size)])
  return Array.from({ length: level.size * level.size }, (_, cell) => cell).filter(cell =>
    !blocked.has(cell) && !safePigs.some(pig => rowOf(level, pig) === rowOf(level, cell) || colOf(level, pig) === colOf(level, cell) || level.region[pig] === level.region[cell] || adjacent(level, pig, cell)))
}
function conflictText(level, conflict) {
  if (conflict.kind === 'adjacent') {
    const [a, b] = conflict.cells
    return '第 ' + (rowOf(level, a) + 1) + ' 行和第 ' + (rowOf(level, b) + 1) + ' 行的猪挨着了，先挪开一只。'
  }
  return unitName(conflict.kind, conflict.unit) + '已经有两只猪了，先改一处。'
}
function starvedUnit(level, pigs, excluded, placed) {
  const candidates = candidateCells(level, [...pigs, placed], excluded)
  for (const [kind, all] of unitGroups(level)) {
    const unit = all.findIndex(cells => !cells.includes(placed) && !cells.some(cell => pigs.includes(cell)) && !cells.some(cell => candidates.includes(cell)))
    if (unit >= 0) return { kind, unit }
  }
  return null
}
function placeText(level, hint) {
  const row = rowOf(level, hint.cell) + 1
  const col = colOf(level, hint.cell) + 1
  if (hint.kind === 'row') return '第 ' + (hint.unit + 1) + ' 行只剩第 ' + col + ' 列这一格能放猪。'
  if (hint.kind === 'col') return '第 ' + (hint.unit + 1) + ' 列只剩第 ' + row + ' 行这一格能放猪。'
  return '第 ' + (hint.unit + 1) + ' 区只剩第 ' + row + ' 行第 ' + col + ' 列能放猪。'
}
const cellText = (level, cell) => '第 ' + (rowOf(level, cell) + 1) + ' 行第 ' + (colOf(level, cell) + 1) + ' 列'
const openIn = (cells, candidates) => cells.filter(cell => candidates.includes(cell))
/**
 * 可解释提示：先找只剩一个候选的行/列/区，再做「放这里会让别的单元没位置」的反证；
 * 几何招用完后用穷举确认某一格非放不可（或非排不可）。提示只返回格子和理由，绝不落猪。
 * @param {any} level @param {number[]} pigs @param {number[]} excluded
 */
export function hintFor(level, pigs, excluded) {
  const conflicts = conflictsOf(level, pigs)
  if (conflicts.length > 0) return { kind: 'conflict', cell: null, text: conflictText(level, conflicts[0]) }
  const candidates = candidateCells(level, pigs, excluded)
  const filled = cells => cells.some(cell => pigs.includes(cell))
  for (const [kind, all] of unitGroups(level)) {
    for (let unit = 0; unit < all.length; unit += 1) {
      if (filled(all[unit])) continue
      const open = openIn(all[unit], candidates)
      if (open.length === 0) return { kind: 'conflict', cell: null, text: unitName(kind, unit) + '已经没有能放猪的格子了，先撤销或重开。' }
      if (open.length === 1) return { kind: 'place', unit, unitKind: kind, cell: open[0], text: placeText(level, { kind, unit, cell: open[0] }) }
    }
  }
  for (const cell of candidates) {
    const starved = starvedUnit(level, pigs, excluded, cell)
    if (starved !== null) return { kind: 'exclude', cell, text: '如果' + cellText(level, cell) + '放猪，' + unitName(starved.kind, starved.unit) + '就没有能放的位置了，所以这一格先排除。' }
  }
  if (solve(level.size, level.region, pigs, excluded, 1).length === 0) return { kind: 'conflict', cell: null, text: '现在的标记已经凑不出完整答案了，先撤销或重开。' }
  // 穷举反证：排除这一格就无解，说明它必须是猪；放这一格就无解，说明它不能放。
  const mustPlace = candidates.find(cell => solve(level.size, level.region, pigs, [...excluded, cell], 1).length === 0)
  if (mustPlace !== undefined) return { kind: 'place', cell: mustPlace, text: '把' + cellText(level, mustPlace) + '排除后，整道题就凑不齐每行、每列、每区各一只了，所以这里放猪。' }
  const mustExclude = candidates.find(cell => solve(level.size, level.region, [...pigs, cell], excluded, 1).length === 0)
  if (mustExclude !== undefined) return { kind: 'exclude', cell: mustExclude, text: '在' + cellText(level, mustExclude) + '放猪会让后面的行、列或区没位置，所以这一格先排除。' }
  return { kind: 'none', cell: null, text: '暂时没有只靠规则就能确定的格子。可以先排除你觉得不可能的格子，或者点「重开」。' }
}
const emptyBoard = () => ({ pigs: [], excluded: [], undo: [], moves: 0, lives: MAX_LIVES, done: false, doneAt: null })
function normalizeBoard(board, size) {
  const clean = plainObject(board) ? board : {}
  clean.pigs = cellList(clean.pigs, size)
  clean.excluded = cellList(clean.excluded, size).filter(cell => !clean.pigs.includes(cell))
  clean.undo = (Array.isArray(clean.undo) ? clean.undo : [])
    .filter(entry => plainObject(entry) && Array.isArray(entry.pigs) && Array.isArray(entry.excluded))
    .slice(-MAX_UNDO)
    .map(entry => ({ pigs: cellList(entry.pigs, size).filter(cell => !cellList(entry.excluded, size).includes(cell)), excluded: cellList(entry.excluded, size), moves: Number.isInteger(entry.moves) && entry.moves >= 0 ? entry.moves : 0 }))
  clean.done = clean.done === true
  clean.moves = Number.isInteger(clean.moves) && clean.moves >= 0 ? clean.moves : 0
  clean.lives = inRange(clean.lives, 0, MAX_LIVES) ? clean.lives : MAX_LIVES
  clean.doneAt = clean.done && Number.isInteger(clean.doneAt) && clean.doneAt >= 0 ? clean.doneAt : null
  return clean
}
function normalizeFeedback(data, size) {
  if (!Number.isInteger(data.feedbackSeq) || data.feedbackSeq < 0) data.feedbackSeq = 0
  const feedback = data.feedback
  if (!plainObject(feedback)) { delete data.feedback; return }
  const { seq, kind } = feedback
  const at = Number.isInteger(feedback.at) && feedback.at >= 0 ? feedback.at : 0
  const cells = cellList(feedback.cells, size).slice(0, 1)
  if (!Number.isInteger(seq) || seq <= 0 || !FEEDBACK_KINDS.includes(kind) || cells.length !== 1) { delete data.feedback; return }
  data.feedbackSeq = Math.max(data.feedbackSeq, seq)
  data.feedback = { seq, kind, cells, at }
}
function validPuzzle(puzzle) {
  if (!plainObject(puzzle)) return false
  const size = puzzle.size
  return inRange(size, MIN_SIZE, MAX_SIZE) && Number.isInteger(puzzle.seed) && puzzle.seed >= 0
    && Array.isArray(puzzle.region) && puzzle.region.length === size * size
    && puzzle.region.every(value => inRange(value, 0, size - 1)) && new Set(puzzle.region).size === size
    && regionsAreConnected(size, puzzle.region)
}
function normalizePuzzle(puzzle, fallbackSeed, fallbackSize) {
  if (!validPuzzle(puzzle)) return makePuzzle(Number.isInteger(fallbackSeed) && fallbackSeed >= 0 ? fallbackSeed : 1, inRange(fallbackSize, MIN_SIZE, MAX_SIZE) ? fallbackSize : DEFAULT_SIZE)
  return { seed: puzzle.seed, size: puzzle.size, region: puzzle.region.slice(), title: titleOf(puzzle.size), note: noteOf(puzzle.size) }
}
/** 0.1 的固定五关原样收进 legacy（含旧盘面和旧记录），新题从新 seed 开始；旧通关记录继续展示。 */
function migrateLegacy(data) {
  if (plainObject(data.puzzle)) return
  const legacy = {}
  for (const key of ['current', 'boards', 'records', 'hint', 'level']) {
    if (key in data) { legacy[key] = data[key]; delete data[key] }
  }
  if (Object.keys(legacy).length === 0) return
  const oldRecords = Array.isArray(legacy.records) ? legacy.records : []
  data.legacy = { ...(plainObject(data.legacy) ? data.legacy : {}), ...legacy }
  const kept = oldRecords
    .filter(record => plainObject(record) && Number.isInteger(record.at) && Number.isInteger(record.moves) && record.moves >= 0)
    .map(record => ({ title: inRange(record.level, 1, 99) ? '旧关卡 ' + record.level : '旧记录', size: null, seed: null, at: record.at, moves: record.moves, legacy: true }))
  data.records = [...kept, ...(Array.isArray(data.records) ? data.records : [])].slice(0, MAX_RECORDS)
  data.seed = Number.isInteger(data.seed) && data.seed >= 0 ? data.seed : 1
  data.size = inRange(data.size, MIN_SIZE, MAX_SIZE) ? data.size : DEFAULT_SIZE
}
function normalizeData(data) {
  const safe = plainObject(data) ? data : {}
  migrateLegacy(safe)
  safe.v = 3
  safe.puzzle = normalizePuzzle(safe.puzzle, safe.seed, safe.size)
  safe.seed = safe.puzzle.seed
  safe.size = safe.puzzle.size
  // v2 -> v3：不按答案过滤旧盘面。旧规则留下的猪、排除、撤销栈、记录和 seed 原样保留，
  // 只补 lives=3 和 feedbackSeq=0；只有结构上读不懂的旧字段才在 normalizeBoard 里丢掉。
  safe.board = normalizeBoard(safe.board, safe.size)
  normalizeFeedback(safe, safe.size)
  safe.records = (Array.isArray(safe.records) ? safe.records : [])
    .filter(record => plainObject(record) && Number.isInteger(record.at) && Number.isInteger(record.moves) && record.moves >= 0 && typeof record.title === 'string')
    .map(record => ({ title: record.title.slice(0, 40), size: inRange(record.size, MIN_SIZE, MAX_SIZE) ? record.size : null, seed: Number.isInteger(record.seed) && record.seed >= 0 ? record.seed : null, at: record.at, moves: record.moves, legacy: record.legacy === true }))
    .slice(0, MAX_RECORDS)
  if (safe.hint !== undefined && !plainObject(safe.hint)) delete safe.hint
  return safe
}
const clearHint = data => { if (Object.prototype.hasOwnProperty.call(data, 'hint')) delete data.hint }
const clearFeedback = data => { if (Object.prototype.hasOwnProperty.call(data, 'feedback')) delete data.feedback }
const isLocked = board => board.lives === 0 && !board.done
function wrongCell(level, cell) {
  const solution = solutionFor(level)
  return solution !== null && !solution.includes(cell)
}
function noteWrong(data, board, cell, api) {
  board.lives = Math.max(0, board.lives - 1)
  data.feedbackSeq = (Number.isInteger(data.feedbackSeq) ? data.feedbackSeq : 0) + 1
  data.feedback = { seq: data.feedbackSeq, kind: board.lives === 0 ? 'locked' : 'wrong', cells: [cell], at: Number.isFinite(api.now) ? api.now : 0 }
  clearHint(data)
  return { ok: true, wrong: true, lives: board.lives, locked: isLocked(board) }
}
function pushUndo(board) {
  board.undo = [...board.undo, { pigs: [...board.pigs], excluded: [...board.excluded], moves: board.moves }].slice(-MAX_UNDO)
}
function settle(data, board, api) {
  if (board.done) return true
  const level = data.puzzle
  const pigs = cellList(board.pigs, level.size)
  if (pigs.length !== level.size || conflictsOf(level, pigs).length > 0) return false
  board.done = true
  board.doneAt = api.now
  data.records = [{ title: level.title, size: level.size, seed: level.seed, at: api.now, moves: board.moves, legacy: false }, ...data.records].slice(0, MAX_RECORDS)
  return true
}
const onlyEmptyPayload = payload => payload === undefined || onlyKeys(payload, [])
export default {
  init() {
    const seed = Math.floor(Math.random() * 0x7FFFFFFF)
    return { v: 3, seed, size: DEFAULT_SIZE, puzzle: makePuzzle(seed, DEFAULT_SIZE), board: emptyBoard(), records: [], feedbackSeq: 0 }
  },

  actions: {
    /** 左键（pig）：空格/排除格 -> 猪，猪 -> 清除；右键（exclude）：空格 -> 排除，排除 -> 清除。 */
    tap(data, payload, api) {
      const safe = normalizeData(data)
      if (!onlyKeys(payload, ['cell', 'mode'])) return reject('unknown')
      const mode = payload.mode === undefined ? 'pig' : payload.mode
      if (!MODES.includes(mode) || !inRange(payload.cell, 0, safe.size * safe.size - 1)) return reject('unknown')
      const board = safe.board
      if (board.done || isLocked(board)) return reject(board.done ? 'already' : 'locked')
      const cell = payload.cell
      const without = list => list.filter(entry => entry !== cell)
      if (mode === 'exclude' && board.pigs.includes(cell)) return { ok: true, changed: false }
      // 只有“新放一只猪”才判答案；清除猪、排除、取消排除都不扣机会。
      if (mode === 'pig' && !board.pigs.includes(cell) && wrongCell(safe.puzzle, cell)) return noteWrong(safe, board, cell, api)
      pushUndo(board)
      if (mode === 'pig') {
        const hadPig = board.pigs.includes(cell)
        board.pigs = hadPig ? without(board.pigs) : [...without(board.pigs), cell].sort((a, b) => a - b)
        if (!hadPig) board.excluded = without(board.excluded)
      } else board.excluded = board.excluded.includes(cell) ? without(board.excluded) : [...board.excluded, cell].sort((a, b) => a - b)
      board.moves += 1
      clearHint(safe)
      clearFeedback(safe)
      const done = settle(safe, board, api)
      return { ok: true, mode, done }
    },

    /** 一次拖动只算一组：按模式把经过的格子刷成猪或排除，跳过已经是该状态的格子；整组一次撤销。 */
    drag(data, payload, api) {
      const safe = normalizeData(data)
      if (!onlyKeys(payload, ['cells', 'mode']) || !Array.isArray(payload.cells)) return reject('unknown')
      const mode = payload.mode === undefined ? 'pig' : payload.mode
      if (!MODES.includes(mode)) return reject('unknown')
      if (payload.cells.length < 1 || payload.cells.length > safe.size * safe.size) return reject('unknown')
      if (!payload.cells.every(cell => inRange(cell, 0, safe.size * safe.size - 1)) || new Set(payload.cells).size !== payload.cells.length) return reject('unknown')
      const board = safe.board
      if (board.done || isLocked(board)) return reject(board.done ? 'already' : 'locked')
      const pigs = cellList(board.pigs, safe.size)
      const excluded = cellList(board.excluded, safe.size)
      const open = payload.cells.filter(cell => mode === 'pig' ? !pigs.includes(cell) : !pigs.includes(cell) && !excluded.includes(cell))
      if (open.length === 0) return reject('unknown')
      // 整组原子：只要有一个新放猪的格子不在唯一解里，整组都不落；只扣 1 次机会，
      // 而且只把第一处错格交给客户端（不把整组错格摊开，避免大范围拖动泄露答案形状）。
      const wrong = mode === 'pig' ? open.find(cell => wrongCell(safe.puzzle, cell)) : undefined
      if (wrong !== undefined) return noteWrong(safe, board, wrong, api)
      pushUndo(board)
      if (mode === 'pig') {
        board.pigs = [...new Set([...pigs, ...open])].sort((a, b) => a - b)
        board.excluded = excluded.filter(cell => !open.includes(cell))
      } else board.excluded = [...new Set([...excluded, ...open])].sort((a, b) => a - b)
      board.moves += 1
      clearHint(safe)
      clearFeedback(safe)
      const done = settle(safe, board, api)
      return { ok: true, mode, marked: open.length, done }
    },

    undo(data, payload) {
      const safe = normalizeData(data)
      if (!onlyEmptyPayload(payload)) return reject('unknown')
      const board = safe.board
      if (board.done || isLocked(board)) return reject(board.done ? 'already' : 'locked')
      const snapshot = board.undo.pop()
      if (snapshot === undefined) return reject('empty')
      board.pigs = [...snapshot.pigs]
      board.excluded = [...snapshot.excluded]
      board.moves = snapshot.moves
      // 撤销只回退盘面，不碰 board.lives：放错失去的机会永远拿不回来。
      clearHint(safe)
      clearFeedback(safe)
      return { ok: true }
    },

    /** 重开：题目不变，只清当前盘面；通关记录保留。 */
    restart(data, payload) {
      const safe = normalizeData(data)
      if (!onlyEmptyPayload(payload)) return reject('unknown')
      safe.board = emptyBoard(); clearHint(safe); clearFeedback(safe)
      return { ok: true, seed: safe.seed }
    },

    /** 新一局：换 seed；可选换尺寸。题目和盘面重新持久化，记录保留。 */
    new(data, payload, api, random = Math.random) {
      const safe = normalizeData(data)
      if (!onlyKeys(payload, ['size'])) return reject('unknown')
      const size = payload.size === undefined ? safe.size : payload.size
      if (!inRange(size, MIN_SIZE, MAX_SIZE)) return reject('unknown')
      const roll = typeof random === 'function' ? Number(random()) : 0
      let seed = Math.abs(Math.floor((Number.isFinite(roll) ? roll : 0) * 0x7FFFFFFF)) % 0x7FFFFFFF
      if (seed === safe.seed) seed = (seed + 1) % 0x7FFFFFFF
      safe.puzzle = makePuzzle(seed, size)
      safe.seed = safe.puzzle.seed
      safe.size = safe.puzzle.size
      safe.board = emptyBoard(); clearHint(safe); clearFeedback(safe)
      return { ok: true, seed: safe.seed, size: safe.size }
    },

    hint(data, payload) {
      const safe = normalizeData(data)
      if (!onlyEmptyPayload(payload)) return reject('unknown')
      if (safe.board.done || isLocked(safe.board)) return reject(safe.board.done ? 'already' : 'locked')
      const hint = hintFor(safe.puzzle, cellList(safe.board.pigs, safe.size), cellList(safe.board.excluded, safe.size))
      safe.hint = { ...hint, seed: safe.seed }
      return { ok: true, hint: safe.hint }
    },
  },

  view(data) {
    const safe = normalizeData(structuredClone(data))
    const level = safe.puzzle
    const board = safe.board
    const pigs = cellList(board.pigs, level.size)
    const conflicts = conflictsOf(level, pigs)
    const candidates = candidateCells(level, pigs, board.excluded)
    const hint = plainObject(safe.hint) && safe.hint.seed === safe.seed && HINT_KINDS.includes(safe.hint.kind) && typeof safe.hint.text === 'string'
      && (safe.hint.kind === 'place' || safe.hint.kind === 'exclude' ? inRange(safe.hint.cell, 0, level.size * level.size - 1) : safe.hint.cell === null)
      ? { kind: safe.hint.kind, cell: safe.hint.cell, unitKind: typeof safe.hint.unitKind === 'string' ? safe.hint.unitKind : null, unit: Number.isInteger(safe.hint.unit) ? safe.hint.unit : null, text: safe.hint.text.slice(0, 240) }
      : null
    const cells = Array.from({ length: level.size * level.size }, (_, index) => ({
      index, row: rowOf(level, index) + 1, col: colOf(level, index) + 1, region: level.region[index],
      mark: pigs.includes(index) ? 'pig' : board.excluded.includes(index) ? 'excluded' : 'empty',
      candidate: candidates.includes(index),
    }))
    const locked = isLocked(board)
    const feedback = plainObject(safe.feedback) && !board.done
      ? { seq: safe.feedback.seq, kind: safe.feedback.kind, cells: safe.feedback.cells.slice(0, 1), at: safe.feedback.at }
      : null
    const status = board.done
      ? '完成！' + level.size + ' 只小猪都藏好了。'
      : locked
        ? '机会用完了 · 盘面已锁定'
        : conflicts.length > 0
          ? conflictText(level, conflicts[0])
          : '机会 ' + board.lives + ' / ' + MAX_LIVES + ' · 已放 ' + pigs.length + ' / ' + level.size
    return {
      level: { size: level.size, seed: level.seed, title: level.title, note: level.note, min: MIN_SIZE, max: MAX_SIZE },
      cells,
      status,
      conflicts: conflicts.map(conflict => ({ kind: conflict.kind, unit: conflict.unit ?? null })),
      placed: pigs.length,
      remaining: Math.max(0, level.size - pigs.length),
      moves: board.moves,
      lives: board.lives,
      maxLives: MAX_LIVES,
      locked,
      canUndo: board.undo.length > 0,
      done: board.done,
      doneAt: board.doneAt,
      feedback,
      hint,
      records: safe.records.map(record => ({ title: record.title, size: record.size, seed: record.seed, at: record.at, moves: record.moves, legacy: record.legacy })),
      solved: safe.records.length,
    }
  },
}
// 供测试和将来的维护脚本直接检查生成器；不导出解，也不写进 data。
export const generator = { solve, makePuzzle, randomSolution, growRegions, repairRegions }
