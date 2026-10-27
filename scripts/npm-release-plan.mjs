// @ts-check
/**
 * npm 发布前置检查：只读。算本地包的内容身份和 tarball 校验值、读 registry 现状，给出「主包先、别名包后」的计划。
 * 退出码 1 表示阻塞（已发布内容不同、registry 读不到、dist-tag 会倒退），工作流会在发布步骤前失败。
 * 已发布版本不能覆盖：主包已发、别名包没发时，重跑只补别名包。内容身份只看路径/大小/内容，不看压缩方式和
 * 权限位——同一个版本用不同 npm 或文件权限发布时 integrity 会不同，但内容一样，仍可安全跳过。
 * 用法：node scripts/npm-release-plan.mjs [--tag vX.Y.Z] [--repo owner/name] [--tarball-dir DIR] [--json] [--out FILE] [--expect-published]
 */
import { runNpmPack } from './npm-command.mjs'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

import { compareVersions } from '../apps/desktop/lib/versions.js'

export { compareVersions }

export const REGISTRY = 'https://registry.npmjs.org'
export const REPOSITORY = 'CLICGGER-TYPES/dsh-piggy'
/** 先主包、后别名包；顺序就是发布顺序（别名包精确依赖主包）。 */
export const PACKAGES = [
  { name: 'dsh-piggy', dir: '.' },
  { name: 'dsh-plugin-piggy', dir: 'packages/dsh-plugin-piggy' },
]

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/
const USAGE = '用法：node scripts/npm-release-plan.mjs [--tag vX.Y.Z] [--repo owner/name] [--tarball-dir DIR] [--json] [--out FILE] [--expect-published]'

/** 发布前检查发现的问题；任何一条都不许继续发布。 */
export class ReleaseBlocker extends Error {
  /** @param {{ code: string, detail: string }[]} problems */
  constructor(problems) {
    super(problems.map(problem => `[${problem.code}] ${problem.detail}`).join('\n'))
    this.name = 'ReleaseBlocker'
    /** @type {{ code: string, detail: string }[]} */
    this.problems = problems
    /** @type {any} */
    this.plan = null
  }
}

/** @param {string} code @param {string} detail */
function blocker(code, detail) {
  return new ReleaseBlocker([{ code, detail }])
}

/** 正式版只更新 latest；RC 只更新 rc，绝不碰稳定入口。 */
export function distTagFor(version) {
  const match = VERSION_PATTERN.exec(String(version))
  if (match === null) throw blocker('bad-version', `版本号 ${version} 不是 x.y.z 或 x.y.z-rc.N；项目只用这两种写法`)
  return match[4] === undefined ? 'latest' : 'rc'
}

/** `git+https://github.com/x/y.git` 和 `https://github.com/x/y` 视为同一个仓库。 */
export function normalizeRepository(url) {
  return String(url ?? '').replace(/^git\+/, '').replace(/\.git$/, '').replace(/\/$/, '')
}

/** @param {string} file */
function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** 内容身份：路径 + 大小 + 文件内容；不含压缩方式和权限位。 */
function digestOf(entries) {
  const lines = entries.map(entry => [entry.path, String(entry.size), entry.sha256]).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  return createHash('sha256').update(JSON.stringify(lines)).digest('hex')
}

/**
 * 读 npm tarball 里的文件条目。npm 只写普通文件；长路径用 ustar prefix 或 pax，读不懂就报错，不猜。
 * @param {Buffer} gz
 * @returns {{ entries: { path: string, size: number, sha256: string }[], digest: string }}
 */
