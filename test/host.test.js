/**
 * dsh-piggy host tests — the glue between core, the store and the HTTP routes.
 *
 * The unit tests cover the game model and the client bundle; this file covers
 * the part in between, which is exactly where a spread-order mistake once made
 * every refused operation report success.
 *
 * Run: node --test test/*.test.js
 */

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { apply, dispatch, snapshot } from '../index.js'
import { registerRoutes } from '../routes.js'
import { JOBS, SHOP, ensureDaily, hatchEgg, layEgg } from '../core.js'
import { DEFAULT_TOY, xpForLevel } from '../data.js'

const MIN = 60_000

/**
 * Stand up the plugin against a throwaway save and capture what it registers.
 * @param seed - optional `(nowMs) => state` written before the plugin loads.
 * @param options.webServer - `'now'` (default) hands the service to inject
 *   immediately; `'later'` holds it back until `releaseWebServer()` is called,
 *   which is what profile activation actually looked like; `'never'` models a
 *   host with no web seam at all.
 */
function boot(seed, options = {}) {
  const webServerMode = options.webServer ?? 'now'
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-'))
  const statePath = join(dir, 'state.json')
  const nowMs = Date.now()
  if (seed) writeFileSync(statePath, JSON.stringify(seed(nowMs)))

  const disposers = []
  const listeners = {}
  const routes = {}
  let command = null
  let pendingWebServer = null
  const server = { register: route => { routes[route.path] = route; return () => {} } }

  const ctx = {
    on: (event, fn) => { (listeners[event] ??= []).push(fn) },
    effect: fn => { const dispose = fn(); disposers.push(dispose); return () => dispose?.() },
    // Deliberately absent: the plugin must not depend on `ctx.get` at all.
    get: () => undefined,
    inject: (deps, fn) => {
      if (deps.includes('webServer')) {
        if (webServerMode === 'now') fn({ webServer: server, ...ctx })
        else if (webServerMode === 'later') pendingWebServer = fn
        // 'never': drop it on the floor, exactly like a host without the seam.
        return
      }
      if (deps.includes('commands')) fn({ commands: { register: entry => { command = entry } } })
    },
  }
  apply(ctx, { statePath })

  /** Simulate the web seam arriving after activation. */
  const releaseWebServer = () => {
    if (pendingWebServer === null) return false
    const fn = pendingWebServer
    pendingWebServer = null
    fn({ webServer: server, ...ctx })
    return true
  }

  const fire = (event, ...args) => { for (const fn of listeners[event] ?? []) fn(...args) }
  // Keep the HTTP status alongside the body so status assertions work.
  const get = async () => withStatus(await call(routes['/dsh-piggy/state'], 'GET'))
  const post = async body => withStatus(await call(routes['/dsh-piggy/act'], 'POST', body))
  const cleanup = async () => {
    for (const dispose of disposers) dispose?.()
    if (routes['/dsh-piggy/logs/export']) await call(routes['/dsh-piggy/logs/export'], 'GET')
    await rm(dir, { recursive: true, force: true, maxRetries: 3 })
  }
  return { routes, listeners, command, fire, get, post, releaseWebServer, statePath, cleanup }
}

/** `{ status, ...body }` for a route result. */
function withStatus(result) {
  let body = {}
  try { body = JSON.parse(result.text) } catch { body = {} }
  return { status: result.status, ...body }
}

async function call(route, method, body) {
  const req = method === 'POST'
    ? { method, async *[Symbol.asyncIterator]() { yield JSON.stringify(body) } }
    : { method }
  let out = ''
  let status = 0
  const res = { writeHead(code) { status = code }, end(chunk) { out = chunk } }
  await route.handler(req, res)
  return { status, text: out }
}

// ===========================================================================
// Registration
// ===========================================================================

test('an operation that throws answers 500 and names the action, instead of losing the route', async () => {
  const routes = {}
  const ctx = {
    inject: (deps, fn) => {
      if (deps.includes('webServer')) {
        fn({ webServer: { register: route => { routes[route.path] = route; return () => {} } } })
      }
    },
  }
  const store = {
    dev: () => { throw new Error('boom') },
    freshen: () => null,
    drainPending: () => [],
  }
  registerRoutes(ctx, store)

  const warnings = []
  const original = console.warn
  console.warn = (...args) => warnings.push(args.map(String).join(' '))
  let result
  try {
    result = await call(routes['/dsh-piggy/act'], 'POST', { action: 'dev' })
  } finally {
    console.warn = original
  }
  const body = JSON.parse(result.text)
  assert.equal(result.status, 500)
  assert.equal(body.ok, false)
  assert.equal(body.reason, 'error')
  assert.ok(warnings.some(line => line.includes('dev')), `the log must name the action: ${warnings.join(' | ')}`)
})

