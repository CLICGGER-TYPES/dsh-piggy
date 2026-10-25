import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGameChange } from '../stage/game-change.js'

function fixture(patch = {}) {
  const events = [], target = { version: '0.37.3' }
  const versions = { prepareInstall: async () => { events.push('prepare'); return target },
    current: () => ({ previous: '0.37.1' }),
    commitInstall: async () => events.push('commit'), rollback: () => { events.push('rollback'); return { ok: true, version: '0.37.1' } },
    discardPrepared: async () => events.push('discard') }
  const opts = { getVersions: () => versions, getHost: () => ({ dispose: async () => { events.push('save'); return { saved: true } } }),
    backup: async () => events.push('backup'), recover: async () => events.push('recover'),
    restart: () => events.push('restart'), isQuitting: () => false, setBusy() {}, onProgress() {}, log() {}, ...patch }
  return { target, events, versions, opts, change: createGameChange(opts) }
}

test('stage install/rollback only activate after save confirmation and backup', async () => {
  for (const kind of ['install', 'rollback']) {
    const f = fixture();assert.equal((await f.change[kind](f.target)).ok, true)
    assert.deepEqual(f.events, kind === 'install' ? ['prepare', 'save', 'backup', 'commit', 'restart'] : ['save', 'backup', 'rollback', 'restart'])
  }
})

test('stage refuses unsaved writer without activation or backup', async () => {
  const f = fixture({ getHost: () => ({ dispose: async () => ({ saved: false }) }) })
  assert.equal((await f.change.install(f.target)).ok, false)
  assert.deepEqual(f.events, ['prepare', 'discard'])
})

test('stage save error leaves the active version intact', async () => {
  const f = fixture({ getHost: () => ({ dispose: async () => { throw new Error('disk full') } }) })
  assert.equal((await f.change.install(f.target)).reason, 'disk full')
  assert.deepEqual(f.events, ['prepare', 'discard'])
})

test('backup failure restarts the saved original host without committing', async () => {
  const f = fixture({ backup: async () => { throw new Error('backup failed') } })
  assert.equal((await f.change.install(f.target)).ok, false)
  assert.deepEqual(f.events, ['prepare', 'save', 'recover', 'discard'])
})

test('stage change is serial and shutdown can wait for cancellation', async () => {
  let proceed, quitting = false
  const f = fixture({ isQuitting: () => quitting });f.versions.prepareInstall = () => new Promise(resolve => { proceed = resolve })
  const first = f.change.install(f.target)
  assert.equal((await f.change.rollback()).ok, false)
  quitting = true;const idle = f.change.idle();proceed(f.target)
  assert.equal((await first).ok, false);await idle
  assert.deepEqual(f.events, ['discard'])
})

test('failed rollback recovers the original host and reports the reason', async () => {
  const f = fixture();f.versions.rollback = () => ({ ok: false, reason: 'too old' })
  assert.equal((await f.change.rollback()).reason, 'too old')
  assert.deepEqual(f.events, ['save', 'backup', 'recover'])
})