export function tarballContent(gz) {
  let buf
  try { buf = gunzipSync(gz) } catch { throw blocker('tarball-format', '已发布的 tarball 不是有效的 gzip') }
  /** @type {{ path: string, size: number, sha256: string }[]} */
  const entries = []
  let pos = 0
  let pendingPath = null
  while (pos + 512 <= buf.length) {
    const header = buf.subarray(pos, pos + 512)
    if (header.every(byte => byte === 0)) break
    const size = Number.parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim() || '0', 8)
    if (!Number.isSafeInteger(size) || size < 0) throw blocker('tarball-format', 'tarball 文件大小无效')
    if (pos + 512 + size > buf.length) throw blocker('tarball-format', 'tarball 被截断')
    const type = String.fromCharCode(header[156])
    const data = buf.subarray(pos + 512, pos + 512 + size)
    let path = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '')
    if (prefix !== '') path = `${prefix}/${path}`
    if (type === 'x') pendingPath = /(?:^|\n)\d+ path=([^\n]+)\n/.exec(data.toString('utf8'))?.[1] ?? null
    else if (type === 'L') pendingPath = data.toString('utf8').replace(/\0.*$/, '')
    else if (type === '0' || type === '\0') {
      entries.push({ path: (pendingPath ?? path).replace(/^package\//, ''), size, sha256: createHash('sha256').update(data).digest('hex') })
      pendingPath = null
    } else if (type === '5' || type === 'g') pendingPath = null
    else throw blocker('tarball-format', 'tarball 含有不支持的文件类型')
    pos += 512 + Math.ceil(size / 512) * 512
  }
  if (entries.length === 0) throw blocker('tarball-format', 'tarball 里没有文件')
  return { entries, digest: digestOf(entries) }
}

/**
 * `npm pack --dry-run --json` 的结果：文件名、integrity/shasum（真实 tarball 的值）和文件清单。
 * @param {string} dir
 */
export function packDryRun(dir) {
  const output = runNpmPack(dir)
  const parsed = JSON.parse(output)
  const entry = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0]
  if (!entry || !Array.isArray(entry.files) || typeof entry.integrity !== 'string' || typeof entry.shasum !== 'string') {
    throw blocker('pack-output', `${dir}: 看不懂 npm pack --dry-run 的输出`)
  }
  return {
    name: String(entry.name), version: String(entry.version), filename: String(entry.filename),
    integrity: entry.integrity, shasum: entry.shasum, fileCount: entry.files.length, unpackedSize: Number(entry.unpackedSize),
    files: entry.files.map(file => ({ path: String(file.path), size: Number(file.size) })),
  }
}

/**
 * @param {string} root
 * @param {string|null} tarballDir 工作流 npm pack 的输出目录；给了就核对真实文件的内容
 * @returns {{ name: string, dir: string, manifest: any, pack: any }[]}
 */
export function collectLocal(root, tarballDir = null) {
  return PACKAGES.map(expected => {
    const full = join(root, expected.dir)
    const manifest = readJson(join(full, 'package.json'))
    if (manifest.name !== expected.name) throw blocker('local-name-mismatch', `${expected.dir}: 包名 ${manifest.name}，应为 ${expected.name}`)
    const pack = packDryRun(full)
    if (pack.name !== manifest.name || pack.version !== manifest.version) throw blocker('pack-output', `${expected.name}: npm pack 结果和 package.json 不一致`)
    const entries = pack.files.map(file => {
      let bytes
      try { bytes = readFileSync(join(full, file.path)) } catch { throw blocker('local-file-missing', `${expected.name}: 读不到 ${file.path}`) }
      if (bytes.length !== file.size) throw blocker('local-file-size', `${expected.name}: ${file.path} 的大小和 npm pack 的结果不一致`)
      return { path: file.path, size: file.size, sha256: createHash('sha256').update(bytes).digest('hex') }
    })
    const contentDigest = digestOf(entries)
    if (tarballDir !== null) {
      const name = join(tarballDir, pack.filename)
      let bytes
      try { bytes = readFileSync(name) } catch (error) {
        throw blocker('tarball-missing', `${name}: 读不到；先 npm pack 到 ${tarballDir}（${error instanceof Error ? error.message : String(error)}）`)
      }
      if (tarballContent(bytes).digest !== contentDigest) throw blocker('tarball-drift', `${pack.filename}: 实际 tarball 的内容和当前树不一致`)
    }
    return { name: expected.name, dir: expected.dir, manifest, pack: { ...pack, contentDigest } }
  })
}