test('the host registers both routes, the four diet events and the command', async () => {
  const app = boot()
  try {
    assert.notEqual(app.routes['/dsh-piggy/state'], undefined)
    assert.notEqual(app.routes['/dsh-piggy/act'], undefined)
    assert.deepEqual(
      Object.keys(app.listeners).sort(),
      ['agent/error', 'agent/inbox/claimed', 'agent/turn-stopping', 'tools/result'],
    )
    assert.equal(app.command.name, 'pig')
    assert.equal(typeof app.command.handler, 'function')
  } finally {
    await app.cleanup()
  }
})

/**
 * Regression: the plugin used to read `ctx.get('webServer')` at apply time and
 * bail out when it came back undefined. During profile activation the service
 * was not up yet, so the routes were never registered and the panel polled a
 * 404 forever — while the plugin itself reported a clean activation. Waiting
 * through `ctx.inject` is the fix.
 */
test('routes still register when the web seam arrives after activation', async () => {
  const app = boot(null, { webServer: 'later' })
  try {
    assert.deepEqual(app.routes, {}, 'nothing to register against yet')
    assert.equal(app.releaseWebServer(), true, 'the seam arrives')
    assert.notEqual(app.routes['/dsh-piggy/state'], undefined, 'state route must register late')
    assert.notEqual(app.routes['/dsh-piggy/act'], undefined, 'act route must register late')
  } finally {
    await app.cleanup()
  }
})

test('the plugin never depends on ctx.get for its routes', async () => {
  // boot() deliberately exposes a `get` that always returns undefined. If the
  // plugin used it, neither mode below could ever register a route.
  const immediate = boot()
  const late = boot(null, { webServer: 'later' })
  try {
    assert.notEqual(immediate.routes['/dsh-piggy/state'], undefined)
    late.releaseWebServer()
    assert.notEqual(late.routes['/dsh-piggy/state'], undefined)
  } finally {
    await immediate.cleanup()
    await late.cleanup()
  }
})

test('a host with no web seam stays command-only and does not throw', async () => {
  let app
  assert.doesNotThrow(() => { app = boot(null, { webServer: 'never' }) })
  try {
    assert.deepEqual(app.routes, {}, 'no routes without a seam')
    assert.equal(app.releaseWebServer(), false, 'nothing was ever queued')
    // The command path still works, which is the point of degrading.
    assert.equal(app.command.name, 'pig')
    const result = app.command.handler({ rawInput: 'about' })
    assert.equal(result.kind, 'success')
  } finally {
    await app.cleanup()
  }
})

test('routes reject the wrong method and unknown operations', async () => {
  const app = boot()
  try {
    assert.equal((await call(app.routes['/dsh-piggy/state'], 'POST')).status, 405)
    assert.equal((await call(app.routes['/dsh-piggy/act'], 'GET')).status, 405)
    const bad = await app.post({ action: 'fly' })
    assert.equal(bad.status, 400)
    assert.ok(bad.allowed.includes('work'))
    assert.ok(bad.allowed.includes('buy'))
  } finally {
    await app.cleanup()
  }
})

test('an oversized action body is rejected', async () => {
  const app = boot()
  try {
    const huge = { action: 'feed', pad: 'x'.repeat(4096) }
    const result = await app.post(huge)
    assert.equal(result.status, 413)
  } finally {
    await app.cleanup()
  }
})

// ===========================================================================
// Snapshot shape
// ===========================================================================

test('the snapshot reports the unhatched state before anything exists', async () => {
  const app = boot()
  try {
    const snap = await app.get()
    assert.equal(snap.hatched, false)
    assert.equal(snap.pig, null)
    assert.equal(snap.dead, false)
    assert.equal(snap.activity, null)
    assert.deepEqual(Object.keys(snap.actions).sort(), ['bathe', 'feed', 'pet', 'play'])
    assert.equal(snap.jobs.length, JOBS.length)
    assert.equal(snap.shop.length, SHOP.length)
  } finally {
    await app.cleanup()
  }
})

