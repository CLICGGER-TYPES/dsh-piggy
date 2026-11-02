// @ts-check
/**
 * 扩展发布回读检查的回归用例：本地 HTTP fixture 只模拟公开附件，不访问真实 GitHub/Gitee。
 * 覆盖整包、404、错误页、身份不符、逐文件散列、旧宿主附件、目录选择和 CLI 退出码。
 * 这些用例是开发时的定义；独立验收仍要在 149 上用真实候选包重新设计步骤并执行。
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { makeBundle } from '../store/ext-import.js'
import { checkExtensionReleases, defaultRegistry } from '../scripts/extension-release-check.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const sha256 = body => createHash('sha256').update(body).digest('hex')
const TILE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA1cAAAAASUVORK5CYII=', 'base64')

/** 一套最小的官方扩展目录和本地附件服务器；每个用例独立端口、独立路由。 */
async function makeFixture(t, options = {}) {
  const key = options.key ?? 'sample'
  const version = options.version ?? '1.0.0'
  const minGame = options.minGame ?? '0.36.1'
  const manifest = { key, label: 'Sample', emoji: '🧪', description: 'fixture', version, minGame, assets: ['tile.png'] }
  const files = {
    'manifest.json': JSON.stringify(manifest),
    'server.js': 'export default { actions: {} }',
    'client.js': 'void 0',
    'assets/tile.png': TILE_PNG,
  }
  const routes = new Map()
  const requested = []
  const server = createServer((request, response) => {
    requested.push(request.url)
    const body = routes.get(request.url)
    if (body === undefined) {
      response.writeHead(404)
      response.end('not uploaded')
      return
    }
    response.end(body)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  })
  const address = /** @type {import('node:net').AddressInfo} */ (server.address())
  const base = `http://127.0.0.1:${address.port}`
  const bundleBody = Buffer.from(makeBundle(files))
  routes.set('/sample.piggyext', bundleBody)
  const entry = {
    key,
    version,
    minGame,
    bundle: { url: base + '/sample.piggyext', sha256: sha256(bundleBody) },
    files: Object.fromEntries(Object.entries(files).map(([name, body]) => [name, { url: base + '/' + name, sha256: sha256(body) }])),
  }
  for (const [name, body] of Object.entries(files)) routes.set('/' + name, body)
  return { entry, routes, requested, registry: { version: 1, extensions: [{ key: 'pomodoro', builtin: true }, entry] } }
}

/** 写一份临时目录文件，供 CLI 用例读取；结束自动清理。 */
function writeTempRegistry(t, registry) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ext-release-'))
  const file = join(dir, 'registry.json')
  writeFileSync(file, JSON.stringify(registry))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return { dir, file }
}

/** 异步启动 CLI：测试进程里的 HTTP fixture 必须能继续响应子进程的请求。 */
function runCli(args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, NO_PROXY: 'localhost,127.0.0.1,::1,[::1]', no_proxy: 'localhost,127.0.0.1,::1,[::1]' },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('close', status => resolve({ status, stdout, stderr }))
    child.on('error', error => resolve({ status: null, stdout, stderr: stderr + String(error) }))
  })
}

test('现代扩展只回读整包，包内文件与目录散列一致', async t => {
  const fixture = await makeFixture(t)
  for (const path of [...fixture.routes.keys()]) if (!path.endsWith('.piggyext')) fixture.routes.delete(path)
  const result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.ok, true)
  assert.equal(result.checkedEntries, 1)
  assert.equal(result.checkedFiles, 4)
  assert.equal(result.entries[0].bundleVerified, true)
  assert.equal(result.entries[0].expectedFiles, 4)
  assert.equal(result.entries[0].checkedFiles, 4)
  assert.equal(result.entries[0].legacyRequired, false)
  assert.equal(result.entries[0].legacyCheckedFiles, 0)
  assert.deepEqual(fixture.requested, ['/sample.piggyext'])
})

test('旧宿主扩展逐件回读代码和图片', async t => {
  const fixture = await makeFixture(t, { minGame: '0.36.0' })
  const result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.ok, true)
  assert.equal(result.entries[0].legacyRequired, true)
  assert.equal(result.entries[0].checkedFiles, 4)
  assert.equal(result.entries[0].legacyCheckedFiles, 4)
  assert.deepEqual([...fixture.requested].sort(), ['/assets/tile.png', '/client.js', '/manifest.json', '/sample.piggyext', '/server.js'])
})