/** 本地版本、别名依赖、仓库、标签互相一致才继续；这些问题不需要网络就能发现。 */
function validateLocal(packages, repoSlug, tag) {
  const problems = []
  const add = (code, detail) => problems.push({ code, detail })
  const version = packages[0]?.manifest?.version
  try {
    distTagFor(version)
  } catch (error) {
    if (error instanceof ReleaseBlocker) problems.push(...error.problems)
    else add('bad-version', String(error))
  }
  for (const pkg of packages) {
    if (pkg.manifest.version !== version) add('version-mismatch', `${pkg.name}: ${pkg.manifest.version} != ${version}`)
    const expectedName = `${pkg.name}-${version}.tgz`
    if (pkg.pack.filename !== expectedName) add('pack-filename', `${pkg.name}: ${pkg.pack.filename} != ${expectedName}`)
  }
  const alias = packages.find(pkg => pkg.name === 'dsh-plugin-piggy')
  if (alias === undefined) {
    add('missing-alias', '本地没找到 dsh-plugin-piggy')
  } else if (alias.manifest.dependencies?.['dsh-piggy'] !== version) {
    add('alias-dependency', `dsh-plugin-piggy 依赖 dsh-piggy@${alias.manifest.dependencies?.['dsh-piggy']}，应为 ${version}`)
  }
  if (repoSlug !== REPOSITORY) add('repo-mismatch', `仓库 ${repoSlug} 不是 ${REPOSITORY}`)
  const expectedRepository = normalizeRepository(`https://github.com/${REPOSITORY}`)
  for (const pkg of packages) {
    if (normalizeRepository(pkg.manifest.repository?.url) !== expectedRepository) add('repository-mismatch', `${pkg.name}: package.json repository 不是 ${expectedRepository}`)
  }
  const tagVersion = tag === null ? null : /^v(.+)$/.exec(tag)?.[1] ?? ''
  if (tagVersion !== null && !VERSION_PATTERN.test(tagVersion)) add('bad-tag', `标签 ${tag} 不是 v + x.y.z / v + x.y.z-rc.N`)
  else if (tagVersion !== null && tagVersion !== version) add('tag-version-mismatch', `标签 ${tag} 和 package.json 版本 ${version} 不一致`)
  if (problems.length > 0) throw new ReleaseBlocker(problems)
  return version
}

/** @typedef {{ status: number, body: any }} RegistryReply */

/**
 * 读完整 packument（一个包一次请求，含 dist-tags）。
 * 只有 npm 自己返回的 `{"error":"Not found"}` 才算「没有这个包」；其余 404/5xx/超时/非 JSON 都是状态不明。
 * @param {string} name
 * @param {(url: string) => Promise<RegistryReply>} get
 */
export async function readPackument(name, get) {
  const url = `${REGISTRY}/${name.startsWith('@') ? name.replace('/', '%2f') : name}`
  let reply
  try {
    reply = await get(url)
  } catch (error) {
    throw ambiguous(name, `请求失败：${error instanceof Error ? error.message : String(error)}`)
  }
  const status = reply?.status
  const body = reply?.body
  if (status === 404) {
    if (body === null || typeof body !== 'object' || typeof body.error !== 'string' || !/not found/i.test(body.error)) {
      throw ambiguous(name, '404 不是 npm 的 {"error":"Not found"}（可能是代理或网络问题）')
    }
    return { versions: {}, tags: {} }
  }
  if (status !== 200) throw ambiguous(name, `HTTP ${status}`)
  if (body === null || typeof body !== 'object' || body.name !== name || body.versions === null || typeof body.versions !== 'object' || Array.isArray(body.versions) || body['dist-tags'] === null || typeof body['dist-tags'] !== 'object' || Array.isArray(body['dist-tags'])) {
    throw ambiguous(name, '返回的不是这个包的 packument（可能被代理/登录页替换）')
  }
  return { versions: body.versions, tags: body['dist-tags'] }
}

/** @param {string} name @param {string} detail */
function ambiguous(name, detail) {
  return blocker('registry-ambiguous', `${name}: ${detail}；registry 状态不明时必须先查清，不能当作「版本不存在」继续发布`)
}

/** 已发布版本的元数据要和本地 tarball 完全一致；integrity 见下面的内容比对。 */
function metadataChecks(pkg, remote) {
  const manifest = pkg.manifest
  const checks = [
    ['name', manifest.name, remote.name], ['version', manifest.version, remote.version],
    ['license', manifest.license, remote.license], ['engines.node', manifest.engines?.node, remote.engines?.node],
    ['repository.url', normalizeRepository(manifest.repository?.url), normalizeRepository(remote.repository?.url)],
    ['dist.integrity', pkg.pack.integrity, remote.dist?.integrity], ['dist.shasum', pkg.pack.shasum, remote.dist?.shasum],
    ['dist.fileCount', pkg.pack.fileCount, remote.dist?.fileCount], ['dist.unpackedSize', pkg.pack.unpackedSize, remote.dist?.unpackedSize],
    ['dist.tarball', `${REGISTRY}/${pkg.name}/-/${pkg.pack.filename}`, remote.dist?.tarball],
  ]
  if (pkg.name === 'dsh-plugin-piggy') checks.push(['dependencies.dsh-piggy', manifest.dependencies?.['dsh-piggy'], remote.dependencies?.['dsh-piggy']])
  return checks
}

