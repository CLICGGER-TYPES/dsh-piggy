// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createUpdateNotice, newestRelease } from '../src/client/update-notice.js'

test('newestRelease ignores prereleases and compares numeric versions', () => {
  const found = newestRelease([
    { version: '0.9.9', prerelease: false },
    { version: '0.11.0', prerelease: true },
    { version: '0.10.0', prerelease: false },
  ])
  assert.equal(found.version, '0.10.0')
})

test('a new version stays unread until the update app is opened, then stays read', async () => {
  const saved = new Map()
  const bubbles = []
  const notice = createUpdateNotice({
    currentVersion: () => '0.26.0',
    getDesktop: () => null,
    fetchLatest: async () => ({ version: '0.27.0', page: 'release', notes: 'new', prerelease: false }),
    read: key => saved.get(key) ?? null,
    write: (key, value) => saved.set(key, value),
    canBubble: () => true,
    showBubble: text => bubbles.push(text),
    changed: () => {},
  })
  await notice.check()
  assert.equal(notice.unread, true)
  assert.match(bubbles[0], /v0\.27\.0/)
  notice.markRead()
  assert.equal(notice.unread, false)
  await notice.check()
  assert.equal(notice.unread, false)
  assert.equal(bubbles.length, 1, 'the same release does not speak twice')
})

test('desktop notices include a newer recommended shell even when the game is current', async () => {
  const desktop = {
    updates: {
      current: async () => ({ version: '0.26.0', shell: '0.1.2' }),
      list: async () => ({ ok: true, releases: [
        { version: '0.26.0', prerelease: false, shellUpdate: true, latestShell: '0.1.3', page: 'release' },
      ] }),
    },
  }
  const notice = createUpdateNotice({
    currentVersion: () => '0.26.0', getDesktop: () => desktop,
    fetchLatest: async () => null, read: () => null, write: () => {},
    canBubble: () => false, showBubble: () => {}, changed: () => {},
  })
  await notice.check()
  assert.equal(notice.unread, true)
  assert.equal(notice.latest.latestShell, '0.1.3')
  assert.equal(notice.latest.kind, 'shell')
})

test('an update found while its app is open is immediately treated as read', async () => {
  const saved = new Map()
  const bubbles = []
  const notice = createUpdateNotice({
    currentVersion: () => '0.26.0', getDesktop: () => null,
    fetchLatest: async () => ({ version: '0.27.0', page: 'release', prerelease: false }),
    read: key => saved.get(key) ?? null, write: (key, value) => saved.set(key, value),
    canBubble: () => true, showBubble: text => bubbles.push(text), changed: () => {}, isViewing: () => true,
  })
  await notice.check()
  assert.equal(notice.unread, false)
  assert.equal(bubbles.length, 0)
})

test('web mode asks for the latest release at most once per six hours and falls back to the saved one', async () => {
  const { cachedLatest, LATEST_CACHE_MS } = await import('../src/client/update-notice.js')
  const box = new Map()
  let clock = 1_000_000
  let calls = 0
  let failing = false
  const store = { read: key => box.get(key) ?? null, write: (key, value) => box.set(key, value), now: () => clock }
  const fetchLatest = async () => { calls += 1; if (failing) throw new Error('GitHub 403'); return { version: '0.34.1' } }
  assert.equal((await cachedLatest(fetchLatest, store)).version, '0.34.1')
  assert.equal((await cachedLatest(fetchLatest, store)).version, '0.34.1')
  assert.equal(calls, 1, 'a page reload within six hours does not ask again')
  clock += LATEST_CACHE_MS + 1
  failing = true
  assert.equal((await cachedLatest(fetchLatest, store)).version, '0.34.1', 'rate limited: keep the saved answer')
  assert.equal(calls, 2)
})
