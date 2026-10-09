// @ts-check
/**
 * 桌面版热更新：列版本（能不能装、为什么不能）、下载校验、解包、切换、回退。
 * GitHub 用假的 fetch 代替；游戏包用 release-game 真生成。
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

import { compareVersions, createVersions } from '../lib/versions.js'
import { releaseGame } from '../scripts/release-game.mjs'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))

/** A fake GitHub: a releases list plus the files it links to. */
function fakeGithub(files, releases) {
  const calls = []
  const fetch = async url => {
    calls.push(url)
    if (url === 'releases') return new Response(JSON.stringify(releases))
    if (!(url in files)) return new Response('nope', { status: 404 })
    return new Response(files[url])
  }
  return { fetch: /** @type {any} */ (fetch), calls }
}

const release = (version, extra = {}) => ({
  tag_name: 'v' + version, name: 'v' + version, published_at: '2026-10-01T00:00:00Z', body: '改了点东西', html_url: 'page',
  assets: [
    { name: `game-${version}.manifest.json`, browser_download_url: `m-${version}` },
    { name: `game-${version}.json.gz`, browser_download_url: `p-${version}` },
  ],
  ...extra,
})

function setup(save = { version: 12 }) {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-versions-'))
  const bundled = join(dir, 'bundled')
  mkdirSync(bundled)
  writeFileSync(join(bundled, 'package.json'), JSON.stringify({ version: '0.24.0' }))
  const statePath = join(dir, 'state.json')
  writeFileSync(statePath, JSON.stringify(save))
  return { dir, bundled, statePath }
}

test('versions compare like numbers, not strings', () => {
  assert.ok(compareVersions('0.10.0', '0.9.9') > 0)
  assert.equal(compareVersions('v1.2', '1.2.0'), 0)
  assert.ok(compareVersions('0.1.0', '0.2.0') < 0)
})