test('旧宿主缺少图片附件时失败并保留 HTTP 404', async t => {
  const fixture = await makeFixture(t, { minGame: '0.36.0' })
  fixture.routes.delete('/assets/tile.png')
  const result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.ok, false)
  assert.equal(result.entries[0].bundleVerified, true)
  assert.equal(result.entries[0].legacyCheckedFiles, 3)
  assert.deepEqual(result.entries[0].issues, [{ file: 'assets/tile.png', code: 'http-error', message: 'HTTP 404' }])
})

test('旧宿主 HTTP 200 的旧内容按逐文件散列拒绝', async t => {
  const fixture = await makeFixture(t, { minGame: '0.36.0' })
  fixture.routes.set('/server.js', 'old version')
  const result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.ok, false)
  assert.equal(result.entries[0].legacyCheckedFiles, 3)
  assert.deepEqual(result.entries[0].issues, [{ file: 'server.js', code: 'attachment-hash-mismatch', message: 'attachment SHA256 mismatch' }])
})

test('整包 404、错误页和正确散列的非扩展包都不能通过', async t => {
  const fixture = await makeFixture(t, { minGame: '0.36.0' })
  fixture.routes.delete('/sample.piggyext')
  let result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.ok, false)
  assert.equal(result.entries[0].bundleVerified, false)
  assert.equal(result.entries[0].legacyRequired, true)
  assert.equal(result.entries[0].legacyCheckedFiles, 0)
  assert.deepEqual(result.entries[0].issues, [{ file: 'bundle', code: 'http-error', message: 'HTTP 404' }])

  fixture.routes.set('/sample.piggyext', '<html>download quota</html>')
  result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.ok, false)
  assert.deepEqual(result.entries[0].issues, [{ file: 'bundle', code: 'bundle-hash-mismatch', message: 'bundle SHA256 mismatch' }])

  const junk = Buffer.from('<html>download quota</html>')
  fixture.routes.set('/sample.piggyext', junk)
  fixture.entry.bundle.sha256 = sha256(junk)
  result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.ok, false)
  assert.equal(result.entries[0].issues[0].code, 'bundle-invalid')
  assert.equal(typeof result.entries[0].issues[0].message, 'string')
})

test('包内 key、version 或 minGame 与目录不一致时失败', async t => {
  const fixture = await makeFixture(t)
  fixture.entry.version = '1.0.1'
  let result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.entries[0].issues[0].code, 'identity-mismatch')
  assert.equal(result.entries[0].checkedFiles, 0)

  fixture.entry.version = '1.0.0'
  fixture.entry.minGame = '0.37.0'
  result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.entries[0].issues[0].code, 'identity-mismatch')

  fixture.entry.minGame = '0.36.1'
  fixture.entry.key = 'other'
  result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.entries[0].issues[0].code, 'identity-mismatch')
})

test('目录文件名单或逐文件散列不完整时失败', async t => {
  const fixture = await makeFixture(t)
  fixture.entry.files['extra.js'] = { url: 'http://127.0.0.1:1/extra.js', sha256: sha256(Buffer.from('extra')) }
  let result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.ok, false)
  assert.equal(result.entries[0].issues[0].code, 'catalog-mismatch')
  assert.match(result.entries[0].issues[0].message, /extra\.js/)

  delete fixture.entry.files['extra.js']
  fixture.entry.files['server.js'].sha256 = '0'.repeat(64)
  result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.ok, false)
  assert.equal(result.entries[0].bundleVerified, false)
  assert.equal(result.entries[0].checkedFiles, 3)
  assert.deepEqual(result.entries[0].issues, [{ file: 'server.js', code: 'catalog-hash-mismatch', message: 'catalog SHA256 mismatch: server.js' }])
})