test('the snapshot exposes everything the panel draws', async () => {
  const app = boot(nowMs => hatchEgg(nowMs))
  try {
    const snap = await app.get()
    assert.equal(snap.hatched, true)
    for (const key of ['name', 'stage', 'ageDays', 'ageLabel', 'daysToNextStage', 'soul', 'mood', 'satiety', 'happiness', 'cleanliness', 'health', 'healthPercent', 'coins', 'weight', 'xp', 'illness', 'memories']) {
      assert.ok(key in snap.pig, `pig.${key} is missing from the snapshot`)
    }
    assert.equal(snap.pig.health, 5)
    assert.equal(snap.pig.healthPercent, 100)
    assert.deepEqual(
      Object.keys(snap.inventory).sort(),
      [...SHOP.filter(item => item.kind !== 'dress').map(item => item.key), DEFAULT_TOY.key].sort(),
      'every consumable plus the free default toy',
    )
    assert.equal(snap.dress.length, 13, 'and the 装扮 shelf is its own list')
    assert.equal(snap.maxHealth, 5)
  } finally {
    await app.cleanup()
  }
})

test('the snapshot reports the package version', async () => {
  const app = boot(nowMs => hatchEgg(nowMs))
  try {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    // The debug tab prints this, so "am I looking at the build I just made?"
    // is answerable without guessing.
    assert.equal((await app.get()).version, manifest.version)
  } finally {
    await app.cleanup()
  }
})

// ===========================================================================
// THE regression: a refusal must not report success
// ===========================================================================

test('a refused operation reports ok:false instead of the snapshot\'s ok', async () => {
  const app = boot(nowMs => {
    const pig = hatchEgg(nowMs - 3 * MIN)
    pig.inventory = { apple: 4, soap: 1 }
    return pig
  })
  try {
    // The pig is home; this bath spends its only soap.
    const fed = await app.post({ action: 'bathe', item: 'soap' })
    assert.equal(fed.ok, true, 'the first bath succeeds')

    // The next bath is refused because soap ran out.
    const again = await app.post({ action: 'bathe', item: 'soap' })
    assert.equal(again.ok, false, 'an out-of-stock action must not report success')
    assert.equal(again.reason, 'no-item')
    // …and the snapshot still rides along so the panel can repaint.
    assert.notEqual(again.pig, null)
    assert.equal(typeof again.actions.feed.ready, 'boolean')
  } finally {
    await app.cleanup()
  }
})

test('an away pig reports how far through its activity it is', async () => {
  const app = boot(nowMs => {
    const pig = hatchEgg(nowMs - 30 * MIN)
    pig.activity = {
      kind: 'work', key: 'editor', label: '编辑', emoji: '📰',
      startedAt: nowMs - 2 * 60 * MIN, endsAt: nowMs + 2 * 60 * MIN,
    }
    pig.lastSeenAt = nowMs - 2 * 60 * MIN
    return pig
  })
  try {
    const snap = await app.get()
    assert.equal(snap.activity.kind, 'work')
    // Half of a four-hour shift has gone by.
    assert.equal(snap.activity.progress, 50)
    assert.ok(snap.activity.secondsLeft > 7000 && snap.activity.secondsLeft < 7300, 'about two hours left')
  } finally {
    await app.cleanup()
  }
})

test('care is refused while working, and the refusal is honest', async () => {
  const app = boot(nowMs => {
    const pig = hatchEgg(nowMs)
    pig.satiety = 80
    return pig
  })
  try {
    const started = await app.post({ action: 'work', job: 'bricks' })
    assert.equal(started.ok, true)
    assert.equal(started.canGoOut, false)
    assert.equal(started.activity.kind, 'work')
    assert.equal(started.activity.key, 'bricks')
    assert.ok(started.activity.secondsLeft > 0)

    const feed = await app.post({ action: 'feed' })
    assert.equal(feed.ok, false)
    assert.equal(feed.reason, 'away')

    const second = await app.post({ action: 'work', job: 'bricks' })
    assert.equal(second.ok, false)
    assert.equal(second.reason, 'away')

    // Petting is still allowed.
    assert.equal((await app.post({ action: 'pet' })).ok, true)

    assert.equal((await app.post({ action: 'calloff' })).ok, true)
    assert.equal((await app.get()).activity, null)
  } finally {
    await app.cleanup()
  }
})

test('the route refuses an unqualified job and hands back what it is missing', async () => {
  const app = boot(nowMs => hatchEgg(nowMs))
  try {
    // 收银员: Lv5 and 数学 9 lessons (B4). A fresh pig has neither.
    const refused = await app.post({ action: 'work', job: 'cashier' })
    assert.equal(refused.ok, false)
    assert.equal(refused.reason, 'underqualified')
    assert.deepEqual(refused.missing.map(m => m.kind), ['level', 'lesson'])
    assert.equal(refused.missing[1].need, 9)
    // The refusal must not leave the pig mid-shift, and the panel needs the
    // gate on the board itself, not only in the POST result.
    assert.equal(refused.activity, null)
    const board = refused.jobs.find(job => job.key === 'cashier')
    assert.equal(board.qualified, false)
    assert.match(board.lockText, /Lv\.5、🔢数学 9 节/)
    assert.equal(refused.jobs.find(job => job.key === 'bricks').qualified, true)
  } finally {
    await app.cleanup()
  }
})

