// @ts-check
/**
 * npm 发布前置检查的测试：注入 registry 响应和 tarball，不访问网络、不发布。
 * 覆盖半发布重试、内容不一致、registry 状态不明、RC 与 latest 隔离、标签/仓库校验、tarball 内容身份。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'

import {
  REGISTRY, REPOSITORY, ReleaseBlocker, collectLocal, compareVersions, distTagFor, packDryRun, parseArgs, planRelease, tarballContent,
} from '../scripts/npm-release-plan.mjs'

const VERSION = '0.37.2'

/** 本地两个包的 tarball 结果（和 npm pack 的形状一致）。 */
function localPackage(name, version = VERSION) {
  const isAlias = name === 'dsh-plugin-piggy'
  const manifest = {
    name, version, license: 'MIT', type: 'module', main: 'index.js', engines: { node: '>=20' },
    repository: { type: 'git', url: 'git+https://github.com/CLICGGER-TYPES/dsh-piggy.git' },
    dsh: { bundle: { patch: './cordis.patch.yml' } },
    ...(isAlias ? { dependencies: { 'dsh-piggy': version } } : {}),
  }
  const pack = {
    name, version, filename: `${name}-${version}.tgz`, integrity: `sha512-${name}-${version}`,
    shasum: 'a'.repeat(40), fileCount: 1, unpackedSize: 32, contentDigest: `content-${name}-${version}`,
  }
  return { name, dir: isAlias ? 'packages/dsh-plugin-piggy' : '.', manifest, pack }
}

function localPackages(version = VERSION) {
  return [localPackage('dsh-piggy', version), localPackage('dsh-plugin-piggy', version)]
}

/** registry 上已存在的一条版本记录（字段和 packument 的 versions[x] 一致）。 */
function remoteDoc(pkg) {
  const isAlias = pkg.name === 'dsh-plugin-piggy'
  return {
    name: pkg.name, version: pkg.manifest.version, license: 'MIT', type: 'module', main: 'index.js', engines: { node: '>=20' },
    repository: { url: 'git+https://github.com/CLICGGER-TYPES/dsh-piggy.git' },
    dsh: { bundle: { patch: './cordis.patch.yml' } },
    ...(isAlias ? { dependencies: { 'dsh-piggy': pkg.manifest.version } } : {}),
    dist: {
      integrity: pkg.pack.integrity, shasum: pkg.pack.shasum, fileCount: pkg.pack.fileCount,
      unpackedSize: pkg.pack.unpackedSize, tarball: `${REGISTRY}/${pkg.name}/-/${pkg.pack.filename}`,
    },
  }
}

/** 造一个最小 npm 风格的 tarball（gzip + ustar，普通文件，name 用 package/ 前缀）。 */
function tarGz(files) {
  const blocks = []
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text)
    const header = Buffer.alloc(512)
    header.write(name, 0, 100)
    header.write('0000644\0', 100)
    header.write(`${data.length.toString(8).padStart(11, '0')}\0`, 124)
    header.write('00000000000\0', 136)
    header.write('        ', 148)
    header[156] = '0'.charCodeAt(0)
    blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512))
  }
  blocks.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(blocks))
}

/** 让本地 pack 的内容身份等于这个 tarball，便于单独测试元数据差异。 */
function alignContent(pkg, files = { 'package/package.json': JSON.stringify({ name: pkg.name, version: pkg.manifest.version }) }) {
  const tar = tarGz(files)
  const content = tarballContent(tar)
  pkg.pack.contentDigest = content.digest
  pkg.pack.fileCount = content.entries.length
  pkg.pack.unpackedSize = content.entries.reduce((sum, entry) => sum + entry.size, 0)
  return tar
}

function registryReply(name, docs, tags = {}) {
  return { status: 200, body: { name, versions: Object.fromEntries(docs.map(doc => [doc.version, doc])), 'dist-tags': tags } }
}

const NOT_FOUND = { status: 404, body: { error: 'Not found' } }

