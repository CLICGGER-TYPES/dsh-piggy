// 审定 PNG 的状态选择与真实资源路由：避免切换到不存在的文件或越过资源目录。
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { test } from 'node:test'
import { feedbackArtFor } from '../src/client/feedback-art.js'
import { registerRoutes } from '../routes.js'

const base = { stage: 'piglet', base: 'piglet', mood: 'fine', reaction: '', idle: '', activityKind: '', activityKey: '', hour: 0 }

test('反馈立绘保持透明 PNG 和游戏包体积预算', () => {
  const directory = new URL('../assets/pigs/feedback/', import.meta.url)
  const names = readdirSync(directory).filter(name => name.endsWith('.png'))
  assert.equal(names.length, 38)
  let total = 0
  for (const name of names) {
    const data = readFileSync(new URL(name, directory))
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name)
    assert.ok(Math.max(data.readUInt32BE(16), data.readUInt32BE(20)) <= 256, name)
    assert.ok(data[25] === 6 || (data[25] === 3 && data.includes(Buffer.from('tRNS'))), `${name} must carry alpha transparency`)
    total += data.length
  }
  assert.ok(total < 3_000_000, `feedback art is ${total} bytes`)
})

test('审定图片按真实状态切换，已有皮肤保留自己的立绘', () => {
  const cases = [
    [{ ...base, stage: 'box' }, 'courier'],
    [{ ...base, stage: 'box', hour: 1 }, 'collection-courier'],
    [{ ...base, stage: 'dead-day' }, 'death-day'],
    [{ ...base, stage: 'grave' }, 'ghost-grave'],
    // 用户 2026-10-09：猪递只给没拆的纸盒；快递员不用它。
    [{ ...base, activityKind: 'work', activityKey: 'courier' }, null],
    [{ ...base, activityKind: 'study' }, 'study-book'],
    [{ ...base, activityKind: 'fishing' }, 'fishing'],
    [{ ...base, activityKind: 'interest', activityKey: 'fitness' }, 'collection-fitness'],
    // 生病按病种和阶段：发烧是感冒第 2 期，红疹是皮肤病，晕是头晕；咳嗽、肠胃没图。
    [{ ...base, mood: 'sick', illness: 'cold:2' }, 'collection-fever'],
    [{ ...base, mood: 'sick', illness: 'cold:1' }, 'runny-nose'],
    [{ ...base, mood: 'sick', illness: 'skin:1' }, 'allergy'],
    [{ ...base, mood: 'sick', illness: 'dizzy:1' }, 'faint'],
    [{ ...base, mood: 'sick', illness: 'cough:1' }, null],
    [{ ...base, mood: 'sick', illness: 'cold:4' }, null],
    [{ ...base, reaction: 'bathe' }, 'collection-bubbles'],
    // 治病、摸头不再用晕倒图和待定的徽章图；吹泡泡、挠痒没有对应的图。
    [{ ...base, reaction: 'cure' }, null],
    [{ ...base, reaction: 'pet' }, null],
    [{ ...base, idle: 'bubbles' }, null],
    [{ ...base, idle: 'scratch' }, null],
    [{ ...base, base: 'skin-angel', reaction: 'bathe' }, null],
    // 生日蛋糕是场景图：形态、皮肤也照样显示。
    [{ ...base, base: 'pig-fat', party: true }, 'birthday'],
  ]
  for (const [state, expected] of cases) assert.equal(feedbackArtFor(state), expected, JSON.stringify(state))
  for (let hour = 0; hour < 24; hour += 1) {
    for (const mood of ['hungry', 'sleepy', 'lonely', 'dirty', 'happy']) {
      const art = feedbackArtFor({ ...base, mood, hour })
      assert.ok(statSync(new URL(`../assets/pigs/feedback/${art}.png`, import.meta.url)).size > 1000)
    }
  }
})

test('待定的图一张都不会被选中', async () => {
  const { FEEDBACK_ART_TABLES, UNUSED_FEEDBACK_ART } = await import('../src/client/feedback-art.js')
  const used = JSON.stringify(FEEDBACK_ART_TABLES)
  for (const name of UNUSED_FEEDBACK_ART) assert.ok(!used.includes(`"${name}"`), `${name} 是待定图，不该出现在用图表里`)
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