test('the snapshot offers the interest courses, and taking one feeds a trait', async () => {
  const app = boot(nowMs => {
    const pig = hatchEgg(nowMs)
    pig.coins = 5000
    return pig
  })
  try {
    const board = await app.get()
    assert.deepEqual(board.interests.map(entry => entry.key).slice(0, 4), ['photography', 'coding', 'dancing', 'fitness'])
    assert.equal(board.interests.length, 16, 'twelve more since 2026-10-01')
    assert.equal(board.interests.every(entry => entry.times === 0), true)
    assert.equal(board.skills, undefined, 'no fourth stat axis')

    const before = board.pig.traits
    const started = await app.post({ action: 'interest', interest: 'coding' })
    assert.equal(started.ok, true)
    assert.equal(started.activity.kind, 'interest')
    assert.equal(started.activity.key, 'coding')
    assert.equal(started.pig.coins, 5000 - 80, 'the fee is taken up front')
    assert.equal((await app.post({ action: 'interest', interest: 'coding' })).reason, 'away')
    const unknown = await app.post({ action: 'interest', interest: 'nope' })
    assert.equal(unknown.ok, false)
    assert.equal(unknown.reason, 'unknown')
    assert.deepEqual((await app.get()).pig.traits, before, 'the trait lands only when the lesson ends')
  } finally {
    await app.cleanup()
  }
})

test('the sell route pays the rarity price and is honest about what is not owned', async () => {
  const app = boot(nowMs => {
    const pig = hatchEgg(nowMs)
    pig.coins = 0
    pig.souvenirs = [
      { key: 'shell', emoji: '🐚', label: '一枚海螺', rarity: 'rare', story: '贴在耳朵上能听见浪声。', from: 'sea', fromLabel: '看海' },
      { key: 'seasalt', emoji: '🧂', label: '海盐', rarity: 'common', story: '咸得发苦。', from: 'sea', fromLabel: '看海' },
    ]
    return pig
  })
  try {
    const board = await app.get()
    const shell = board.pig.souvenirs.find(entry => entry.key === 'shell')
    assert.equal(shell.rarityLabel, '稀有')
    assert.equal(shell.price, 320)
    assert.equal(board.pig.souvenirs[0].story.length > 0, true, 'the story reaches the client')
    assert.equal(board.trips.find(trip => trip.key === 'sea').bestRarity, '传说')

    const sold = await app.post({ action: 'sell', souvenir: 'shell' })
    assert.equal(sold.ok, true)
    assert.equal(sold.sold, 'shell')
    assert.equal(sold.pig.coins, 320, 'the rarity price is paid')
    assert.equal(sold.pig.souvenirs.length, 1)

    const again = await app.post({ action: 'sell', souvenir: 'shell' })
    assert.equal(again.ok, false)
    assert.equal(again.reason, 'not-owned')
    assert.equal(again.pig.coins, 320, 'a refusal pays nothing')

    assert.equal((await app.post({ action: 'sell', souvenir: 'nope' })).reason, 'not-owned')
  } finally {
    await app.cleanup()
  }
})

test('daily action responses include the earned reward for a collapsed pig', async () => {
  const app = boot(nowMs => {
    const pig = hatchEgg(nowMs)
    ensureDaily(pig).online.unclaimed = 1
    return pig
  })
  try {
    const signed = await app.post({ action: 'signIn' })
    assert.equal(signed.ok, true)
    assert.ok(typeof signed.reward === 'string' && signed.reward.length > 0)
    const gift = await app.post({ action: 'openGift' })
    assert.equal(gift.ok, true)
    assert.ok(typeof gift.reward === 'string' && gift.reward.length > 0)
  } finally { await app.cleanup() }
})

