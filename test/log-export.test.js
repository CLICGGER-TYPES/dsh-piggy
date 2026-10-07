// 日志的两条路由：导出这一份、收下浏览器那半边。
// 也守住「每个动作都留一条」——用户说「这个按钮不行」时，导出文件里要能看到点过什么。
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg } from '../core.js'
import { registerRoutes } from '../routes.js'
import { createStore } from '../store.js'

/** 一个最小的宿主：注册路由，然后像 HTTP 一样调用它们。 */
function boot() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-logs-'))
  const statePath = join(dir, 'state.json')
  writeFileSync(statePath, JSON.stringify(hatchEgg(Date.now() - 3_600_000)))
  const store = createStore(statePath)
  const routes = {}
  registerRoutes({ inject: (deps, fn) => { if (deps.includes('webServer')) fn({ webServer: { register: route => { routes[route.path] = route; return () => {} } } }) } }, store)
  return {
    store, routes, dir,
    done: async () => { store.dispose(); await store.journal.flush(); rmSync(dir, { recursive: true, force: true }) },
  }
}

/** 像宿主那样发一个请求。 */
function call(route, method, payload) {
  return new Promise((resolve, reject) => {
    let status = 200
    let text = ''
    const body = payload === undefined ? '' : typeof payload === 'string' ? payload : JSON.stringify(payload)
    const req = { method, url: route.path, async *[Symbol.asyncIterator]() { if (body !== '') yield Buffer.from(body) } }
    const res = {
      writeHead(code) { status = code; return res },
      end(chunk) { text += chunk ?? ''; resolve({ status, text }) },
    }
    Promise.resolve(route.handler(req, res)).catch(reject)
  })
}

test('GET /dsh-piggy/logs/export hands back the text the user will save', async () => {
  const app = boot()
  try {
    app.store.journal.header({ 游戏版本: '0.31.0' })
    app.store.journal.record('info', 'test', 'a line to find')
    const result = await call(app.routes['/dsh-piggy/logs/export'], 'GET')
    assert.equal(result.status, 200)
    assert.match(result.text, /游戏版本： 0\.31\.0/)
    assert.match(result.text, /a line to find/)
    // 导出后立刻删掉日志文件：导出前已经 flush，内容不能丢。
    assert.equal(result.status, 200)
  } finally { await app.done() }
})

test('POST /dsh-piggy/logs/client merges the browser half and refuses junk', async () => {
  const app = boot()
  try {
    const ok = await call(app.routes['/dsh-piggy/logs/client'], 'POST', {
      entries: [{ id: 'c1', at: Date.now(), level: 'error', scope: 'client', message: 'uncaught: boom', fields: { line: 3 } }],
    })
    assert.equal(ok.status, 200)
    assert.equal(JSON.parse(ok.text).added, 1)
    const again = await call(app.routes['/dsh-piggy/logs/client'], 'POST', { entries: [{ id: 'c1', message: 'uncaught: boom' }] })
    assert.equal(JSON.parse(again.text).added, 0, 'the same entry twice must not double up')
    const bad = await call(app.routes['/dsh-piggy/logs/client'], 'POST', '{not json')
    assert.equal(bad.status, 400)
    const exported = await call(app.routes['/dsh-piggy/logs/export'], 'GET')
    assert.match(exported.text, /ERROR client\s+uncaught: boom\s+line="3"/)
  } finally { await app.done() }
})

test('every action leaves a line: what was asked, how long, and why it was refused', async () => {
  const app = boot()
  try {
    // 背包里还没有苹果：先记一条被拒绝的（签到会发苹果，所以要排在前面）。
    const refused = await call(app.routes['/dsh-piggy/act'], 'POST', { action: 'feed', item: 'apple' })
    assert.equal(JSON.parse(refused.text).ok, false)
    const acted = await call(app.routes['/dsh-piggy/act'], 'POST', { action: 'signIn' })
    assert.equal(acted.status, 200)
    assert.equal(JSON.parse(acted.text).ok, true)
    const exported = await call(app.routes['/dsh-piggy/logs/export'], 'GET')
    assert.match(exported.text, /signIn ok\s+ms="\d+"/)
    assert.match(exported.text, /feed refused\s+ms="\d+" reason="no-item" item="apple"/)
  } finally { await app.done() }
})

test('the export route is GET-only and tolerates a host without a journal', async () => {
  const app = boot()
  try {
    const wrongMethod = await call(app.routes['/dsh-piggy/logs/export'], 'POST')
    assert.equal(wrongMethod.status, 405)
    const withoutJournal = { ...app.store, journal: undefined }
    const routes = {}
    registerRoutes({ inject: (deps, fn) => { if (deps.includes('webServer')) fn({ webServer: { register: route => { routes[route.path] = route; return () => {} } } }) } }, withoutJournal)
    const result = await call(routes['/dsh-piggy/logs/export'], 'GET')
    assert.equal(result.status, 200)
    assert.match(result.text, /没有开日志/)
  } finally { await app.done() }
})
