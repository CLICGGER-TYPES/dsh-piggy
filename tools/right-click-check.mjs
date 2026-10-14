// @ts-check
/** 真实 QMP 右键采样：按条件交替操作，按外壳原生日志判断打开，CDP 只读猪位置与动作。 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectRole } from './lib/cdp-read.js'

const args = process.argv.slice(2)
const option = (key, fallback = '') => args.indexOf(key) < 0 ? fallback : args[args.indexOf(key) + 1] ?? fallback
const endpoint = option('--cdp', 'http://127.0.0.1:9333')
const domain = option('--vm')
const reader = option('--log-reader')
const directory = option('--shots')
const output = option('--out')
const outside = option('--outside').split(',').map(Number)
const count = Number(option('--count', '50'))
const modes = ['idle', 'reaction', 'after-drag', 'just-closed', 'from-outside', 'rapid']
if (!domain || !reader || !directory || !output || outside.length !== 2 || !outside.every(Number.isFinite) || !Number.isInteger(count) || count < 1) {
  throw new Error('Required: --vm --log-reader --shots --out --outside x,y [--cdp URL] [--count 50]')
}

/** 外壳日志读取器返回 JSON {text: 日志全文}；由操作者提供安全的本机或 SSH 读取程序。 */
function readNative() {
  const data = JSON.parse(execFileSync(reader, [], { encoding: 'utf8', timeout: 3000 }))
  const events = String(data.text).split('\n').flatMap(line => {
    const match = line.match(/^\[([^\]]+)\] panel (shown|closed)(?: |$)/)
    return match ? [{ at: match[1], state: match[2] === 'shown' ? 'open' : 'closed', line }] : []
  })
  return { events, last: events.at(-1) ?? null }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const qmp = events => execFileSync('virsh', ['-c', 'qemu:///system', 'qemu-monitor-command', domain,
  JSON.stringify({ execute: 'input-send-event', arguments: { events } })], { stdio: 'pipe', timeout: 3000 })
let pointer = { x: outside[0], y: outside[1] }
let screenSize = { width: 1280, height: 800 }

/** 指针分步移动；快速条件只缩短到达后的停留，不跳过移动。 */
async function move(point) {
  const from = { ...pointer }
  for (let index = 1; index <= 12; index++) {
    const x = from.x + (point.x - from.x) * index / 12, y = from.y + (point.y - from.y) * index / 12
    qmp([{ type: 'abs', data: { axis: 'x', value: Math.round(x * 32767 / screenSize.width) } },
      { type: 'abs', data: { axis: 'y', value: Math.round(y * 32767 / screenSize.height) } }])
    await delay(50)
  }
  pointer = { ...point }
}

/** 只按下与松开真实鼠标键，不发 CDP 输入。 */
async function press(button, hold = 100) {
  const started = performance.now()
  qmp([{ type: 'btn', data: { down: true, button } }])
  await delay(hold)
  qmp([{ type: 'btn', data: { down: false, button } }])
  return started
}

const expression = `(() => {
  const pig = document.querySelector('.dp-pig'), box = pig?.getBoundingClientRect();
  return box ? { point: {x: screenX + box.x + box.width / 2, y: screenY + box.y + box.height / 2},
    stage: pig.getAttribute('data-stage'), reaction: pig.getAttribute('data-react'), idle: pig.getAttribute('data-idle'),
    screen: {width: screen.width, height: screen.height} } : null;
})()`

/** 日志是原生显示的证据；页面 visibilityState 在本项目不能证明窗口已显示。 */
async function awaitNative(state, afterLine = '') {
  const deadline = performance.now() + 3000
  while (performance.now() < deadline) {
    const native = readNative()
    const previous = native.events.map(event => event.line).lastIndexOf(afterLine)
    const observed = native.events.slice(previous + 1).find(event => event.state === state)
    if (observed) return observed
    await delay(50)
  }
  return null
}

/** 每轮从关闭状态开始；额外恢复点击单独记录，不能算作首次成功。 */
async function closePanel(pet) {
  const native = readNative()
  if (native.last?.state !== 'open') return
  // 点自己的名牌空白先取得焦点，再点已核实安全的窗口外位置；不额外右键猪。
  const panel = await connectRole(endpoint, 'panel')
  try {
    const point = await panel.read(`(() => { const r = document.querySelector('.dp-hud')?.getBoundingClientRect();
      return r && r.width && r.height ? {x: screenX + r.x + r.width / 2, y: screenY + r.y + r.height / 2} : null })()`)
    if (!point) throw new Error('No visible HUD to focus before outside-click close')
    await move(point)
    await press('left')
  } finally { panel.close() }
  await move({ x: outside[0], y: outside[1] })
  await press('left')
  const closed = await awaitNative('closed', native.last.line)
  if (!closed || readNative().last?.state !== 'closed') throw new Error('Could not close native panel before trial')
}