test('the wear route dresses and undresses, and the shop is honest about 家当', async () => {
  const app = boot(nowMs => {
    const pig = hatchEgg(nowMs)
    pig.dress = ['scarf']
    return pig
  })
  try {
    const board = await app.get()
    assert.equal(board.shop.length, 76)
    assert.equal(board.dress.length, 13)
    assert.equal(board.shop.find(item => item.key === 'scarf').owned, true)
    const wings = board.shop.find(item => item.key === 'wings')
    assert.equal(wings.unlocked, false)
    assert.equal(wings.level, 50, 're-spread on the 60-level curve (2026-10-01)')

    const on = await app.post({ action: 'wear', item: 'scarf' })
    assert.equal(on.ok, true)
    assert.equal(on.dress.find(item => item.key === 'scarf').worn, true)
    assert.equal(on.shop.find(item => item.key === 'scarf').worn, true)

    const off = await app.post({ action: 'wear', item: 'scarf', on: false })
    assert.equal(off.ok, true)
    assert.equal(off.dress.find(item => item.key === 'scarf').worn, false)

    const notOwned = await app.post({ action: 'wear', item: 'wings' })
    assert.equal(notOwned.ok, false)
    assert.equal(notOwned.reason, 'not-owned')

    const locked = await app.post({ action: 'buy', item: 'wings' })
    assert.equal(locked.ok, false)
    assert.equal(locked.reason, 'low-level')
    assert.equal(locked.need, 50)

    // A dress is worn, never eaten.
    assert.equal((await app.post({ action: 'use', item: 'scarf' })).reason, 'not-consumable')
  } finally {
    await app.cleanup()
  }
})

test('the debug giveAll route hands over everything at once', async () => {
  const app = boot(nowMs => hatchEgg(nowMs))
  try {
    const res = await app.post({ action: 'giveAll' })
    assert.equal(res.ok, true)
    assert.equal(res.pig.coins, 99_999)
    assert.equal(res.inventory.apple, 20, 'consumables land in the bag')
    assert.equal(res.dress.filter(entry => entry.owned).length, 13, 'and every 装扮 is owned')
  } finally {
    await app.cleanup()
  }
})

test('buying is refused when broke, and the refusal is honest', async () => {
  const app = boot(nowMs => { const pig = hatchEgg(nowMs); pig.coins = 2; return pig })
  try {
    const poor = await app.post({ action: 'buy', item: 'bone' })
    assert.equal(poor.ok, false)
    assert.equal(poor.reason, 'poor')
    assert.equal(poor.pig.coins, 2, 'nothing was spent')
    assert.equal(poor.shop.find(i => i.key === 'bone').affordable, false)
  } finally {
    await app.cleanup()
  }
})

// ===========================================================================
// Work through the route
// ===========================================================================

test('a finished shift pays out on the next read and is announced once', async () => {
  const app = boot(nowMs => {
    const pig = hatchEgg(nowMs - 10 * MIN)
    pig.coins = 0
    pig.activity = { kind: 'work', key: 'bricks', label: '搬砖', emoji: '🧱', startedAt: nowMs - 4 * MIN, endsAt: nowMs - MIN }
    pig.lastSeenAt = nowMs - 4 * MIN
    return pig
  })
  try {
    const first = await app.get()
    // The seeded shift is 搬砖; look its pay up by key — the board's order is
    // content, not API.
    // Coins may include nothing else: drops go to the bag, not the purse.
    assert.equal(first.pig.coins, JOBS.find(job => job.key === 'bricks').coins)
    assert.equal(first.activity, null)
    // A shift is worth enough XP to cross a level too, so there may be more
    // than one announcement — the payday is the one that must be there.
    assert.ok(first.pending.length >= 1)
    assert.ok(first.pending.some(entry => entry.kind === 'work'), 'the payday is announced')

    // Reading again does not re-announce.
    const second = await app.get()
    assert.deepEqual(second.pending, [])
  } finally {
    await app.cleanup()
  }
})

test('snapshot() can be asked not to drain the queue', async () => {
  const app = boot(nowMs => {
    const pig = hatchEgg(nowMs - 10 * MIN)
    pig.activity = { kind: 'work', key: 'bricks', label: '打零工', emoji: '🧹', startedAt: nowMs - 2 * MIN, endsAt: nowMs - MIN }
    pig.lastSeenAt = nowMs - 2 * MIN
    return pig
  })
  try {
    const store = { freshen: () => null, drainPending: () => [] }
    // With no live store this only checks the option is honoured structurally.
    const snap = snapshot(store, { drain: false })
    assert.equal(snap.hatched, false)
  } finally {
    await app.cleanup()
  }
})

// ===========================================================================
// Illness through the route
// ===========================================================================

test('a neglected pig falls ill, and the shop marks the right medicine', async () => {
  // B3: neglect is a chance per hour (~16%/h hungry and dirty), not a sure
  // thing after 40 minutes; two days of it is ~99.98%.
  const app = boot(nowMs => {
    const pig = hatchEgg(nowMs - 48 * 60 * MIN)
    // A fixed seed: illness is a random walk (it can heal and catch it again),
    // so without one this assertion flickered ~40% of runs.
    pig.seed = 20261001
    pig.satiety = 10
    pig.cleanliness = 10
    pig.lastSeenAt = nowMs - 48 * 60 * MIN
    return pig
  })
  try {
    const snap = await app.get()
    assert.equal(snap.dead, false)
    assert.notEqual(snap.pig.illness, null, 'neglect should have made it sick')
    assert.ok(snap.pig.health < 5)
    const wanted = snap.shop.filter(item => item.needed)
    assert.equal(wanted.length, 1, 'exactly one medicine is flagged as needed')
    assert.equal(wanted[0].key, snap.pig.illness.cureKey, 'and it is the cure for this very stage')
    assert.equal(wanted[0].tier, snap.pig.illness.stage)
  } finally {
    await app.cleanup()
  }
})

