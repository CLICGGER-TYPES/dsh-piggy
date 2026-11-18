// @ts-check
import assert from 'node:assert/strict'
import test from 'node:test'

import { createAuthority } from '../authority-core.mjs'
import { startAuthority } from '../authority.mjs'

function createBody(overrides = {}) {
  return {
    room: 'PIG-7K2M', from: 'host-1', owner: true, seq: 1, ext: 'roulette', op: 'create',
    data: {
      matchId: 'm1', guestId: 'guest-1',
      settings: { lives: 1, format: 'single', stake: 1000, loadCount: 2 },
    },
    ...overrides,
  }
}

test('权威核心：建房、客人装弹、快照不含子弹、重复 seq 幂等', () => {
  let seed = 5
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
  }
  const authority = createAuthority({ random })
  const created = authority.handle(createBody())
  assert.equal(created.ok, true)
  assert.equal(created.events[0].op, 'match-start')
  assert.equal(created.events[0].data.view.pot, 2000)
  assert.equal('bullets' in created.events[0].data.view, false)

  const arm = authority.handle({
    room: 'PIG-7K2M', from: 'host-1', seq: 2, ext: 'roulette', op: 'action', data: { op: 'arm' },
  })
  assert.equal(arm.ok, true)
  assert.equal(arm.events[0].op, 'arm')
  assert.equal(arm.events[0].data.view.stage, 'choice')

  const snapshot = authority.handle({
    room: 'PIG-7K2M', from: 'guest-1', seq: 1, ext: 'roulette', op: 'snapshot', data: {},
  })
  assert.equal(snapshot.ok, true)
  assert.equal(JSON.stringify(snapshot.events).includes('"bullets":'), false)

  const duplicate = authority.handle({
    room: 'PIG-7K2M', from: 'host-1', seq: 2, ext: 'roulette', op: 'action', data: { op: 'arm' },
  })
  assert.equal(duplicate.ok, true)
  assert.deepEqual(duplicate.events, [])

  // 心跳只广播、不带对局快照；断线判定靠它。
  const ping = authority.handle({
    room: 'PIG-7K2M', from: 'guest-1', seq: 3, ext: 'roulette', op: 'ping', data: {},
  })
  assert.equal(ping.ok, true)
  assert.equal(ping.events[0].op, 'ping')
  assert.equal(ping.events[0].from, 'guest-1')
  assert.equal('view' in ping.events[0].data, false)
})

test('权威核心：一方心跳沉默 20 秒，权威替对手判认输并结束对局', () => {
  let clock = 1000
  const authority = createAuthority({ now: () => clock })
  assert.equal(authority.handle(createBody()).ok, true)
  clock += 21000
  const ping = authority.handle({ room: 'PIG-7K2M', from: 'guest-1', seq: 1, ext: 'roulette', op: 'ping', data: {} })
  assert.equal(ping.ok, true)
  const forfeit = ping.events.find(event => event.op === 'forfeit')
  assert.ok(forfeit, '应带一条判负事件')
  assert.equal(forfeit.data.view.stage, 'matchOver')
  assert.equal(forfeit.data.view.winner, 'guest')
  assert.equal(authority.handle({
    room: 'PIG-7K2M', from: 'stranger', seq: 1, ext: 'roulette', op: 'ping', data: {},
  }).reason, 'not-seat')
  assert.equal(authority.handle(createBody({
    data: { matchId: 'm2', guestId: 'guest-1', settings: { lives: 1, format: 'single', stake: 1000, loadCount: 1 } },
  })).ok, true, '对局结束后的再来一场应被接受')
})

test('权威核心：旧对局沉默 20 秒后，新房主可以重新开局', () => {
  let clock = 1000
  const authority = createAuthority({ now: () => clock })
  assert.equal(authority.handle(createBody()).ok, true)
  const settings = { lives: 1, format: 'single', stake: 1000, loadCount: 1 }
  clock += 19000
  assert.equal(authority.handle(createBody({
    from: 'owner-2', seq: 2,
    data: { matchId: 'm2', guestId: 'guest-2', settings },
  })).reason, 'create-rejected', '还没满 20 秒不能覆盖')
  clock += 2000
  const late = authority.handle(createBody({
    from: 'owner-2', seq: 3,
    data: { matchId: 'm2', guestId: 'guest-2', settings },
  }))
  assert.equal(late.ok, true, '沉默 21 秒后旧对局应被覆盖')
  assert.equal(late.events[0].data.view.hostId, 'owner-2')
})