/** dist-tag 只许往前走；RC 不许占 latest，重跑旧 RC 也不许把 rc 往回退。 */
function checkDistTags(name, version, distTag, tags, expectPublished, problems) {
  const current = typeof tags?.[distTag] === 'string' ? tags[distTag] : null
  const latest = typeof tags?.latest === 'string' ? tags.latest : null
  if (distTag === 'rc' && latest === version) {
    problems.push({ code: 'rc-as-latest', detail: `${name}@${version} 是预发布版，但 latest 已经指向它；RC 不能占稳定入口` })
  } else if (distTag === 'latest' && latest !== null && compareVersions(latest, version) > 0) {
    problems.push({ code: 'latest-regression', detail: `${name}: latest 现在是 ${latest}，比要发的 ${version} 新；拒绝把 latest 往回退` })
  } else if (distTag === 'rc' && current !== null && compareVersions(current, version) > 0) {
    problems.push({ code: 'rc-regression', detail: `${name}: rc 现在是 ${current}，比要发的 ${version} 新；拒绝把 rc 往回退` })
  } else if (expectPublished && current !== version) {
    problems.push({ code: 'dist-tag-mismatch', detail: `${name}: dist-tag ${distTag} 是 ${current ?? '（没有）'}，应为 ${version}` })
  }
}