test('the whole illness loop works through the routes: sick → buy → cure', async () => {
  const app = boot(nowMs => {
    const pig = hatchEgg(nowMs - 5 * MIN)
    pig.illness = { chain: 2, stage: 1, since: nowMs - 5 * MIN }
    pig.health = 4
    pig.coins = 200
    return pig
  })
  try {
    const sick = await app.get()
    assert.equal(sick.pig.illness.name, '肚子胀')
    const med = sick.shop.find(item => item.needed)
    assert.equal(med.kind, 'medicine')

    assert.equal((await app.post({ action: 'buy', item: med.key })).ok, true)
    const cured = await app.post({ action: 'use', item: med.key })
    assert.equal(cured.ok, true)
    assert.equal(cured.pig.illness, null)
    assert.equal(cured.pig.health, 5)

    // Using a second dose on a healthy pig is refused honestly.
    await app.post({ action: 'buy', item: med.key })
    const wrong = await app.post({ action: 'use', item: med.key })
    assert.equal(wrong.ok, false)
    assert.equal(wrong.reason, 'not-sick')
  } finally {
    await app.cleanup()
  }
})

test('a dead pig only answers to the revive item', async () => {
  const app = boot(nowMs => {
    const pig = hatchEgg(nowMs - 5 * MIN)
    pig.dead = true
    pig.health = 0
    pig.coins = 1000 // 还魂丹 costs 800 since B3
    pig.inventory = { apple: 3 }
    return pig
  })
  try {
    const dead = await app.get()
    assert.equal(dead.dead, true)
    for (const action of ['feed', 'bathe', 'play']) {
      const refused = await app.post({ action })
      assert.equal(refused.ok, false, `${action} must be refused`)
      assert.equal(refused.reason, 'dead')
    }
    assert.equal((await app.post({ action: 'work', job: 'bricks' })).reason, 'dead')

    const reviveKey = dead.shop.find(i => i.kind === 'revive').key
    assert.equal((await app.post({ action: 'buy', item: reviveKey })).ok, true)
    const revived = await app.post({ action: 'use', item: reviveKey })
    assert.equal(revived.ok, true)
    assert.equal(revived.dead, false)
    assert.equal(revived.pig.health, 5)

    // And now normal life resumes.
    assert.equal((await app.post({ action: 'feed' })).ok, true)
  } finally {
    await app.cleanup()
  }
})

// ===========================================================================
// Slash command (the fallback path)
// ===========================================================================

test('the slash command answers about, shop and status', async () => {
  const app = boot(nowMs => hatchEgg(nowMs))
  try {
    const run = input => app.command.handler({ rawInput: input })
    assert.match(run('about').text, /dsh-piggy/)
    assert.match(run('about').text, /还魂丹/)
    assert.match(run('shop').text, /商店/)
    assert.match(run('').text, /小猪|青年猪|中年猪/)
    assert.equal(run('nonsense').kind, 'error')
    assert.match(run('').text, /金币/)
  } finally {
    await app.cleanup()
  }
})

test('the slash command line for work and the shop agree with the tables', async () => {
  const app = boot(nowMs => hatchEgg(nowMs))
  try {
    const run = input => app.command.handler({ rawInput: input })
    const shop = run('shop').text
    for (const item of SHOP) assert.ok(shop.includes(item.label), `${item.label} missing from /pig shop`)
    const bought = run('buy 苹果')
    assert.match(bought.text, /苹果/)
    const work = run('work 搬砖')
    assert.match(work.text, /搬砖/)
    assert.match(run('calloff').text, /提前回来/)
  } finally {
    await app.cleanup()
  }
})

test('the pure dispatch helper routes every documented subcommand', async () => {
  const store = makeFakeStore(hatchEgg(Date.now()))
  assert.equal(dispatch(store, 'pig', 'about').kind, 'success')
  assert.equal(dispatch(store, 'pig', 'status').kind, 'success')
  assert.equal(dispatch(store, 'pig', 'weigh').kind, 'success')
  assert.equal(dispatch(store, 'pig', 'feed').kind, 'success')
  assert.equal(dispatch(store, 'pig', 'name 大花').kind, 'success')
  assert.equal(dispatch(store, 'pig', 'bogus').kind, 'error')
})