/** 按 URL 分发注入的响应；抛错表示网络失败。 */
function fakeGet(replies) {
  return async url => {
    const reply = replies[url.slice(REGISTRY.length + 1)]
    if (reply === undefined) throw new Error(`未预期的 registry 请求：${url}`)
    if (reply instanceof Error) throw reply
    return reply
  }
}

function run(options) {
  const packages = options.packages ?? localPackages(options.version)
  return planRelease({
    packages,
    tag: options.tag ?? `v${packages[0].manifest.version}`,
    repoSlug: options.repoSlug,
    get: fakeGet(options.replies),
    getTarball: options.getTarball ?? (async url => { throw new Error(`不该下载 tarball：${url}`) }),
    expectPublished: options.expectPublished,
  })
}

async function expectBlocker(promise, code) {
  await assert.rejects(promise, error => {
    assert.ok(error instanceof ReleaseBlocker, `应为 ReleaseBlocker，实际：${error}`)
    assert.ok(error.problems.some(problem => problem.code === code), `缺少 ${code}，实际：${error.message}`)
    return true
  })
}

test('正式版走 latest，RC 走 rc；版本写法只认 x.y.z 和 x.y.z-rc.N', () => {
  assert.equal(distTagFor('0.37.2'), 'latest')
  assert.equal(distTagFor('0.37.2-rc.1'), 'rc')
  assert.throws(() => distTagFor('0.37.2-beta.1'))
  assert.throws(() => distTagFor('v0.37.2'))
  assert.ok(compareVersions('0.37.2-rc.10', '0.37.2-rc.9') > 0)
  assert.ok(compareVersions('0.37.2', '0.37.2-rc.9') > 0)
  assert.equal(compareVersions('0.37.2', 'v0.37.2'), 0)
})

test('主包已发布且一致、别名包还没发：只补别名包（半发布可恢复）', async () => {
  const packages = localPackages()
  const plan = await run({
    packages,
    replies: {
      'dsh-piggy': registryReply('dsh-piggy', [remoteDoc(packages[0])], { latest: '0.37.0' }),
      'dsh-plugin-piggy': NOT_FOUND,
    },
  })
  assert.equal(plan.ok, true)
  assert.equal(plan.distTag, 'latest')
  assert.deepEqual(plan.packages.map(pkg => [pkg.name, pkg.state, pkg.action]), [
    ['dsh-piggy', 'identical', 'skip'],
    ['dsh-plugin-piggy', 'missing', 'publish'],
  ])
  assert.equal(plan.packages[0].packaging, 'match')
  assert.deepEqual(plan.steps.map(step => step.name), ['dsh-plugin-piggy'])
  assert.match(plan.steps[0].command, /dsh-plugin-piggy-0\.37\.2\.tgz --access public --tag latest$/)
})

test('两个包都已发布且一致：没有要执行的步骤', async () => {
  const packages = localPackages()
  const plan = await run({
    packages,
    replies: {
      'dsh-piggy': registryReply('dsh-piggy', [remoteDoc(packages[0])], { latest: VERSION }),
      'dsh-plugin-piggy': registryReply('dsh-plugin-piggy', [remoteDoc(packages[1])], { latest: VERSION }),
    },
    expectPublished: true,
  })
  assert.deepEqual(plan.steps, [])
  assert.deepEqual(plan.packages.map(pkg => pkg.action), ['skip', 'skip'])
})

test('打包方式不同（integrity 不同、内容相同）：跳过而不是阻塞', async () => {
  const packages = localPackages()
  const tar = alignContent(packages[0])
  const doc = remoteDoc(packages[0])
  doc.dist.integrity = 'sha512-published-with-another-npm'
  doc.dist.shasum = 'b'.repeat(40)
  const plan = await run({ packages, replies: { 'dsh-piggy': registryReply('dsh-piggy', [doc], { latest: '0.37.0' }), 'dsh-plugin-piggy': NOT_FOUND },
    getTarball: async () => tar })
  assert.equal(plan.packages[0].action, 'skip')
  assert.equal(plan.packages[0].packaging, 'repacked')
  assert.deepEqual(plan.packages[0].tolerated, ['dist.integrity', 'dist.shasum'])
  assert.deepEqual(plan.steps.map(step => step.name), ['dsh-plugin-piggy'])
})