test('the list says which versions can be installed, and why not', async () => {
  const { dir, bundled, statePath } = setup({ version: 12 })
  try {
    const files = {
      'm-0.26.0': JSON.stringify({ version: '0.26.0', stateVersion: 13, minShell: '0.2.0', shellVersion: '0.2.1', sha256: 'x', size: 1 }),
      'm-0.25.0': JSON.stringify({ version: '0.25.0', stateVersion: 12, minShell: '0.1.0', shellVersion: '0.1.3', sha256: 'x', size: 1 }),
      'm-0.20.0': JSON.stringify({ version: '0.20.0', stateVersion: 10, minShell: '0.1.0', sha256: 'x', size: 1 }),
    }
    const gh = fakeGithub(files, [release('0.20.0'), release('0.26.0'), release('0.25.0'), { tag_name: 'v0.0.1', assets: [] }])
    const versions = createVersions({ userData: dir, bundledDir: bundled, shellVersion: '0.1.0', statePath, fetch: gh.fetch, releasesUrl: 'releases' })
    const list = await versions.list()
    assert.deepEqual(list.map(r => [r.version, r.blocked]), [['0.26.0', 'shell'], ['0.25.0', null], ['0.20.0', 'save']])
    assert.deepEqual(list.slice(0, 2).map(r => [r.latestShell, r.shellUpdate]), [['0.2.1', true], ['0.1.3', true]])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('installing checks the download, switches to it, and rollback goes back', async () => {
  const { dir, bundled, statePath } = setup()
  try {
    const out = join(dir, 'rel')
    const manifest = await releaseGame(ROOT, out, '0.1.0')
    assert.equal(manifest.shellVersion, JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version)
    const pack = readFileSync(join(out, `game-${manifest.version}.json.gz`))
    const files = { [`m-${manifest.version}`]: JSON.stringify(manifest), [`p-${manifest.version}`]: pack }
    const gh = fakeGithub(files, [release(manifest.version)])
    const versions = createVersions({ userData: dir, bundledDir: bundled, shellVersion: '0.1.0', statePath, fetch: gh.fetch, releasesUrl: 'releases' })
    const [target] = await versions.list()
    const seen = []
    assert.deepEqual(await versions.install(target, f => seen.push(f)), { ok: true, version: manifest.version })
    assert.equal(seen.at(-1), 1)
    assert.equal(versions.activeDir(), join(dir, 'versions', manifest.version))
    assert.equal(readFileSync(join(versions.activeDir(), 'client.js'), 'utf8'), readFileSync(join(ROOT, 'client.js'), 'utf8'))
    assert.equal(versions.current().previous, '0.24.0')
    assert.equal(versions.current().previousIsBundled, true)

    assert.deepEqual(versions.rollback(), { ok: true, version: '0.24.0' })
    assert.equal(versions.activeDir(), bundled)
    // And forward again: the downloaded one is still there.
    assert.equal(versions.rollback().ok, true)
    assert.equal(versions.activeDir(), join(dir, 'versions', manifest.version))

    // A new installer (different shell version) goes back to its own game.
    const after = createVersions({ userData: dir, bundledDir: bundled, shellVersion: '0.2.2', statePath, fetch: gh.fetch, releasesUrl: 'releases' })
    assert.equal(after.activeDir(), bundled)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a download that fails its checksum, or climbs out of its folder, changes nothing', async () => {
  const { dir, bundled, statePath } = setup()
  try {
    const evil = gzipSync(Buffer.from(JSON.stringify({ files: { 'package.json': 'e30=', '../../escape.txt': 'aGk=' } })))
    const sha = createHash('sha256').update(evil).digest('hex')
    const gh = fakeGithub({ 'p-9.9.9': evil }, [])
    const versions = createVersions({ userData: dir, bundledDir: bundled, shellVersion: '0.1.0', statePath, fetch: gh.fetch, releasesUrl: 'releases' })
    await assert.rejects(versions.install({ version: '9.9.9', packUrl: 'p-9.9.9', manifest: { sha256: 'wrong', size: evil.length } }), /校验不对/)
    await assert.rejects(versions.install({ version: '9.9.9', packUrl: 'p-9.9.9', manifest: { sha256: sha, size: evil.length } }), /可疑路径/)
    assert.equal(versions.activeDir(), bundled)
    assert.equal(versions.rollback().ok, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// 分卷游戏包 + 不带游戏的安装包（Gitee Windows，2026-10-09）
// ---------------------------------------------------------------------------

test('a package over the attachment limit is split into parts, listed, downloaded in order and checked', async () => {
  const { dir, bundled, statePath } = setup()
  try {
    const out = join(dir, 'rel')
    const manifest = await releaseGame(ROOT, out, '0.1.0', '0.6.3', 500_000)
    assert.ok(manifest.parts.length > 1, 'small limit must split')
    assert.equal(manifest.minShell, '0.6.3', 'old shells cannot read parts, so the floor is raised')
    assert.throws(() => readFileSync(join(out, `game-${manifest.version}.json.gz`)), 'no whole-package file next to the parts')
    assert.ok(manifest.parts.every(part => part.size <= 500_000))
    const files = { [`m-${manifest.version}`]: JSON.stringify(manifest) }
    const assets = [{ name: `game-${manifest.version}.manifest.json`, browser_download_url: `m-${manifest.version}` }]
    // Gitee may list attachments in any order; the manifest decides the order.
    for (const part of [...manifest.parts].reverse()) {
      files['u-' + part.name] = readFileSync(join(out, part.name))
      assets.push({ name: part.name, browser_download_url: 'u-' + part.name })
    }
    const gh = fakeGithub(files, [{ ...release(manifest.version), assets }])
    const versions = createVersions({ userData: dir, bundledDir: bundled, shellVersion: '0.6.3', statePath, fetch: gh.fetch, releasesUrl: 'releases' })
    const [target] = await versions.list()
    assert.deepEqual(target.packUrls, manifest.parts.map(part => 'u-' + part.name))
    const seen = []
    assert.deepEqual(await versions.install(target, f => seen.push(f)), { ok: true, version: manifest.version })
    assert.equal(seen.at(-1), 1)
    assert.equal(readFileSync(join(versions.activeDir(), 'client.js'), 'utf8'), readFileSync(join(ROOT, 'client.js'), 'utf8'))

    // A release missing one part is not offered; a corrupted part is refused before anything changes.
    const missing = fakeGithub(files, [{ ...release(manifest.version), assets: assets.slice(0, -1) }])
    const v2 = createVersions({ userData: join(dir, 'fresh'), bundledDir: bundled, shellVersion: '0.6.3', statePath, fetch: missing.fetch, releasesUrl: 'releases' })
    assert.deepEqual(await v2.list(), [])
    const broken = { ...files, ['u-' + manifest.parts[1].name]: Buffer.from('nope') }
    const bad = createVersions({ userData: join(dir, 'other'), bundledDir: bundled, shellVersion: '0.6.3', statePath, fetch: fakeGithub(broken, []).fetch, releasesUrl: 'releases' })
    await assert.rejects(bad.install({ ...target }), /第 2 卷校验不对/)
    assert.equal(bad.activeDir(), bundled)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('an installer without a game downloads the pinned one first and keeps it across shell updates', async () => {
  const { dir, statePath } = setup()
  try {
    const out = join(dir, 'rel')
    const manifest = await releaseGame(ROOT, out, '0.1.0', '0.6.3')
    const { gamePin } = await import('../scripts/write-game-pin.mjs')
    const pin = gamePin(out, 'https://gitee.example/releases/download')
    assert.deepEqual(pin.urls, [`https://gitee.example/releases/download/v${manifest.version}/game-${manifest.version}.json.gz`])
    const files = { [pin.urls[0]]: readFileSync(join(out, `game-${manifest.version}.json.gz`)) }
    const noGame = join(dir, 'resources', 'game') // not created: the Windows Gitee installer ships only game-pin.json
    const make = (shellVersion, fetchFiles = files) => createVersions({ userData: dir, bundledDir: noGame, shellVersion, statePath, fetch: fakeGithub(fetchFiles, []).fetch, releasesUrl: 'releases' })

    const first = make('0.6.3')
    assert.equal(first.needsGame(), true)
    assert.equal(first.current().bundledVersion, null)
    await assert.rejects(make('0.6.3', {}).installPinned(pin), /下载失败/)
    assert.equal(first.needsGame(), true, 'a failed download leaves nothing half-installed')
    await assert.rejects(first.installPinned(/** @type {any} */ ({ version: '1' })), /清单坏了/)
    assert.deepEqual(await first.installPinned(pin), { ok: true, version: manifest.version })
    assert.equal(first.needsGame(), false)
    assert.equal(first.current().previousIsBundled, false)
    assert.equal(first.rollback().ok, false, 'there is no bundled game to go back to')

    // The shell updates itself: with no bundled game to fall back on, keep using the downloaded one.
    const updated = make('0.6.4')
    assert.equal(updated.needsGame(), false)
    assert.equal(updated.activeDir(), join(dir, 'versions', manifest.version))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// 版本列表少问 GitHub（用户 2026-10-09：撞到每小时上限）
// ---------------------------------------------------------------------------

test('the release list is asked once per half hour, kept on disk, re-checked with its ETag, and survives a rate limit', async () => {
  const { dir, bundled, statePath } = setup()
  try {
    const manifest = JSON.stringify({ version: '0.25.0', stateVersion: 12, minShell: '0.1.0', sha256: 'x', size: 1 })
    const calls = []
    let limited = false
    const fetch = async (url, init) => {
      const etag = init?.headers?.['if-none-match'] ?? null
      calls.push(url + (etag ? ' ' + etag : ''))
      if (url === 'releases' && limited) return new Response('rate limited', { status: 403 })
      if (url === 'releases' && etag === '"r1"') return new Response(null, { status: 304 })
      if (url === 'releases') return new Response(JSON.stringify([release('0.25.0')]), { headers: { etag: '"r1"' } })
      if (url === 'm-0.25.0') return new Response(manifest)
      return new Response('nope', { status: 404 })
    }
    let clock = 1_000_000
    const make = () => createVersions({ userData: dir, bundledDir: bundled, shellVersion: '0.1.0', statePath, fetch: /** @type {any} */ (fetch), releasesUrl: 'releases', now: () => clock })
    const first = make()
    const [a, b] = await Promise.all([first.list(), first.list()])
    assert.deepEqual([a.length, b.length], [1, 1])
    assert.deepEqual(calls, ['releases', 'm-0.25.0'], 'both windows share one request; the manifest is fetched once')
    await first.list()
    assert.equal(calls.length, 2, 'within half an hour nothing is asked again')

    const restarted = make()
    assert.equal((await restarted.list()).length, 1)
    assert.equal(calls.length, 2, 'a restart uses the saved list and manifests')
    await restarted.list({ fresh: true })
    assert.deepEqual(calls.slice(2), ['releases "r1"'], 'refresh asks with the ETag; 304 does not count and the manifest is not refetched')

    limited = true
    clock += 31 * 60_000
    assert.equal((await restarted.list()).length, 1, 'rate limited: keep showing the saved list instead of an error')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
