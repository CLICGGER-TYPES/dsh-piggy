// 云存档端到端验收：两个隔离的 DSH_HOME + 本地 bare 仓库，跑真实运行时与真实 git。
// 用法：node verify-cloud-save.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = 'D:\\piggy-test'
const remote = join(root, 'remote.git')
const homeA = join(root, 'home-a')
const homeB = join(root, 'home-b')

function git(args, cwd) {
  return execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8' })
}

function reset() {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(remote, { recursive: true })
  mkdirSync(homeA, { recursive: true })
  mkdirSync(homeB, { recursive: true })
  git(['init', '-q', '--bare', remote], root)
}

async function call(runtime, method, url, body) {
  const result = await runtime.handle(method, url, body === undefined ? undefined : JSON.stringify(body))
  const text = typeof result.body === 'string' ? result.body : String(result.body ?? '')
  let json = null
  try { json = JSON.parse(text) } catch { /* 非 JSON 就留空 */ }
  return { status: result.status, json, text }
}

const checks = []
function check(name, ok, detail) {
  checks.push({ name, ok, detail })
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''))
}

const { createGameRuntime } = await import('./runtime/index.js')

reset()

const cloudSave = {
  enabled: true,
  remote,
  branch: 'main',
  device: 'verify-a',
  debounceMs: 60 * 60 * 1000, // 验收里不让定时器插手
  insecureSkipTlsVerify: false,
}

let a = createGameRuntime({ statePath: join(homeA, 'state.json'), cloudSave })
await call(a, 'POST', '/dsh-piggy/act', { action: 'hatch' })
let stateA = (await call(a, 'GET', '/dsh-piggy/state')).json
check('A 孵化出猪', stateA?.hatched === true, 'name=' + stateA?.pig?.name)

const pushed = await call(a, 'POST', '/dsh-piggy/cloud/push', {})
check('首次推送成功', pushed.json?.ok === true, JSON.stringify(pushed.json?.meta ?? pushed.json))

await call(a, 'POST', '/dsh-piggy/act', { action: 'dev', patch: { coins: 4321 } })
const manual = await call(a, 'POST', '/dsh-piggy/cloud/commit', {})
check('手动提交成功', manual.json?.ok === true)

const history = (await call(a, 'GET', '/dsh-piggy/cloud/history?branch=main')).json
check('history 有手动提交', Boolean(history?.manual), history?.manual?.subject)
check('history 自动提交不超过 10 条', Array.isArray(history?.auto) && history.auto.length <= 10, 'auto=' + (history?.auto?.length ?? -1))
check('手动提交不在 auto 列表里', (history?.auto ?? []).every(item => item.subject.startsWith('save:')))

const branches = (await call(a, 'GET', '/dsh-piggy/cloud/branches')).json
check('branches 列出 main', Array.isArray(branches?.branches) && branches.branches.includes('main'), JSON.stringify(branches?.branches))

a.dispose()

const b = createGameRuntime({ statePath: join(homeB, 'state.json'), cloudSave: { ...cloudSave, device: 'verify-b' } })
const before = (await call(b, 'GET', '/dsh-piggy/state')).json
check('B 初始没有猪', before?.hatched !== true)

const pulled = await call(b, 'POST', '/dsh-piggy/cloud/pull', { branch: 'main' })
check('B 拉取成功', pulled.json?.ok === true, JSON.stringify(pulled.json?.meta ?? pulled.json))

const after = (await call(b, 'GET', '/dsh-piggy/state')).json
check('B 拉到了同一只猪', after?.pig?.name === stateA?.pig?.name, after?.pig?.name)
check('B 拉到了同样的金币', after?.pig?.coins === 4321, 'coins=' + after?.pig?.coins)

const stateB = JSON.parse(readFileSync(join(homeB, 'state.json'), 'utf8'))
check('B 的存档版本一致', stateB.version === JSON.parse(readFileSync(join(homeA, 'state.json'), 'utf8')).version, 'v' + stateB.version)

b.dispose()

const failed = checks.filter(item => !item.ok)
console.log('\n' + (failed.length === 0 ? 'ALL PASS' : 'FAILED: ' + failed.map(item => item.name).join(' / ')))
process.exit(failed.length === 0 ? 0 : 1)
