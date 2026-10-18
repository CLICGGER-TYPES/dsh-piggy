// @ts-check
/** 真实进程异常退出后清理遗留暂存；保留已安装文件、记录和符号链接目标。 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fsPromises from 'node:fs/promises'
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { startBackgroundVersions } from '../lib/background-versions.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))

test('真实进程退出遗留的更新目录在下次启动清理，已安装游戏及版本记录保留', { timeout: 10_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'piggy-update-crash-'))
  const root = join(directory, 'versions')
  let child, versions
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) { child.kill(); await once(child, 'exit') }
    await versions?.close()
    await rm(directory, { recursive: true, force: true })
  })
  await mkdir(join(root, '0.37.0'), { recursive: true })
  await mkdir(join(root, '.update-user-notes'))
  const files = {
    '0.37.0/package.json': JSON.stringify({ version: '0.37.0' }),
    '0.37.0.manifest.json': JSON.stringify({ version: '0.37.0', stateVersion: 14 }),
    'active.json': JSON.stringify({ active: '0.37.0', previous: null, shell: '0.6.6' }),
    '.update-user-notes/keep.txt': 'not a generated update directory',
  }
  for (const [name, content] of Object.entries(files)) await writeFile(join(root, name), content)
  const options = { userData: directory, bundledDir: ROOT, statePath: join(directory, 'state.json'), shellVersion: '0.6.6' }
  child = spawn(process.execPath, [], { stdio: ['pipe', 'ignore', 'pipe'] })
  let diagnostics = ''
  child.stderr.setEncoding('utf8').on('data', chunk => { diagnostics += chunk })
  const exited = once(child, 'exit')
  child.stdin.end(`(async () => {
    const { startBackgroundVersions } = await import(${JSON.stringify(new URL('../lib/background-versions.js', import.meta.url).href)})
    const versions = await startBackgroundVersions(${JSON.stringify(options)})
    await versions.current()
    process.exit(17)
  })().catch(error => { console.error(error); process.exit(1) })`)
  assert.equal((await exited)[0], 17, diagnostics)
  const old = (await readdir(root)).filter(name => /^\.update-[A-Za-z0-9]{6}$/.test(name))
  assert.equal(old.length, 1, '异常退出确实留下本次私有目录')
  versions = await startBackgroundVersions(options)
  const current = (await readdir(root)).filter(name => /^\.update-[A-Za-z0-9]{6}$/.test(name))
  assert.equal(current.length, 1)
  assert.notEqual(current[0], old[0], '旧目录已删除，当前服务使用新目录')
  for (const [name, content] of Object.entries(files)) assert.equal(await readFile(join(root, name), 'utf8'), content)
  await versions.close()
  assert.deepEqual((await readdir(root)).filter(name => /^\.update-[A-Za-z0-9]{6}$/.test(name)), [])
})

test('启动清理不跟随与私有目录同名的符号链接', { timeout: 10_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'piggy-update-link-'))
  const root = join(directory, 'versions'), protectedDir = join(directory, 'protected')
  let versions
  t.after(async () => { await versions?.close(); await rm(directory, { recursive: true, force: true }) })
  await mkdir(root)
  await mkdir(protectedDir)
  await writeFile(join(protectedDir, 'keep.txt'), 'protected contents')
  const link = join(root, '.update-ABC123')
  await symlink(protectedDir, link, 'junction')
  versions = await startBackgroundVersions({ userData: directory, bundledDir: ROOT,
    statePath: join(directory, 'state.json'), shellVersion: '0.6.6' })
  assert.equal(await readFile(join(link, 'keep.txt'), 'utf8'), 'protected contents')
  await versions.close()
  assert.equal(await readFile(join(protectedDir, 'keep.txt'), 'utf8'), 'protected contents')
})

test('旧暂存目录扫描失败时记录诊断，仍能启动和关闭当前版本服务', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'piggy-update-scan-error-'))
  const root = join(directory, 'versions'), warnings = []
  let versions
  t.after(async () => {
    t.mock.restoreAll(); syncBuiltinESMExports()
    await versions?.close()
    await rm(directory, { recursive: true, force: true })
  })
  await mkdir(join(root, '.update-OLD123'), { recursive: true })
  const scan = fsPromises.readdir
  t.mock.method(fsPromises, 'readdir', (path, options) => {
    if (path === root && options?.withFileTypes) return Promise.reject(new Error('EACCES: simulated scan failure'))
    return scan(path, options)
  })
  syncBuiltinESMExports()
  versions = await startBackgroundVersions({ userData: directory, bundledDir: ROOT,
    statePath: join(directory, 'state.json'), shellVersion: '0.6.6', log: (...parts) => warnings.push(parts) })
  assert.equal((await versions.current()).bundled, true)
  assert.equal(warnings.length, 1)
  assert.ok(warnings[0].includes(root))
  assert.match(warnings[0].join(' '), /EACCES/)
  assert.ok((await readdir(root)).includes('.update-OLD123'))
  await versions.close()
  assert.deepEqual(await readdir(root), ['.update-OLD123'], '当前服务正常清理自己的目录')
})

test('一个旧暂存目录删除失败时记录诊断，继续回收其他目录并启动当前版本服务', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'piggy-update-remove-error-'))
  const root = join(directory, 'versions'), busy = join(root, '.update-BUSY12'), free = join(root, '.update-FREE12')
  const warnings = []
  let versions
  t.after(async () => {
    t.mock.restoreAll(); syncBuiltinESMExports()
    await versions?.close()
    await rm(directory, { recursive: true, force: true })
  })
  await mkdir(busy, { recursive: true })
  await mkdir(free)
  const remove = fsPromises.rm
  t.mock.method(fsPromises, 'rm', (path, options) => path === busy
    ? Promise.reject(new Error('EBUSY: simulated directory in use')) : remove(path, options))
  syncBuiltinESMExports()
  versions = await startBackgroundVersions({ userData: directory, bundledDir: ROOT,
    statePath: join(directory, 'state.json'), shellVersion: '0.6.6', log: (...parts) => warnings.push(parts) })
  assert.equal((await versions.current()).bundled, true)
  assert.equal(warnings.length, 1)
  assert.ok(warnings[0].includes(busy))
  assert.match(warnings[0].join(' '), /EBUSY/)
  await assert.rejects(readFile(join(free, 'anything')), { code: 'ENOENT' })
  assert.equal((await readdir(root)).includes('.update-FREE12'), false, '忙目录不能中断其他目录的回收')
  await versions.close()
  assert.deepEqual(await readdir(root), ['.update-BUSY12'])
})
