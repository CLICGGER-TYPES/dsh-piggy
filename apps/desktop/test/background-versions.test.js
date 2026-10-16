// @ts-check
/** 使用真实版本 Worker 和受控响应流核对准备、取消、提交及临时目录所有权。 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fsPromises from 'node:fs/promises'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import workerThreads from 'node:worker_threads'
import { gzipSync } from 'node:zlib'

import { startBackgroundVersions } from '../lib/background-versions.js'

const files = {
  'package.json': JSON.stringify({ version: '0.38.0' }),
  'client.js': 'const fixture = "prepared game"\n',
  'packages/pet-core/src/core/constants.js': 'export const STATE_VERSION = 14\n',
}
const pack = gzipSync(Buffer.from(JSON.stringify({
  files: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, Buffer.from(content).toString('base64')])),
})))
const release = {
  version: '0.38.0', packUrl: 'https://fixture.invalid/game.json.gz',
  manifest: { stateVersion: 14, size: pack.length, sha256: createHash('sha256').update(pack).digest('hex') },
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function partialResponse(signal, onAbort = () => {}) {
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(pack.subarray(0, Math.floor(pack.length / 2)))
      signal.addEventListener('abort', () => {
        onAbort()
        controller.error(signal.reason)
      }, { once: true })
    },
  }))
}

function heldDownload() {
  const entered = deferred(), aborted = deferred(), finish = deferred()
  let calls = 0, finished = false
  const fetch = async (_url, init) => {
    if (++calls > 1) return new Response(pack)
    entered.resolve()
    await new Promise(resolve => init.signal.addEventListener('abort', resolve, { once: true }))
    aborted.resolve()
    try {
      await finish.promise
      throw init.signal.reason
    } finally { finished = true }
  }
  return { fetch, entered, aborted, finish, calls: () => calls, finished: () => finished }
}

async function setup(t, fetch = async () => new Response(pack)) {
  const dir = await mkdtemp(join(tmpdir(), 'piggy-background-versions-'))
  let versions
  t.after(async () => {
    await versions?.close()
    await rm(dir, { recursive: true, force: true })
  })
  const bundledDir = join(dir, 'bundled')
  await mkdir(join(bundledDir, 'packages/pet-core/src/core'), { recursive: true })
  await writeFile(join(bundledDir, 'package.json'), JSON.stringify({ version: '0.37.0' }))
  await writeFile(join(bundledDir, 'packages/pet-core/src/core/constants.js'), 'export const STATE_VERSION = 12\n')
  const statePath = join(dir, 'state.json')
  await writeFile(statePath, JSON.stringify({ version: 12 }))
  versions = await startBackgroundVersions({ userData: dir, bundledDir, statePath, shellVersion: '0.6.6', fetch })
  return { versions, dir, bundledDir, statePath, root: join(dir, 'versions') }
}

async function stagedEntries(root) {
  const updates = (await readdir(root)).filter(name => name.startsWith('.update-'))
  return (await Promise.all(updates.map(name => readdir(join(root, name))))).flat()
}

test('传输中取消会终止响应流，等待清理后仍能再次准备和提交', { timeout: 10_000 }, async t => {
  const progressed = deferred()
  let requests = 0
  let signal, streamAborted = false
  const fixture = await setup(t, async (_url, init) => {
    requests += 1
    if (requests > 1) return new Response(pack)
    signal = init.signal
    return partialResponse(signal, () => { streamAborted = true })
  })
  const { versions, root, bundledDir } = fixture
  const preparing = versions.prepareInstall(release, fraction => { if (fraction > 0 && fraction < 1) progressed.resolve() })
  const outcome = preparing.catch(error => error)
  await progressed.promise
  const cancelling = versions.cancelPreparation()
  await assert.rejects(versions.commitInstall({ id: 1, version: release.version }), /已取消/)
  await cancelling
  assert.match((await outcome).message, /已取消/)
  assert.equal(signal.aborted, true)
  assert.equal(streamAborted, true)
  assert.deepEqual(await stagedEntries(root), [])
  assert.equal(await versions.activeDir(), bundledDir)
  const prepared = await versions.prepareInstall(release)
  assert.deepEqual(await versions.commitInstall(prepared), { ok: true, version: release.version })
  assert.equal(await readFile(join(await versions.activeDir(), 'client.js'), 'utf8'), files['client.js'])
})

test('立即取消会拒绝迟到的下载请求，不关闭版本服务', { timeout: 10_000 }, async t => {
  let requests = 0
  const { versions, root, bundledDir } = await setup(t, async () => {
    requests += 1
    return new Response(pack)
  })
  const preparing = versions.prepareInstall(release)
  const outcome = preparing.catch(error => error)
  await versions.cancelPreparation()
  assert.match((await outcome).message, /已取消/)
  assert.equal(requests, 0, '取消边界以内的迟到请求不能启动网络操作')
  assert.equal(await versions.activeDir(), bundledDir)
  assert.deepEqual(await stagedEntries(root), [])
  const prepared = await versions.prepareInstall(release)
  assert.equal(requests, 1)
  await versions.discardPrepared(prepared)
  assert.deepEqual(await stagedEntries(root), [])
})

test('准备完成后取消使旧令牌失效，下一次准备可以独立提交', { timeout: 10_000 }, async t => {
  const { versions, root, bundledDir } = await setup(t)
  const prepared = await versions.prepareInstall(release)
  const cancelling = versions.cancelPreparation()
  await assert.rejects(versions.commitInstall(prepared), /已取消/)
  await cancelling
  await assert.rejects(versions.commitInstall(prepared), /已失效/)
  assert.equal(await versions.activeDir(), bundledDir)
  assert.deepEqual(await stagedEntries(root), [])
  const replacement = await versions.prepareInstall(release)
  assert.notEqual(replacement.id, prepared.id)
  assert.equal((await versions.commitInstall(replacement)).ok, true)
})

test('取消尚未收尾时，新准备必须等待旧下载结束再启动', { timeout: 10_000 }, async t => {
  const held = heldDownload()
  const { versions, root } = await setup(t, held.fetch)
  const first = versions.prepareInstall(release).catch(error => error)
  await held.entered.promise
  const cancelling = versions.cancelPreparation()
  await held.aborted.promise
  let nextFinished = false
  const next = versions.prepareInstall(release)
    .then(value => ({ value }), error => ({ error })).finally(() => { nextFinished = true })
  try {
    await setImmediate()
    assert.equal(nextFinished, false)
    assert.equal(held.calls(), 1, '清理完成前不能开始下一次下载')
  } finally {
    held.finish.resolve()
    await cancelling
  }
  assert.match((await first).message, /已取消/)
  const result = await next
  assert.equal(result.error, undefined)
  assert.equal(held.calls(), 2)
  await versions.discardPrepared(result.value)
  assert.deepEqual(await stagedEntries(root), [])
})

test('先提交后取消不撤销已经完成的激活，也不遗留准备目录', { timeout: 10_000 }, async t => {
  const { versions, root } = await setup(t)
  const prepared = await versions.prepareInstall(release)
  const committing = versions.commitInstall(prepared)
  const cancelling = versions.cancelPreparation()
  assert.deepEqual(await committing, { ok: true, version: release.version })
  await cancelling
  assert.equal((await versions.current()).version, release.version)
  assert.deepEqual(await stagedEntries(root), [])
  await assert.rejects(versions.commitInstall(prepared), /已失效/)
})

test('关闭中止在途准备并只清理自己的临时目录，重复关闭可等待同一次收尾', { timeout: 10_000 }, async t => {
  const progressed = deferred()
  let signal
  const { versions, root } = await setup(t, async (_url, init) => {
    signal = init.signal
    return partialResponse(signal)
  })
  const other = join(root, '.update-other-owner')
  await mkdir(other)
  await writeFile(join(other, 'keep.txt'), 'another owner')
  const preparing = versions.prepareInstall(release, fraction => { if (fraction > 0) progressed.resolve() })
  const outcome = preparing.catch(error => error)
  await progressed.promise
  const closing = versions.close()
  assert.equal(versions.close(), closing)
  await closing
  assert.match((await outcome).message, /已关闭/)
  assert.equal(signal.aborted, true)
  assert.deepEqual(await readdir(root), ['.update-other-owner'])
  assert.equal(await readFile(join(other, 'keep.txt'), 'utf8'), 'another owner')
  await assert.rejects(versions.current(), /已关闭/)
})

test('关闭在发出取消后仍等待下载收尾，不能提前删除临时目录', { timeout: 10_000 }, async t => {
  const held = heldDownload()
  const exited = deferred(), cleanup = []
  const NativeWorker = workerThreads.Worker, remove = fsPromises.rm
  t.mock.method(workerThreads, 'Worker', function (url, options) {
    const worker = new NativeWorker(url, options)
    worker.once('exit', () => exited.resolve())
    return worker
  })
  syncBuiltinESMExports()
  t.after(() => { held.finish.resolve(); t.mock.restoreAll(); syncBuiltinESMExports() })
  const { versions, root } = await setup(t, held.fetch)
  const temporary = join(root, (await readdir(root)).find(name => name.startsWith('.update-')))
  t.mock.method(fsPromises, 'rm', (path, options) => {
    if (path === temporary) cleanup.push(held.finished())
    return remove(path, options)
  })
  syncBuiltinESMExports()
  const preparing = versions.prepareInstall(release).catch(error => error)
  await held.entered.promise
  const closing = versions.close()
  let closed = false
  closing.then(() => { closed = true })
  await held.aborted.promise
  try {
    await exited.promise
    await setImmediate()
    assert.equal(closed, false, '中止信号不是下载收尾完成通知')
    assert.deepEqual(cleanup, [], '下载收尾前不能开始删除私有目录')
    assert.equal((await readdir(root)).some(name => name.startsWith('.update-')), true)
  } finally {
    held.finish.resolve()
    await closing
  }
  assert.match((await preparing).message, /已关闭/)
  assert.equal(closed, true)
  assert.deepEqual(cleanup, [true], '目录只能在下载已经收尾后清理')
  assert.deepEqual(await readdir(root), [])
})

test('落盘失败中止仍未结束的响应体，不等待服务器继续发送才释放请求', { timeout: 10_000 }, async t => {
  let root, requests = 0, aborted = false
  const { versions, root: versionRoot } = await setup(t, async (_url, init) => {
    if (++requests > 1) return new Response(pack)
    const update = (await readdir(root)).find(name => name.startsWith('.update-'))
    const directory = join(root, update)
    const prepared = (await readdir(directory)).find(name => name.startsWith('prepare-'))
    await writeFile(join(directory, prepared, 'part-0.gz'), 'occupied')
    return partialResponse(init.signal, () => { aborted = true })
  })
  root = versionRoot
  await assert.rejects(versions.prepareInstall(release), /EEXIST/)
  assert.equal(aborted, true)
  assert.deepEqual(await stagedEntries(root), [])
  await versions.discardPrepared(await versions.prepareInstall(release))
  assert.equal(requests, 2)
})

test('提交重新读取准备之后提高的存档版本，拒绝切换并允许撤销', { timeout: 10_000 }, async t => {
  const { versions, root, statePath, bundledDir } = await setup(t)
  const prepared = await versions.prepareInstall(release)
  await writeFile(statePath, JSON.stringify({ version: 15 }))
  await assert.rejects(versions.commitInstall(prepared), /存档太新/)
  assert.equal(await versions.activeDir(), bundledDir)
  await assert.rejects(readFile(join(root, 'active.json')), { code: 'ENOENT' })
  await versions.discardPrepared(prepared)
  assert.deepEqual(await stagedEntries(root), [])
})

test('同包提交可复用已有目录，回退读取最终存档而不激活旧 schema', { timeout: 10_000 }, async t => {
  const { versions, root, statePath } = await setup(t)
  assert.equal((await versions.commitInstall(await versions.prepareInstall(release))).ok, true)
  assert.equal((await versions.rollback()).ok, true)
  assert.equal((await versions.commitInstall(await versions.prepareInstall(release))).ok, true)
  const before = await readFile(join(root, 'active.json'))
  await writeFile(statePath, JSON.stringify({ version: 14 }))
  const result = await versions.rollback()
  assert.equal(result.ok, false)
  assert.match(result.reason, /当前存档版本为 14.*只支持 12/)
  assert.deepEqual(await readFile(join(root, 'active.json')), before)
  assert.equal((await versions.current()).version, release.version)
})

for (const [name, damage] of [
  ['缺少文件', target => rm(join(target, 'client.js'))],
  ['同长度字节不同', target => writeFile(join(target, 'client.js'), files['client.js'].replace('prepared', 'modified'))],
  ['存在额外文件', target => writeFile(join(target, 'extra.js'), 'unexpected')],
]) {
  test(`已有版本${name}时拒绝复用，激活记录保持不变`, { timeout: 10_000 }, async t => {
    const { versions, root, bundledDir } = await setup(t)
    await versions.commitInstall(await versions.prepareInstall(release))
    await versions.rollback()
    const before = await readFile(join(root, 'active.json'))
    await damage(join(root, release.version))
    const prepared = await versions.prepareInstall(release)
    await assert.rejects(versions.commitInstall(prepared), /已有版本内容.*不一致/)
    assert.deepEqual(await readFile(join(root, 'active.json')), before)
    assert.equal(await versions.activeDir(), bundledDir)
    await versions.discardPrepared(prepared)
    assert.deepEqual(await stagedEntries(root), [])
  })
}

for (const [name, response, reason] of [
  ['非成功状态', () => new Response('not found', { status: 404 }), /下载失败（404）/],
  ['响应流失败', () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('response failed')) } })), /response failed/],
]) {
  test(`${name}后中止底层请求，清理准备目录并允许重试`, { timeout: 10_000 }, async t => {
    let signal, requests = 0
    const { versions, root, bundledDir } = await setup(t, async (_url, init) => {
      requests += 1
      signal = init.signal
      return requests === 1 ? response() : new Response(pack)
    })
    await assert.rejects(versions.prepareInstall(release), reason)
    assert.equal(signal.aborted, true)
    assert.deepEqual(await stagedEntries(root), [])
    assert.equal(await versions.activeDir(), bundledDir)
    const prepared = await versions.prepareInstall(release)
    await versions.discardPrepared(prepared)
    assert.equal(requests, 2)
  })
}
