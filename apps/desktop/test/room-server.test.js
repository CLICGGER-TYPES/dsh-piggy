// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createRoomClient } from '../lib/room-client.js'
import { startRoomServer } from '../lib/room-server.js'

const PROFILE_A = { name: '猪猪', level: 60, stage: 'piglet', art: 'pigs/base/piglet/idle.png', size: 1 }
const PROFILE_B = { name: '团子', level: 42, stage: 'piglet', art: '', size: 1 }

test('房间服务：两位玩家加入、长轮询、移动、摸摸、离开', async () => {
  const server = await startRoomServer({ code: '7K2M', listenAddress: '127.0.0.1' })
  const baseUrl = `http://127.0.0.1:${server.status().port}`
  const first = createRoomClient({ baseUrl, code: '7K2M', profile: PROFILE_A })
  const second = createRoomClient({ baseUrl, code: '7K2M', profile: PROFILE_B })
  try {
    const joinedA = await first.join()
    assert.equal(joinedA.players.length, 1)
    assert.equal(joinedA.players[0].host, true)
    assert.equal(joinedA.players[0].name, '猪猪')
    assert.equal(typeof joinedA.token, 'string')

    const waiting = first.wait(joinedA.version)
    await new Promise(resolve => setTimeout(resolve, 80))
    const joinedB = await second.join()
    assert.equal(joinedB.players.length, 2)
    const roster = await waiting
    assert.equal(roster.status, 200)
    assert.equal(roster.body.players.length, 2)
    assert.equal(roster.body.players[1].name, '团子')

    const beforeMove = roster.body.version
    const moveWait = first.wait(beforeMove)
    const moved = await second.update({ x: 0.82, facing: -1 })
    assert.equal(moved.status, 200)
    const afterMove = await moveWait
    const guest = afterMove.body.players.find(player => player.id === joinedB.playerId)
    assert.equal(guest.x, 0.82)
    assert.equal(guest.facing, -1)

    const patWait = second.wait(afterMove.body.version)
    const pat = await first.update({ x: 0.2, facing: 1, emote: 'pat', targetId: joinedB.playerId })
    assert.equal(pat.status, 200)
    const afterPat = await patWait
    const host = afterPat.body.players.find(player => player.id === joinedA.playerId)
    assert.equal(host.emote, 'pat')
    assert.equal(host.emoteTarget, joinedB.playerId)
    assert.ok(host.emoteAt > 0)

    const leaveWait = first.wait(afterPat.body.version)
    const left = await second.leave()
    assert.equal(left.status, 200)
    const afterLeave = await leaveWait
    assert.equal(afterLeave.body.players.length, 1)

    assert.equal(server.snapshot().players.length, 1)
    assert.equal(server.snapshot().room.hostId, joinedA.playerId)
  } finally {
    await first.close()
    await second.close().catch(() => {})
    await server.close()
  }
})

test('房间码错误、重复 clientId 被拒绝，token 不出现在玩家列表', async () => {
  const server = await startRoomServer({ code: '7K2M', listenAddress: '127.0.0.1' })
  const baseUrl = `http://127.0.0.1:${server.status().port}`
  const good = createRoomClient({ baseUrl, code: '7K2M', profile: PROFILE_A, clientId: 'shared-client' })
  const wrong = createRoomClient({ baseUrl, code: 'ABCD', profile: PROFILE_B })
  const duplicate = createRoomClient({ baseUrl, code: '7K2M', profile: PROFILE_B, clientId: 'shared-client' })
  try {
    await good.join()
    const snapshot = server.snapshot()
    assert.equal('token' in snapshot.players[0], false)
    assert.equal('clientId' in snapshot.players[0], false)
    await assert.rejects(() => wrong.join(), /房间码|room-code|invalid/i)
    await assert.rejects(() => duplicate.join(), /client-already-joined/i)
  } finally {
    await good.close()
    await wrong.close().catch(() => {})
    await duplicate.close().catch(() => {})
    await server.close()
  }
})

test('房主离开会关闭房间，其余客户端收到 room-closed', async () => {
  const server = await startRoomServer({ code: '7K2M', listenAddress: '127.0.0.1' })
  const baseUrl = `http://127.0.0.1:${server.status().port}`
  const host = createRoomClient({ baseUrl, code: '7K2M', profile: PROFILE_A })
  const guest = createRoomClient({ baseUrl, code: '7K2M', profile: PROFILE_B })
  try {
    const joinedHost = await host.join()
    const joinedGuest = await guest.join()
    const waiting = guest.wait(joinedGuest.version)
    await host.leave()
    const closed = await waiting
    assert.equal(closed.status, 410)
    assert.equal(closed.body.reason, 'host-left')
    assert.equal(server.status().running, false)
    assert.ok(joinedHost.playerId.length > 0)
  } finally {
    await host.close().catch(() => {})
    await guest.close().catch(() => {})
    await server.close()
  }
})