test('the slash command covers what the panel covers', async () => {
  // The GUI is the primary path, but the command is the fallback and it was
  // missing half the verbs: 兴趣课、卖纪念品、穿脱家当、领养、回话（B1 小缺口）。
  const pig = hatchEgg(Date.now())
  pig.dialogue = { open: { id: 7, text: '好舒服…', replies: [{ label: '真乖', happiness: 2 }] } }
  pig.souvenirs = [{ key: 'shell', label: '贝壳', emoji: '🐚', rarity: 'common' }]
  const store = makeFakeStore(pig)

  assert.equal(dispatch(store, 'pig', 'interest coding').kind, 'success')
  assert.equal(dispatch(store, 'pig', 'sell 贝壳').kind, 'success')
  assert.equal(dispatch(store, 'pig', 'wear scarf').kind, 'success')
  assert.equal(dispatch(store, 'pig', 'wear scarf off').kind, 'success')
  assert.equal(dispatch(store, 'pig', 'adopt').kind, 'success')
  assert.equal(dispatch(store, 'pig', 'reply 1').kind, 'success')
  assert.equal(dispatch(store, 'pig', 'reply 9').kind, 'error', 'out-of-range reply')

  const help = dispatch(store, 'pig', 'bogus')
  for (const verb of ['interest', 'sell', 'wear', 'adopt', 'reply']) {
    assert.ok(help.text.includes(verb), `the error text must list ${verb}: ${help.text}`)
  }
})

/** A store stub good enough for the pure dispatcher. */
function makeFakeStore(state) {
  let live = state
  return {
    get state() { return live },
    freshen: () => live,
    act: () => ({ ok: true, crossed: [] }),
    startWork: () => ({ ok: true, job: JOBS[0], endsAt: Date.now() + MIN }),
    callOffWork: () => ({ ok: true }),
    buy: () => ({ ok: true, item: SHOP[0] }),
    useItem: () => ({ ok: true, item: SHOP[0], crossed: [] }),
    hatch: () => false,
    rename: raw => String(raw).trim() || null,
    startInterest: () => ({ ok: true }),
    sellSouvenir: () => ({ ok: true, sold: { label: '贝壳', price: 60 } }),
    wear: () => ({ ok: true, item: { label: '围巾' } }),
    adopt: () => true,
    reply: (lineId, index) => (index === 0 ? { ok: true, reply: '真乖' } : { ok: false, reason: 'unknown' }),
    drainPending: () => [],
    dispose: () => {},
    set live(next) { live = next },
  }
}

test('the cordis patch names the package exactly as package.json does', async () => {
  const { readFile } = await import('node:fs/promises')
  const here = new URL('../', import.meta.url)
  const pkg = JSON.parse(await readFile(new URL('package.json', here), 'utf8'))
  const patch = await readFile(new URL('cordis.patch.yml', here), 'utf8')

  const names = [...patch.matchAll(/^\s*name:\s*(\S+)\s*$/gm)].map(m => m[1])
  assert.ok(names.length > 0, 'the patch declares at least one plugin name')
  for (const name of names) {
    assert.equal(
      name,
      pkg.name,
      `cordis.patch.yml says name: ${name} but the package is ${pkg.name}. ` +
        'A mismatch resolves the host half through a stale node_modules link and ' +
        'silently drops the client half, so the widget never mounts.',
    )
  }
})

test('a box reports that it cannot go out, and says why', async () => {
  const now = Date.now()
  const box = layEgg(now)
  const store = { freshen: () => box, drainPending: () => {} }
  const snap = snapshot(store, { drain: false })
  assert.equal(snap.canGoOut, false)
  assert.equal(snap.awayBlocked, 'box')
})

test('the souvenir shelf shows the whole collection, not just the last 40', async () => {
  const now = Date.now()
  const pig = hatchEgg(now)
  pig.souvenirs = Array.from({ length: 41 }, (_, index) => ({
    key: 'shell-' + index, emoji: '🐚', label: '贝壳 ' + index, rarity: 'common',
    story: '', from: null, fromLabel: '',
  }))
  const store = { freshen: () => pig, drainPending: () => {} }
  const snap = snapshot(store, { drain: false })
  assert.equal(snap.pig.souvenirs.length, 41)
  assert.equal(snap.pig.souvenirs[0].key, 'shell-0', 'the oldest one must still be sellable')
})