/** 状态准备也走真实输入，不修改存档或 DOM。 */
async function prepare(pet, mode) {
  let current = await pet.read(expression)
  await move(current.point)
  if (mode === 'reaction') {
    await press('left')
    const deadline = performance.now() + 1500
    while (!(current = await pet.read(expression)).reaction && performance.now() < deadline) await delay(20)
    if (!current.reaction) throw new Error('Reaction trial had no active reaction')
  } else if (mode === 'after-drag') {
    qmp([{ type: 'btn', data: { down: true, button: 'left' } }])
    await move({ x: current.point.x + (current.point.x < screenSize.width / 2 ? 24 : -24), y: current.point.y })
    qmp([{ type: 'btn', data: { down: false, button: 'left' } }])
    current = await pet.read(expression)
    await move(current.point)
  } else if (mode === 'from-outside') {
    await move({ x: outside[0], y: outside[1] })
    await press('left')
    current = await pet.read(expression)
    await move(current.point)
  } else if (mode !== 'rapid' && mode !== 'just-closed') await delay(550)
  return current
}

/** 首次打开已判定后，补四次真实快速连按，分别应关、开、关、开，不混入首次成功数。 */
async function rapidBurst() {
  const previous = readNative().last
  for (let index = 0; index < 4; index++) { await press('right', 20); await delay(20) }
  await delay(200)
  const native = readNative()
  const after = native.events.map(event => event.line).lastIndexOf(previous?.line ?? '')
  const observed = native.events.slice(after + 1)
  const expected = ['closed', 'open', 'closed', 'open']
  return { expected, observed, passed: JSON.stringify(observed.map(event => event.state)) === JSON.stringify(expected) }
}

/** 一个可审计样本：首次输入、原生显示延迟上界、200ms 后是否保持打开、截图与恢复次数。 */
async function trial(pet, sample) {
  await closePanel(pet)
  const prepared = await prepare(pet, sample.mode)
  const before = readNative().last
  const started = await press('right', sample.mode === 'rapid' ? 20 : 100)
  const shown = await awaitNative('open', before?.line ?? '')
  const latency = shown ? performance.now() - started : null
  await delay(200)
  const stable = readNative().last
  const result = { ...sample, prepared, openedFirst: Boolean(shown && stable?.state === 'open'),
    latencyUpperBoundMs: latency, shown, stable, recoveryClicks: 0 }
  const screenshot = join(directory, String(sample.index).padStart(2, '0') + '-' + sample.mode + '.png')
  execFileSync('virsh', ['-c', 'qemu:///system', 'screenshot', domain, screenshot], { stdio: 'pipe', timeout: 3000 })
  for (let attempt = 0; !result.openedFirst && readNative().last?.state !== 'open' && attempt < 3; attempt++) {
    await press('right'); result.recoveryClicks += 1; await awaitNative('open', before?.line ?? '')
  }
  const rapid = sample.mode === 'rapid' && result.openedFirst ? await rapidBurst() : null
  if (rapid) execFileSync('virsh', ['-c', 'qemu:///system', 'screenshot', domain, screenshot.replace('.png', '-burst.png')], { stdio: 'pipe', timeout: 3000 })
  return { ...result, screenshot, rapid }
}

mkdirSync(directory, { recursive: true })
let pet = null
const samples = []
writeFileSync(output, JSON.stringify({ complete: false, samples }, null, 2) + '\n')
try {
  pet = await connectRole(endpoint, 'pet')
  const initial = await pet.read(expression)
  if (!initial || initial.stage === 'box') throw new Error('Start with an already hatched isolated test pig')
  screenSize = initial.screen
  for (let index = 1; index <= count; index++) {
    const sample = await trial(pet, { index, mode: modes[(index - 1) % modes.length] })
    samples.push(sample)
    writeFileSync(output, JSON.stringify({ complete: false, samples }, null, 2) + '\n')
    process.stdout.write(JSON.stringify({ index, mode: sample.mode, openedFirst: sample.openedFirst, latencyUpperBoundMs: sample.latencyUpperBoundMs }) + '\n')
  }
  await closePanel(pet)
  const firstClickSuccesses = samples.filter(sample => sample.openedFirst).length
  const passed = firstClickSuccesses === count && samples.every(sample => !sample.rapid || sample.rapid.passed)
  writeFileSync(output, JSON.stringify({ complete: true, passed, samples, firstClickSuccesses,
    observation: 'latencyUpperBoundMs includes native-log polling and reader transport; screenshots must be checked separately' }, null, 2) + '\n')
  if (!passed) process.exitCode = 1
} catch (error) {
  writeFileSync(output, JSON.stringify({ complete: false, samples, error: error instanceof Error ? error.message : String(error) }, null, 2) + '\n')
  throw error
} finally { pet?.close() }
