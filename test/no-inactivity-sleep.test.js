import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hatchEgg, mood, touch } from '../core.js'

const now = 1800000000000
for (const minutes of [31, 120, 1440]) {
  test(`When no interaction occurs for ${minutes} minutes, then inactivity alone never makes the pig sleep`, () => {
    const pig = hatchEgg(now)
    const awake = mood(pig, now).key
    pig.lastActiveAt = now - minutes * 60_000
    assert.equal(mood(pig, now).key, awake)
  })
}

test('When touching a long-inactive pig, then activity refreshes without a false waking announcement', () => {
  const pig = hatchEgg(now)
  pig.lastActiveAt = now - 120 * 60_000
  const pending = pig.pending.length
  assert.deepEqual(touch(pig, now), { ok: true, woke: false })
  assert.equal(pig.lastActiveAt, now)
  assert.equal(pig.pending.length, pending)
})
