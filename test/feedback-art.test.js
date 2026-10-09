// 审定 PNG 的状态选择与真实资源路由：避免切换到不存在的文件或越过资源目录。
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { test } from 'node:test'
import { feedbackArtFor } from '../src/client/feedback-art.js'
import { registerRoutes } from '../routes.js'

const base = { stage: 'piglet', base: 'piglet', mood: 'fine', reaction: '', idle: '', activityKind: '', activityKey: '', hour: 0 }

test('反馈立绘保持透明 PNG 和游戏包体积预算', () => {
  const directory = new URL('../assets/feedback/', import.meta.url)
  const names = readdirSync(directory).filter(name => name.endsWith('.png'))
  assert.equal(names.length, 38)
  let total = 0
  for (const name of names) {
    const data = readFileSync(new URL(name, directory))
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name)
    assert.ok(Math.max(data.readUInt32BE(16), data.readUInt32BE(20)) <= 256, name)
    assert.equal(data[25], 6, `${name} must be RGBA, not RGB with a white canvas`)
    total += data.length
  }
  assert.ok(total < 3_000_000, `feedback art is ${total} bytes`)
})

test('审定图片按真实状态切换，已有皮肤保留自己的立绘', () => {
  const cases = [
    [{ ...base, stage: 'box' }, 'courier'],
    [{ ...base, stage: 'dead-day' }, 'death-day'],
    [{ ...base, stage: 'grave' }, 'ghost-grave'],
    [{ ...base, activityKind: 'work', activityKey: 'courier' }, 'courier'],
    [{ ...base, activityKind: 'study' }, 'study-book'],
    [{ ...base, activityKind: 'fishing' }, 'fishing'],
    [{ ...base, mood: 'sick' }, 'collection-fever'],
    [{ ...base, reaction: 'bathe' }, 'collection-bubbles'],
    [{ ...base, idle: 'scratch', hour: 1 }, 'twitch'],
    [{ ...base, base: 'skin-angel', reaction: 'bathe' }, null],
  ]
  for (const [state, expected] of cases) assert.equal(feedbackArtFor(state), expected)
  for (let hour = 0; hour < 24; hour += 1) {
    for (const mood of ['sick', 'hungry', 'sleepy', 'lonely', 'dirty', 'happy']) {
      const art = feedbackArtFor({ ...base, mood, hour })
      assert.ok(statSync(new URL(`../assets/feedback/${art}.png`, import.meta.url)).size > 1000)
    }
  }
})

test('资源路由提供 PNG，拒绝跨目录路径', async () => {
  const routes = {}
  registerRoutes({ inject: (deps, fn) => { if (deps.includes('webServer')) fn({ webServer: { register: route => { routes[route.path] = route; return () => {} } } }) } }, { ext: {} })
  const route = routes['/dsh-piggy/art']
  const call = url => new Promise(resolve => {
    const response = { writeHead(status, headers) { this.status = status; this.headers = headers; return this }, end(body) { resolve({ status: this.status, headers: this.headers, body }) } }
    route.handler({ method: 'GET', url }, response)
  })
  const valid = await call('/dsh-piggy/art/feedback/courier.png')
  assert.equal(valid.status, 200)
  assert.equal(valid.headers['content-type'], 'image/png')
  assert.ok(Buffer.from(valid.body).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
  assert.equal((await call('/dsh-piggy/art/feedback/../courier.png')).status, 404)
})
