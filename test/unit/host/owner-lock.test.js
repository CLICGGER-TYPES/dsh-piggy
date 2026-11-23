// @ts-check
/** 运行时锁：PID 复用、老格式、nonce、并发获取与过期证据。 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { acquireGameLock } from '../../../runtime/owner-lock.js'

const REPO = fileURLToPath(new URL('../../../runtime/owner-lock.js', import.meta.url))

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-owner-lock-'))
  const statePath = join(dir, 'state.json')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return { dir, statePath, fixed: `${statePath}.runtime.lock` }
}

const SELF = { alive: true, name: 'node', execPath: process.execPath, token: 'self-token', startedAt: 1_000_000 }
const probeWith = map => pid => pid === process.pid ? SELF : (map[pid] ?? { alive: false })

function publish(statePath, owner, nonce = 'a'.repeat(32)) {
  const fixed = `${statePath}.runtime.lock`
  mkdirSync(fixed, { recursive: false, mode: 0o700 })
  writeFileSync(join(fixed, `${nonce}.json`), JSON.stringify({ ...owner, nonce }))
  return { fixed, marker: join(fixed, `${nonce}.json`) }
}

test('pid 存在但身份不符：判过期、回收留证、新锁可用', t => {
  const { statePath, fixed } = setup(t)
  publish(statePath, {
    pid: 4242,
    identity: { token: 'old-owner', startedAt: 1000, execPath: 'C:\\Windows\\System32\\svchost.exe', name: 'svchost.exe' },
  })
  const release = acquireGameLock(statePath, {
    now: () => 1_700_000_000_000,
    probe: probeWith({ 4242: { alive: true, token: 'reused-by-svchost', startedAt: 1_600_000_000_000, execPath: 'C:\\Windows\\System32\\svchost.exe', name: 'svchost.exe' } }),
  })
  const stale = readdirSync(join(statePath, '..')).filter(name => name.startsWith('state.json.runtime.lock.stale-'))
  assert.equal(stale.length, 1, '过期锁要留下 .stale-<ts> 证据')
  assert.deepEqual(readdirSync(join(statePath, '..', stale[0])), [`${'a'.repeat(32)}.json`])
  assert.ok(existsSync(fixed), '新锁已经发布')
  release()
})

test('pid 不存在（ESRCH）直接回收', t => {
  const { statePath } = setup(t)
  publish(statePath, { pid: 5555, identity: { token: 'gone' } })
  const release = acquireGameLock(statePath, { probe: probeWith({}) })
  release()
})

test('nonce 不符：拒绝并保留原锁，不吞证据', t => {
  const { statePath, fixed } = setup(t)
  mkdirSync(fixed)
  writeFileSync(join(fixed, `${'b'.repeat(32)}.json`), JSON.stringify({ pid: 6000, nonce: 'c'.repeat(32) }))
  assert.throws(() => acquireGameLock(statePath, { probe: probeWith({ 6000: { alive: true, name: 'node' } }) }), error => error.code === 'OWNER_LOCK_INVALID')
  assert.equal(readdirSync(fixed).length, 1)
})

test('同一进程第二次获取被拒；释放后可以再获取', t => {
  const { statePath } = setup(t)
  const options = { probe: probeWith({}) }
  const release = acquireGameLock(statePath, options)
  assert.throws(() => acquireGameLock(statePath, options), error => error.code === 'OWNER_LOCK_LIVE')
  release()
  const again = acquireGameLock(statePath, options)
  again()
})

test('老格式锁：明确是无关进程才回收，像运行时就保守拒绝', t => {
  const first = setup(t)
  publish(first.statePath, { pid: 6666 })
  const release = acquireGameLock(first.statePath, { probe: probeWith({ 6666: { alive: true, name: 'svchost.exe', execPath: 'C:\\Windows\\svchost.exe' } }) })
  release()

  const second = setup(t)
  publish(second.statePath, { pid: 7777 })
  assert.throws(() => acquireGameLock(second.statePath, {
    probe: probeWith({ 7777: { alive: true, name: 'node', execPath: '/usr/bin/node' } }),
  }), error => error.code === 'OWNER_LOCK_LIVE')
})

test('并发获取只有一个成功', async t => {
  const { statePath } = setup(t)
  const url = pathToFileURL(REPO).href
  const script = `import { acquireGameLock } from ${JSON.stringify(url)};
    try { const release = acquireGameLock(${JSON.stringify(statePath)}); console.log('OK');
      setTimeout(() => { try { release() } catch {} ; process.exit(0) }, 3000) }
    catch (error) { console.log('ERR:' + (error.code ?? error.message)); process.exit(1) }`
  const start = () => new Promise(resolve => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', chunk => { out += chunk })
    child.on('close', code => resolve({ code, out: out.trim() }))
  })
  const results = await Promise.all([start(), start()])
  const ok = results.filter(result => result.code === 0)
  const refused = results.filter(result => result.code !== 0)
  assert.equal(ok.length, 1, JSON.stringify(results))
  assert.equal(refused.length, 1)
  assert.match(refused[0].out, /OWNER_LOCK_LIVE/)
})