test('权威核心：旧对局还有心跳时，新房主不能覆盖', () => {
  let clock = 1000
  const authority = createAuthority({ now: () => clock })
  assert.equal(authority.handle(createBody()).ok, true)
  clock += 15000
  assert.equal(authority.handle({
    room: 'PIG-7K2M', from: 'host-1', seq: 2, ext: 'roulette', op: 'ping', data: {},
  }).ok, true)
  const settings = { lives: 1, format: 'single', stake: 1000, loadCount: 1 }
  clock += 19000
  assert.equal(authority.handle(createBody({
    from: 'owner-2', seq: 4,
    data: { matchId: 'm2', guestId: 'guest-2', settings },
  })).reason, 'create-rejected', '距离上次心跳不到 20 秒')
  clock += 2000
  assert.equal(authority.handle(createBody({
    from: 'owner-2', seq: 5,
    data: { matchId: 'm2', guestId: 'guest-2', settings },
  })).ok, true, '心跳停止满 20 秒后可以覆盖')
})

test('权威核心：无对局、错误房间、错误扩展被拒绝', () => {
  const authority = createAuthority()
  assert.equal(authority.handle(createBody({ room: '' })).ok, false)
  assert.equal(authority.handle(createBody({ ext: 'farm' })).reason, 'bad-ext')
  assert.equal(authority.handle({ room: 'PIG-XXXX', from: 'a', seq: 1, ext: 'roulette', op: 'snapshot', data: {} }).reason, 'no-match')
})

test('权威核心：只有房间创建者能开局，缺少 owner 一律拒绝', () => {
  const authority = createAuthority()
  assert.equal(authority.handle(createBody({ from: 'guest-1', owner: false })).reason, 'not-owner')
  assert.equal(authority.handle(createBody({ owner: false })).reason, 'not-owner')
  assert.equal(authority.handle(createBody({ owner: undefined })).reason, 'not-owner', '旧版房间服务器不带 owner 时必须拒绝')
  assert.equal(authority.handle(createBody({ owner: null })).reason, 'not-owner')
  assert.equal(authority.handle(createBody({ owner: 0 })).reason, 'not-owner')
  assert.equal(authority.handle(createBody({ owner: 'false' })).reason, 'not-owner')
  assert.equal(authority.handle(createBody()).ok, true)
})

test('权威 HTTP：密钥、建房和动作走真实请求', async () => {
  const service = await startAuthority({ listen: '127.0.0.1', port: 0, secret: 'test-secret-0123456789' })
  const url = `http://127.0.0.1:${service.port}/v1/game`
  try {
    const denied = await fetch(url, { method: 'POST', headers: { 'x-room-authority': 'wrong-secret-0000' }, body: JSON.stringify(createBody()) })
    assert.equal(denied.status, 401)

    const created = await fetch(url, {
      method: 'POST',
      headers: { 'x-room-authority': 'test-secret-0123456789', 'content-type': 'application/json' },
      body: JSON.stringify(createBody()),
    })
    assert.equal(created.status, 200)
    const createdBody = await created.json()
    assert.equal(createdBody.ok, true)

    const arm = await fetch(url, {
      method: 'POST',
      headers: { 'x-room-authority': 'test-secret-0123456789', 'content-type': 'application/json' },
      body: JSON.stringify({ room: 'PIG-7K2M', from: 'host-1', seq: 2, ext: 'roulette', op: 'action', data: { op: 'arm' } }),
    })
    assert.equal(arm.status, 200)
    const armBody = await arm.json()
    assert.equal(armBody.events[0].op, 'arm')
    assert.equal(JSON.stringify(armBody).includes('"bullets":'), false)
  } finally {
    await service.close()
  }
})