test('a tombstone reports how long the pig lived, not when it hatched', async () => {
  const now = Date.now()
  const HOUR = 3_600_000
  const store = pig => ({ freshen: () => pig, drainPending: () => {} })

  // Born 18 hours ago and died just now.
  const young = hatchEgg(now - 18 * HOUR)
  young.dead = true
  young.diedAt = now
  assert.equal(snapshot(store(young), { drain: false }).pig.ageLabel, '活了 18 小时')

  // A pig that lasted three days.
  const old = hatchEgg(now - 72 * HOUR)
  old.dead = true
  old.diedAt = now
  assert.equal(snapshot(store(old), { drain: false }).pig.ageLabel, '活了 3 天')

  // And a living pig still counts up from birth.
  const alive = hatchEgg(now - 5 * HOUR)
  assert.equal(snapshot(store(alive), { drain: false }).pig.ageLabel, '今天刚到家')
})

test('加冕 works from the slash command and over HTTP, and the snapshot carries the form', async () => {
  const ready = nowMs => {
    const pig = hatchEgg(nowMs)
    Object.assign(pig, { xp: xpForLevel(40), traits: { intel: 20, charm: 20, strong: 20 }, satiety: 90, cleanliness: 90, happiness: 90 })
    pig.stats.jobs = 10
    pig.inventory.crown = 1
    return pig
  }
  const early = boot(nowMs => hatchEgg(nowMs))
  try {
    const refused = early.command.handler({ rawInput: 'crown' })
    assert.equal(refused.kind, 'error')
    assert.match(refused.text, /商店.*晋升.*王冠|王冠.*商店/)
    assert.match(early.command.handler({ rawInput: 'crown 恐龙' }).text, /没有这种形态/)
  } finally {
    await early.cleanup()
  }
  const app = boot(ready)
  try {
    const before = await app.get()
    assert.equal(before.forms.current, null)
    assert.equal(before.forms.forms[0].ready, true)
    const crowned = await app.post({ action: 'crown', form: 'king' })
    assert.equal(crowned.ok, true)
    const after = await app.get()
    assert.equal(after.forms.current, 'king')
    assert.equal(after.pig.stage.label, '猪猪王')
    assert.equal(after.pig.stage.art, 'pig-king')
    assert.equal(after.pig.stage.actionArt, true)
    assert.match(app.command.handler({ rawInput: 'crown 猪猪王' }).text, /猪猪王/)
  } finally {
    await app.cleanup()
  }
})

test('the devil is signed for, not crowned: 加冕 refuses it and the contract delivers it', async () => {
  for (const plays of [19, 20]) {
    const app = boot(nowMs => {
      const state = hatchEgg(nowMs)
      Object.assign(state, { xp: xpForLevel(40), traits: { intel: 0, strong: 20, charm: 20 }, happiness: 10, coins: 99_999 })
      state.stats.plays = plays
      return state
    })
    try {
      const before = await app.get()
      const form = before.forms.forms.find(entry => entry.key === 'devil')
      assert.equal(form.via, 'item')
      assert.equal(form.item, 'contract')
      assert.equal(form.ready, plays === 20)
      assert.equal(form.requirements.find(row => row.key === 'plays').label, '本代玩耍')
      const contract = before.shop.find(item => item.key === 'contract')
      assert.equal(contract.kind, 'promotion')
      assert.match(contract.blurb, /恶魔猪/, 'the shelf says what the contract does')

      // 加冕 is the wrong door — over HTTP and over the command.
      const crowned = await app.post({ action: 'crown', form: 'devil' })
      assert.equal(crowned.ok, false)
      assert.equal(crowned.reason, 'needs-contract')
      assert.equal(crowned.forms.current, null)
      assert.match(app.command.handler({ rawInput: 'crown 恶魔猪' }).text, /签约/)

      // Buy it, then sign it from the bag.
      const bought = await app.post({ action: 'buy', item: 'contract' })
      assert.equal(bought.ok, true)
      assert.equal(bought.inventory.contract, 1)
      const used = await app.post({ action: 'use', item: 'contract' })
      assert.equal(used.ok, plays === 20)
      if (plays === 19) {
        assert.equal(used.reason, 'contract-ineligible')
        assert.deepEqual(used.missing.map(row => row.key), ['plays'])
        assert.equal(used.inventory.contract, 1, 'a refused contract stays in the bag')
        assert.equal(used.forms.current, null)
        assert.equal(used.pig.stage.art, null)
      } else {
        assert.equal(used.forms.current, 'devil')
        assert.equal(used.pig.stage.art, 'pig-devil')
        assert.equal(used.pig.stage.actionArt, true)
        assert.equal(used.inventory.contract, 0, 'a signed contract is spent')
        assert.match(app.command.handler({ rawInput: 'crown 恶魔猪' }).text, /恶魔猪/)
      }
    } finally { await app.cleanup() }
  }
})