test('无效身份、URL 和选择在访问网络前失败', async t => {
  const fixture = await makeFixture(t)
  const bundle = fixture.entry.bundle
  const bundleUrl = bundle.url

  fixture.entry.key = 'Bad Key'
  let result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.entries[0].issues[0].code, 'invalid-identity')

  fixture.entry.key = 'sample'
  fixture.entry.minGame = '0.36'
  result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.entries[0].issues[0].code, 'invalid-identity')

  fixture.entry.minGame = '0.36.1'
  fixture.entry.bundle.url = 'file:///tmp/sample.piggyext'
  result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.entries[0].issues[0].code, 'invalid-url')

  fixture.entry.bundle.url = bundleUrl
  delete fixture.entry.bundle
  result = await checkExtensionReleases(fixture.registry)
  assert.equal(result.entries[0].issues[0].code, 'missing-bundle')
  fixture.entry.bundle = bundle

  await assert.rejects(checkExtensionReleases(fixture.registry, { keys: ['missing'] }), error => error.code === 'invalid-catalog' && /unknown/.test(error.message))
  await assert.rejects(checkExtensionReleases(fixture.registry, { keys: [] }), error => error.code === 'invalid-catalog' && /empty/.test(error.message))
  await assert.rejects(checkExtensionReleases(fixture.registry, { keys: ['sample', 'sample'] }), error => error.code === 'invalid-catalog' && /duplicate/.test(error.message))
  await assert.rejects(checkExtensionReleases({ version: 1, extensions: [fixture.entry, fixture.entry] }), error => error.code === 'invalid-catalog' && /duplicate/.test(error.message))
  assert.deepEqual(fixture.requested, [])
})

test('CLI 缺少 --key 值时不读取目录', () => {
  const run = spawnSync(process.execPath, ['scripts/extension-release-check.mjs', '--host', 'github', '--key'], { cwd: REPO_ROOT, encoding: 'utf8' })
  assert.equal(run.status, 1)
  assert.match(run.stderr, /missing --key value/)
  assert.equal(run.stdout, '')
})

test('CLI 用 --registry 读取指定目录并以只读 JSON 返回', async t => {
  const fixture = await makeFixture(t)
  const { file } = writeTempRegistry(t, fixture.registry)
  const run = await runCli(['scripts/extension-release-check.mjs', '--registry', file, '--host', 'github', '--timeout-ms', '5000'])
  assert.equal(run.status, 0)
  assert.equal(run.stderr, '')
  const output = JSON.parse(run.stdout)
  assert.equal(output.mode, 'read-only')
  assert.equal(output.ok, true)
  assert.equal(output.results[0].host, 'github')
  assert.equal(output.results[0].source, 'explicit')
  assert.equal(output.results[0].entries[0].checkedFiles, 4)
  assert.deepEqual(fixture.requested, ['/sample.piggyext'])
})

test('CLI 在整包缺失时非零退出并保留错误码', async t => {
  const fixture = await makeFixture(t, { minGame: '0.36.0' })
  fixture.routes.delete('/sample.piggyext')
  const { file } = writeTempRegistry(t, fixture.registry)
  const run = await runCli(['scripts/extension-release-check.mjs', '--registry', file, '--host', 'github', '--timeout-ms', '5000'])
  assert.equal(run.status, 1)
  assert.equal(run.stderr, '')
  const output = JSON.parse(run.stdout)
  assert.equal(output.mode, 'read-only')
  assert.equal(output.ok, false)
  assert.equal(output.results[0].entries[0].issues[0].code, 'http-error')
  assert.equal(output.results[0].entries[0].legacyCheckedFiles, 0)
})

test('默认目录优先候选，没有候选时回退公开目录', t => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ext-registry-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  mkdirSync(join(dir, 'extensions'), { recursive: true })
  mkdirSync(join(dir, 'release-candidates', 'extensions'), { recursive: true })
  writeFileSync(join(dir, 'extensions', 'registry.json'), JSON.stringify({ version: 1, extensions: [] }))
  writeFileSync(join(dir, 'release-candidates', 'extensions', 'registry.json'), JSON.stringify({ version: 1, extensions: [] }))
  const root = pathToFileURL(dir + '/')
  let picked = defaultRegistry('github', root)
  assert.equal(picked.source, 'candidate')
  assert.equal(picked.file, join(dir, 'release-candidates', 'extensions', 'registry.json'))
  rmSync(join(dir, 'release-candidates'), { recursive: true, force: true })
  picked = defaultRegistry('github', root)
  assert.equal(picked.source, 'public')
  assert.equal(picked.file, join(dir, 'extensions', 'registry.json'))
})
