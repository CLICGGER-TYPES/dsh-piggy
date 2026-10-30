// @ts-check
/** 云存档 HTTP 面：只验证参数与 JSON 往返，git 与替换都用假实现。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CLOUD_BRANCHES_ROUTE, CLOUD_COMMIT_ROUTE, CLOUD_HISTORY_ROUTE, CLOUD_PULL_ROUTE, CLOUD_PUSH_ROUTE, CLOUD_STATUS_ROUTE,
  createCloudRoutes,
} from '../runtime/cloud-routes.js'

/** 造一个最小的 req/res：req 是 async 可迭代的请求体，res 收集状态码与 JSON。 */
function fakePair(body) {
  const chunks = body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]
  const req = { method: 'POST', async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk } }
  const res = {
    status: 0,
    headers: {},
    text: '',
    writeHead(code, headers) { this.status = code; this.headers = headers ?? {}; return this },
    end(chunk) { this.text = String(chunk ?? '') },
    json() { return JSON.parse(this.text) },
  }
  return { req, res }
}

function routesWith(overrides = {}) {
  const calls = { pull: [], push: 0, branches: 0 }
  const routes = createCloudRoutes({
    status: async () => ({ enabled: true, remote: 'git@example.com:me/save.git', branch: 'main' }),
    branches: async () => { calls.branches += 1; return ['main', 'alt'] },
    pull: async branch => { calls.pull.push(branch); return { applied: true, meta: { lastSeenAt: 1 } } },
    push: async () => { calls.push += 1; return { committed: { message: 'save: x' } } },
    commit: async () => { calls.commit = (calls.commit ?? 0) + 1; return { committed: { message: 'save-manual: x' } } },
    history: async branch => ({ manual: { hash: 'aaa', subject: 'save-manual: x' }, auto: [{ hash: 'bbb', subject: 'save: y' }], branch }),
    ...overrides,
  })
  return { routes, calls }
}

const find = (routes, path) => routes.find(route => route.path === path)

test('status 与 branches 走 GET 并回 ok', async () => {
  const { routes, calls } = routesWith()
  const status = fakePair()
  status.req.method = 'GET'
  await find(routes, CLOUD_STATUS_ROUTE).handler(status.req, status.res)
  assert.equal(status.res.status, 200)
  assert.equal(status.res.json().remote, 'git@example.com:me/save.git')

  const branches = fakePair()
  branches.req.method = 'GET'
  await find(routes, CLOUD_BRANCHES_ROUTE).handler(branches.req, branches.res)
  assert.deepEqual(branches.res.json().branches, ['main', 'alt'])
  assert.equal(calls.branches, 1)
})

test('pull 需要分支名，并把分支透传下去', async () => {
  const { routes, calls } = routesWith()
  const missing = fakePair({})
  await find(routes, CLOUD_PULL_ROUTE).handler(missing.req, missing.res)
  assert.equal(missing.res.json().reason, 'missing-branch')

  const ok = fakePair({ branch: 'alt' })
  await find(routes, CLOUD_PULL_ROUTE).handler(ok.req, ok.res)
  assert.equal(ok.res.json().ok, true)
  assert.deepEqual(calls.pull, ['alt'])
})

test('pull 失败回 ok:false 而不是 500', async () => {
  const { routes } = routesWith({ pull: async () => { throw new Error('远端连不上') } })
  const res = fakePair({ branch: 'main' })
  await find(routes, CLOUD_PULL_ROUTE).handler(res.req, res.res)
  assert.equal(res.res.status, 200)
  assert.equal(res.res.json().ok, false)
  assert.match(res.res.json().message, /远端连不上/)
})

test('push 走 POST 并回结果', async () => {
  const { routes, calls } = routesWith()
  const res = fakePair({})
  await find(routes, CLOUD_PUSH_ROUTE).handler(res.req, res.res)
  assert.equal(calls.push, 1)
  assert.equal(res.res.json().ok, true)
})

test('非法 JSON 与错方法被拒绝', async () => {
  const { routes } = routesWith()
  const bad = fakePair('{oops')
  await find(routes, CLOUD_PULL_ROUTE).handler(bad.req, bad.res)
  assert.equal(bad.res.json().reason, 'invalid-body')

  const wrong = fakePair()
  wrong.req.method = 'GET'
  await find(routes, CLOUD_PUSH_ROUTE).handler(wrong.req, wrong.res)
  assert.equal(wrong.res.status, 405)
})

test('commit 与 history 走各自的路径', async () => {
  const { routes, calls } = routesWith()
  const commit = fakePair({})
  await find(routes, CLOUD_COMMIT_ROUTE).handler(commit.req, commit.res)
  assert.equal(commit.res.json().ok, true)
  assert.equal(calls.commit, 1)

  const history = fakePair()
  history.req.method = 'GET'
  history.req.url = '/dsh-piggy/cloud/history?branch=alt'
  await find(routes, CLOUD_HISTORY_ROUTE).handler(history.req, history.res)
  const body = history.res.json()
  assert.equal(body.branch, 'alt')
  assert.equal(body.manual.subject, 'save-manual: x')
  assert.equal(body.auto.length, 1)
})