test('已发布 tarball 内容不同：阻塞，不覆盖、不发布另一个包', async () => {
  const packages = localPackages()
  const doc = remoteDoc(packages[0])
  doc.dist.integrity = 'sha512-other'
  const tar = tarGz({ 'package/package.json': '{"name":"other"}' })
  await assert.rejects(run({ packages, replies: { 'dsh-piggy': registryReply('dsh-piggy', [doc], { latest: '0.37.0' }),
    'dsh-plugin-piggy': registryReply('dsh-plugin-piggy', [remoteDoc(packages[1])], { latest: '0.37.0' }) },
  getTarball: async () => tar }), error => {
    assert.ok(error instanceof ReleaseBlocker)
    assert.ok(error.problems.some(problem => problem.code === 'published-drift' && problem.detail.includes('内容和本地不同')))
    assert.equal(error.plan.ok, false)
    assert.equal(error.plan.steps.length, 0)
    return true
  })
})

test('已发布元数据不同（内容相同）：阻塞并指出字段', async () => {
  const packages = localPackages()
  const tar = alignContent(packages[0])
  for (const [field, mutate] of [
    ['license', doc => { doc.license = 'Apache-2.0' }],
    ['repository.url', doc => { doc.repository.url = 'git+https://github.com/someone/fork.git' }],
  ]) {
    const doc = remoteDoc(packages[0])
    mutate(doc)
    await assert.rejects(run({ packages, replies: { 'dsh-piggy': registryReply('dsh-piggy', [doc], { latest: '0.37.0' }), 'dsh-plugin-piggy': NOT_FOUND },
      getTarball: async () => tar }), error => {
      assert.ok(error.problems.some(problem => problem.code === 'published-drift' && problem.detail.includes(field)), error.message)
      return true
    })
  }
})

test('别名包已发布但依赖的版本不对：阻塞', async () => {
  const packages = localPackages()
  const tar = alignContent(packages[1])
  const doc = remoteDoc(packages[1])
  doc.dependencies['dsh-piggy'] = '0.37.1'
  await assert.rejects(run({ packages, replies: { 'dsh-piggy': NOT_FOUND, 'dsh-plugin-piggy': registryReply('dsh-plugin-piggy', [doc], { latest: '0.37.0' }) },
    getTarball: async () => tar }), error => {
    assert.ok(error.problems.some(problem => problem.code === 'published-drift' && problem.detail.includes('dependencies.dsh-piggy')))
    return true
  })
})

test('registry 状态不明一律阻塞，不能当成版本缺失去发布', async () => {
  const packages = localPackages()
  const cases = [
    ['网络失败', () => { throw new Error('ECONNRESET') }],
    ['HTTP 500', () => ({ status: 500, body: { error: 'oops' } })],
    ['代理返回的 HTML 404', () => ({ status: 404, body: '<html>blocked</html>' })],
    ['200 但不是 JSON', () => ({ status: 200, body: 'not json' })],
    ['别的包的 packument', () => ({ status: 200, body: { name: 'other-package', versions: {}, 'dist-tags': {} } })],
  ]
  for (const [label, reply] of cases) {
    const get = async url => (url.endsWith('/dsh-piggy') ? reply() : NOT_FOUND)
    await assert.rejects(planRelease({ packages, tag: `v${VERSION}`, get }), error => {
      assert.ok(error instanceof ReleaseBlocker, label)
      assert.ok(error.problems.some(problem => problem.code === 'registry-ambiguous'), `${label}：${error.message}`)
      return true
    })
  }
})

test('已发布 tarball 下载失败或格式不对：同样失败，不当成内容不同', async () => {
  const packages = localPackages()
  alignContent(packages[0])
  const doc = remoteDoc(packages[0])
  doc.dist.integrity = 'sha512-other'
  const replies = { 'dsh-piggy': registryReply('dsh-piggy', [doc], { latest: '0.37.0' }), 'dsh-plugin-piggy': NOT_FOUND }
  await expectBlocker(run({ packages, replies, getTarball: async () => { throw new Error('ECONNRESET') } }), 'registry-ambiguous')
  await assert.rejects(run({ packages, replies, getTarball: async () => Buffer.from('not a gzip') }), error => {
    assert.ok(error instanceof ReleaseBlocker)
    assert.equal(error.problems[0].code, 'tarball-format')
    return true
  })
})