/** 读已发布 tarball 并算内容身份；网络失败必须报「状态不明」，不能当成内容不同或不存在。 */
async function publishedContent(getTarball, url, name) {
  if (typeof url !== 'string' || url === '') throw ambiguous(name, 'registry 没有给 tarball 地址')
  try { return tarballContent(await getTarball(url)) } catch (error) {
    if (error instanceof ReleaseBlocker) throw error
    throw ambiguous(name, `读取已发布 tarball 失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 读 registry、给出发布计划。不写任何东西。
 * @param {{ packages: any[], repoSlug?: string, tag?: string|null, get: (url: string) => Promise<RegistryReply>, getTarball?: (url: string) => Promise<Buffer>, expectPublished?: boolean }} options
 */
export async function planRelease(options) {
  const { packages, get } = options
  const getTarball = options.getTarball ?? /** @type {(url: string) => Promise<Buffer>} */ (async () => { throw new Error('没有提供读取 tarball 的方法') })
  const tag = options.tag ?? null
  const repoSlug = options.repoSlug ?? REPOSITORY
  const expectPublished = options.expectPublished === true
  const version = validateLocal(packages, repoSlug, tag)
  const distTag = distTagFor(version)
  const replies = await Promise.all(packages.map(pkg => readPackument(pkg.name, get)))
  const problems = []
  const planned = []
  for (let index = 0; index < packages.length; index += 1) {
    const pkg = packages[index]
    const remote = replies[index].versions[version]
    if (remote === undefined) {
      if (expectPublished) problems.push({ code: 'not-published', detail: `${pkg.name}@${version} 还不在 registry 上` })
      planned.push({ name: pkg.name, dir: pkg.dir, version, state: 'missing', action: expectPublished ? 'blocked' : 'publish', packaging: null, tolerated: [],
        tarball: pkg.pack.filename, integrity: pkg.pack.integrity, contentDigest: pkg.pack.contentDigest,
        fileCount: pkg.pack.fileCount, unpackedSize: pkg.pack.unpackedSize, registry: null, checks: [] })
      continue
    }
    const checks = metadataChecks(pkg, remote).map(([field, expected, actual]) => ({ field, expected, actual, ok: Object.is(expected, actual) }))
    const fastPath = checks.every(check => check.ok)
    const published = fastPath ? null : await publishedContent(getTarball, remote.dist?.tarball, pkg.name)
    const contentOk = published === null || (published.digest === pkg.pack.contentDigest && published.entries.length === pkg.pack.fileCount)
    if (!contentOk) problems.push({ code: 'published-drift', detail: `${pkg.name}@${version} 已发布 tarball 的内容和本地不同（路径/大小/内容至少一项）；版本号不能覆盖，只能升版本` })
    for (const check of checks) {
      if (!check.ok && !(check.field.startsWith('dist.') && contentOk)) problems.push({ code: 'published-drift', detail: `${pkg.name}@${version} 已发布但 ${check.field} 是 ${JSON.stringify(check.actual)}，应为 ${JSON.stringify(check.expected)}` })
    }
    const packaging = fastPath ? 'match' : contentOk ? 'repacked' : 'drift'
    planned.push({ name: pkg.name, dir: pkg.dir, version, state: contentOk ? 'identical' : 'drift', action: contentOk ? 'skip' : 'blocked',
      packaging, tolerated: contentOk ? checks.filter(check => !check.ok).map(check => check.field) : [],
      tarball: pkg.pack.filename, integrity: remote.dist?.integrity ?? null, contentDigest: pkg.pack.contentDigest,
      fileCount: remote.dist?.fileCount ?? null, unpackedSize: remote.dist?.unpackedSize ?? null, registry: remote.dist ?? null, checks })
  }
  for (let index = 0; index < packages.length; index += 1) {
    checkDistTags(packages[index].name, version, distTag, replies[index].tags, expectPublished, problems)
  }
  const steps = planned.filter(pkg => pkg.action === 'publish').map(pkg => ({ name: pkg.name, dir: pkg.dir, tarball: `npm-artifacts/${pkg.tarball}`,
    command: `npm publish npm-artifacts/${pkg.tarball} --access public --tag ${distTag}` }))
  const plan = { mode: expectPublished ? 'verify' : 'inspect', tag: tag ?? `v${version}`, version, repository: repoSlug,
    registry: REGISTRY, distTag, packages: planned, steps, ok: problems.length === 0 }
  if (problems.length > 0) {
    const error = new ReleaseBlocker(problems)
    error.plan = plan
    throw error
  }
  return plan
}

/** @param {any} plan */
function describe(plan) {
  const lines = [
    `npm release plan (${plan.mode}): ${plan.version} -> dist-tag ${plan.distTag}`,
    `tag ${plan.tag}, repository ${plan.repository}, registry ${plan.registry}`,
  ]
  for (const pkg of plan.packages) lines.push(`- ${pkg.name}@${pkg.version}: ${pkg.action === 'publish' ? 'missing -> publish' : pkg.action === 'blocked' ? 'content drift -> blocked' : `content identical (${pkg.packaging}) -> skip`}`)
  if (plan.steps.length === 0) lines.push('nothing to publish')
  else {
    lines.push('planned commands (reviewed workflow only; this script never runs them):')
    for (const step of plan.steps) lines.push(`  ${step.command}`)
  }
  return lines.join('\n')
}

/**
 * @typedef {{ tag: string|null, repoSlug: string, tarballDir: string|null, json: boolean, out: string|null, expectPublished: boolean, help: boolean }} CliArgs
 */
/** @param {string[]} argv @returns {CliArgs} */
export function parseArgs(argv) {
  const args = { tag: null, repoSlug: REPOSITORY, tarballDir: null, json: false, out: null, expectPublished: false, help: false }
  const valued = ['--tag', '--repo', '--tarball-dir', '--out']
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--json') { args.json = true; continue }
    if (flag === '--expect-published') { args.expectPublished = true; continue }
    if (flag === '--help' || flag === '-h') { args.help = true; continue }
    const value = argv[index + 1]
    if (!valued.includes(flag) || value === undefined) throw blocker('bad-argument', valued.includes(flag) ? `${flag} 缺少值` : `未知参数 ${flag}`)
    index += 1
    if (flag === '--tag') args.tag = value
    else if (flag === '--repo') args.repoSlug = value
    else if (flag === '--tarball-dir') args.tarballDir = value
    else args.out = value
  }
  return args
}

/** 真实的 registry GET；不读本机 npm 配置，不带任何凭据。 */
async function fetchRegistry(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(20_000) })
  const text = await response.text()
  let body = text
  try { body = JSON.parse(text) } catch { /* 原文交给上层判成状态不明 */ }
  return { status: response.status, body }
}

/** 真实的已发布 tarball GET；同样不带凭据。 */
async function fetchTarball(url) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(60_000) })
  if (response.status !== 200) throw new Error(`下载已发布 tarball 失败：HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(USAGE)
    return
  }
  const root = fileURLToPath(new URL('..', import.meta.url))
  const packages = collectLocal(root, args.tarballDir)
  const plan = await planRelease({ packages, repoSlug: args.repoSlug, tag: args.tag, get: fetchRegistry, getTarball: fetchTarball, expectPublished: args.expectPublished })
  if (args.out !== null) writeFileSync(args.out, JSON.stringify(plan, null, 2) + '\n')
  console.log(args.json ? JSON.stringify(plan, null, 2) : describe(plan))
}

// 只在直接运行时读 registry；测试 import 这个模块时不许联网。
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    if (error instanceof ReleaseBlocker) {
      console.error(`npm release plan blocked:\n${error.message}`)
      if (error.plan !== null) console.error(describe(error.plan))
    } else {
      console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    }
    process.exit(1)
  })
}