test('RC 只更新 rc，不碰 latest；rc 或 latest 都不许往回退', async () => {
  const version = '0.37.2-rc.2'
  const packages = localPackages(version)
  const plan = await run({
    packages,
    replies: {
      'dsh-piggy': registryReply('dsh-piggy', [], { latest: '0.37.1', rc: '0.37.2-rc.1' }),
      'dsh-plugin-piggy': registryReply('dsh-plugin-piggy', [], { latest: '0.37.1', rc: '0.37.2-rc.1' }),
    },
  })
  assert.equal(plan.distTag, 'rc')
  assert.deepEqual(plan.steps.map(step => step.name), ['dsh-piggy', 'dsh-plugin-piggy'])
  assert.match(plan.steps[0].command, /--tag rc$/)

  const newerRc = { 'dsh-piggy': registryReply('dsh-piggy', [], { latest: '0.37.1', rc: '0.37.2-rc.3' }), 'dsh-plugin-piggy': NOT_FOUND }
  await expectBlocker(run({ packages, replies: newerRc }), 'rc-regression')

  const rcIsLatest = { 'dsh-piggy': registryReply('dsh-piggy', [], { latest: version, rc: '0.37.2-rc.1' }), 'dsh-plugin-piggy': NOT_FOUND }
  await expectBlocker(run({ packages, replies: rcIsLatest }), 'rc-as-latest')

  const stable = localPackages()
  const newerLatest = { 'dsh-piggy': registryReply('dsh-piggy', [], { latest: '0.37.3' }), 'dsh-plugin-piggy': NOT_FOUND }
  await expectBlocker(run({ packages: stable, replies: newerLatest }), 'latest-regression')
})

test('发布后核对：两个包都在、dist-tag 指对版本才算成功', async () => {
  const version = '0.37.2-rc.2'
  const packages = localPackages(version)
  const present = {
    'dsh-piggy': registryReply('dsh-piggy', [remoteDoc(packages[0])], { latest: '0.37.1', rc: version }),
    'dsh-plugin-piggy': registryReply('dsh-plugin-piggy', [remoteDoc(packages[1])], { latest: '0.37.1', rc: version }),
  }
  const plan = await run({ packages, replies: present, expectPublished: true })
  assert.equal(plan.mode, 'verify')
  assert.deepEqual(plan.steps, [])

  await expectBlocker(run({ packages, replies: { ...present, 'dsh-plugin-piggy': NOT_FOUND }, expectPublished: true }), 'not-published')

  const staleTag = {
    ...present,
    'dsh-plugin-piggy': registryReply('dsh-plugin-piggy', [remoteDoc(packages[1])], { latest: '0.37.1', rc: '0.37.2-rc.1' }),
  }
  await expectBlocker(run({ packages, replies: staleTag, expectPublished: true }), 'dist-tag-mismatch')
})

test('标签、仓库、别名依赖和版本写法先校验，出错时不读 registry', async () => {
  const packages = localPackages()
  const reply = () => { throw new Error('本地校验失败时不该请求 registry') }

  await expectBlocker(run({ packages, tag: '0.37.2', replies: { 'dsh-piggy': reply } }), 'bad-tag')
  await expectBlocker(run({ packages, tag: 'v0.37.1', replies: { 'dsh-piggy': reply } }), 'tag-version-mismatch')
  await expectBlocker(run({ packages, tag: 'v0.37.2-beta.1', replies: { 'dsh-piggy': reply } }), 'bad-tag')
  await expectBlocker(run({ packages, tag: `v${VERSION}`, repoSlug: 'someone/fork', replies: { 'dsh-piggy': reply } }), 'repo-mismatch')

  const aliasDrift = localPackages()
  aliasDrift[1].manifest.dependencies['dsh-piggy'] = '0.37.1'
  await expectBlocker(run({ packages: aliasDrift, replies: { 'dsh-piggy': reply } }), 'alias-dependency')

  const badVersion = localPackages('0.37.2-beta.1')
  await expectBlocker(run({ packages: badVersion, replies: { 'dsh-piggy': reply } }), 'bad-version')
})

test('读 npm tarball：去掉 package/ 前缀，按路径和内容算身份', () => {
  const content = tarballContent(tarGz({ 'package/a.txt': 'a', 'package/b/c.txt': 'cc' }))
  assert.deepEqual(content.entries.map(entry => [entry.path, entry.size]), [['a.txt', 1], ['b/c.txt', 2]])
  assert.match(content.digest, /^[0-9a-f]{64}$/)
  assert.notEqual(content.digest, tarballContent(tarGz({ 'package/a.txt': 'different' })).digest)
  assert.throws(() => tarballContent(Buffer.from('nope')), error => error.problems[0].code === 'tarball-format')
})

test('CLI 参数默认只检查；没有发布开关', () => {
  const args = parseArgs(['--tag', 'v0.37.2', '--tarball-dir', 'npm-artifacts', '--json', '--out', 'npm-plan.json', '--expect-published'])
  assert.deepEqual(args, {
    tag: 'v0.37.2', repoSlug: REPOSITORY, tarballDir: 'npm-artifacts', json: true,
    out: 'npm-plan.json', expectPublished: true, help: false,
  })
  assert.throws(() => parseArgs(['--publish']), /未知参数/)
  assert.throws(() => parseArgs(['--tag']), /缺少值/)
})

test('脚本只调用 npm pack，源码里没有 npm publish 执行入口或凭据', () => {
  const source = readFileSync(new URL('../scripts/npm-release-plan.mjs', import.meta.url), 'utf8')
  assert.equal((source.match(/execFileSync\(/g) ?? []).length, 1)
  assert.match(source, /execFileSync\('npm', PACK_ARGS/)
  assert.match(source, /\['pack', '--json', '--dry-run', '--ignore-scripts'\]/)
  assert.doesNotMatch(source, /method:\s*'POST'/)
  assert.doesNotMatch(source, /NODE_AUTH_TOKEN|NPM_TOKEN|_authToken/)
})

test('collectLocal 能用 npm pack 的文件清单算出真实内容身份；packDryRun 的 integrity 是真实值', () => {
  const packages = collectLocal(fileURLToPath(new URL('..', import.meta.url)))
  assert.deepEqual(packages.map(pkg => pkg.name), ['dsh-piggy', 'dsh-plugin-piggy'])
  for (const pkg of packages) {
    assert.match(pkg.pack.integrity, /^sha512-[A-Za-z0-9+/]+=*$/)
    assert.match(pkg.pack.shasum, /^[0-9a-f]{40}$/)
    assert.match(pkg.pack.contentDigest, /^[0-9a-f]{64}$/)
    assert.ok(pkg.pack.fileCount > 0)
    assert.ok(pkg.pack.unpackedSize > 0)
  }
  assert.match(packDryRun(fileURLToPath(new URL('../packages/dsh-plugin-piggy', import.meta.url))).filename, /^dsh-plugin-piggy-.+\.tgz$/)
})

test('tarball comparison rejects unsupported link entries rather than silently ignoring them', () => {
  const bytes = gunzipSync(tarGz({ 'package/a': 'a', 'package/b': 'b' }))
  bytes[1024 + 156] = '2'.charCodeAt(0)
  assert.throws(() => tarballContent(gzipSync(bytes)), /不支持的文件类型/)
})

test('tarball comparison rejects an invalid file size after valid entries', () => {
  const bytes = gunzipSync(tarGz({ 'package/a': 'a', 'package/b': 'b' }))
  bytes.fill(0, 1024 + 124, 1024 + 136)
  bytes.write('invalid', 1024 + 124)
  assert.throws(() => tarballContent(gzipSync(bytes)), /文件大小无效/)
})
