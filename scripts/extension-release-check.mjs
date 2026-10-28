// @ts-check
/**
 * 只读回读扩展附件：确认候选目录里的整包、包内身份和逐文件散列都真的下载得到。
 * 全部成功后才允许把候选目录晋级为公开目录；本脚本不上传、不修改目录、不推送。
 *
 * 目录选择顺序：存在 release-candidates/extensions/registry*.json 时先查候选，
 * 没有候选才查公开的 extensions/registry*.json（和 test/extensions-registry.test.js 一致）。
 * 0.36.1 起新宿主只下整包，所以现代扩展只回读 bundle；minGame < 0.36.1 的旧宿主
 * 仍逐件下载，必须另外回读 files 里的代码和图片，整包有效不能证明旧链路可用。
 *
 * 用法：node scripts/extension-release-check.mjs [--host github|gitee|both] [--key farm,mine]
 *       [--registry <file>] [--timeout-ms <ms>]
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBundle } from '../store/ext-import.js'
import { inBatches } from '../store/ext-files.js'
import { versionAtLeast } from '../store/ext-runtime.js'

const HASH = /^[a-f0-9]{64}$/
const VERSION = /^\d+\.\d+\.\d+$/
const KEY = /^[a-z0-9-]{2,24}$/
const MODERN_MIN_GAME = '0.36.1'
const DEFAULT_TIMEOUT_MS = 20_000
const REPO_ROOT = new URL('..', import.meta.url)
/** @type {Record<string,string>} */
const PUBLIC_REGISTRY = { github: 'extensions/registry.json', gitee: 'extensions/registry-gitee.json' }
/** @type {Record<string,string>} */
const CANDIDATE_REGISTRY = { github: 'release-candidates/extensions/registry.json', gitee: 'release-candidates/extensions/registry-gitee.json' }
const USAGE = 'usage: extension-release-check.mjs [--host github|gitee|both] [--key farm,mine] [--registry <file>] [--timeout-ms <ms>]'

/** 带稳定错误码的检查失败，CLI 和 fixture 都按 code 判断，不再靠文案匹配。 */
class ReleaseCheckError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message)
    this.name = 'ReleaseCheckError'
    this.code = code
  }
}

/** @param {string} code @param {string} message @returns {never} */
const fail = (code, message) => { throw new ReleaseCheckError(code, message) }

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const messageOf = error => error instanceof Error ? error.message : String(error)

/** 顺着 cause 链找最里层错误码，日志里保留真正原因。 @param {any} error */
function networkDetail(error) {
  let current = error
  for (let depth = 0; depth < 5 && current !== null && typeof current === 'object'; depth += 1) {
    if (typeof current.code === 'string' && current.code !== '') return current.code
    current = current.cause
  }
  return messageOf(error)
}

/** 只接受公开的 http(s) 附件地址；拒绝凭据、查询串和片段，避免把检查变成任意 URL 读取。 @param {string} url @returns {URL} */
function parseAttachmentUrl(url) {
  let address = null
  try { address = new URL(url) } catch { fail('invalid-url', 'invalid attachment URL') }
  if (address === null) fail('invalid-url', 'invalid attachment URL')
  if (!['http:', 'https:'].includes(address.protocol) || address.username !== '' || address.password !== '' || address.search !== '' || address.hash !== '') {
    fail('invalid-url', 'invalid attachment URL')
  }
  return address
}

/** @param {string} url @param {any} options */
async function download(url, options) {
  parseAttachmentUrl(url)
  let response = null
  try {
    response = await (options.fetch ?? globalThis.fetch)(url, { signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) })
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    fail(timeout ? 'timeout' : 'network-error', `fetch failed: ${networkDetail(error)}`)
  }
  if (response === null) fail('network-error', 'fetch failed: no response')
  if (!response.ok) fail('http-error', `HTTP ${response.status}`)
  try {
    return Buffer.from(await response.arrayBuffer())
  } catch (error) {
    fail('network-error', `response read failed: ${networkDetail(error)}`)
  }
}

/** @param {any} error @param {string} file */
function issueFrom(error, file) {
  if (error instanceof ReleaseCheckError) return { file, code: error.code, message: error.message }
  return { file, code: 'unexpected-error', message: messageOf(error) }
}

/** 目录条目必须先有可检查的身份和逐文件地址；坏目录不去碰网络。 @param {any} entry */
function validateEntry(entry) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) fail('invalid-identity', 'extension entry must be an object')
  if (!KEY.test(entry.key ?? '') || !VERSION.test(entry.version ?? '') || !VERSION.test(entry.minGame ?? '')) {
    fail('invalid-identity', 'invalid extension key, version or minGame')
  }
  if (entry.bundle === null || typeof entry.bundle !== 'object' || typeof entry.bundle.url !== 'string' || entry.bundle.url === '' || !HASH.test(entry.bundle.sha256 ?? '')) {
    fail('missing-bundle', 'missing bundle URL or SHA256')
  }
  if (entry.files === null || typeof entry.files !== 'object' || Array.isArray(entry.files)) {
    fail('invalid-catalog', 'missing or invalid catalog files')
  }
  for (const [name, spec] of Object.entries(entry.files)) {
    if (spec === null || typeof spec !== 'object' || typeof spec.url !== 'string' || spec.url === '' || !HASH.test(spec.sha256 ?? '')) {
      fail('invalid-catalog', `invalid catalog file spec: ${name}`)
    }
  }
}

const sameList = (left, right) => left.length === right.length && left.every((value, index) => value === right[index])

/** @param {string[]} bundleNames @param {string[]} catalogNames */
function describeListDifference(bundleNames, catalogNames) {
  const missing = bundleNames.filter(name => !catalogNames.includes(name))
  const extra = catalogNames.filter(name => !bundleNames.includes(name))
  const parts = []
  if (missing.length > 0) parts.push('missing: ' + missing.join(','))
  if (extra.length > 0) parts.push('extra: ' + extra.join(','))
  return parts.length > 0 ? parts.join('; ') : 'order mismatch'
}

/** @param {any} result */
function finalize(result) {
  result.issues.sort((left, right) => left.file.localeCompare(right.file) || left.code.localeCompare(right.code))
  result.ok = result.issues.length === 0
  return result
}

/**
 * 检查一条目录条目。现代条目只回读 bundle；旧宿主条目额外逐件回读 files。
 * 所有失败都收进 issues，不抛异常，调用方可以一次看到整批问题。
 * @param {any} entry
 * @param {{fetch?: typeof fetch, timeoutMs?: number}} [options]
 */
export async function checkExtensionRelease(entry, options = {}) {
  const result = {
    key: entry?.key,
    version: entry?.version,
    minGame: entry?.minGame,
    ok: false,
    legacyRequired: false,
    bundleVerified: false,
    expectedFiles: 0,
    checkedFiles: 0,
    legacyCheckedFiles: 0,
    issues: /** @type {any[]} */ ([]),
  }
  /** @type {any} */
  let bundle = null
  try {
    validateEntry(entry)
    result.legacyRequired = !versionAtLeast(entry.minGame, MODERN_MIN_GAME)
    const bytes = await download(entry.bundle.url, options)
    if (sha256(bytes) !== entry.bundle.sha256) fail('bundle-hash-mismatch', 'bundle SHA256 mismatch')
    bundle = parseBundle(bytes.toString('utf8'))
    if (!bundle.ok) fail('bundle-invalid', bundle.message)
    result.expectedFiles = Object.keys(bundle.hashes).length
    if (bundle.key !== entry.key || bundle.manifest?.version !== entry.version || bundle.manifest?.minGame !== entry.minGame) {
      fail('identity-mismatch', 'bundle manifest identity or minGame mismatch')
    }
    const bundleNames = Object.keys(bundle.hashes).sort()
    const catalogNames = Object.keys(entry.files).sort()
    if (!sameList(bundleNames, catalogNames)) {
      fail('catalog-mismatch', `catalog file list mismatch (${describeListDifference(bundleNames, catalogNames)})`)
    }
    const mismatches = []
    for (const name of bundleNames) {
      if (entry.files[name].sha256 !== bundle.hashes[name]) {
        mismatches.push({ file: name, code: 'catalog-hash-mismatch', message: `catalog SHA256 mismatch: ${name}` })
      } else {
        result.checkedFiles += 1
      }
    }
    if (mismatches.length > 0) {
      result.issues.push(...mismatches)
      return finalize(result)
    }
    result.bundleVerified = true
  } catch (error) {
    result.issues.push(issueFrom(error, 'bundle'))
    return finalize(result)
  }
  if (bundle === null) {
    result.issues.push({ file: 'bundle', code: 'bundle-invalid', message: 'bundle was not parsed' })
    return finalize(result)
  }
  if (result.legacyRequired) {
    await inBatches(Object.keys(bundle.hashes).map(name => async () => {
      try {
        const bytes = await download(entry.files[name].url, options)
        if (sha256(bytes) !== bundle.hashes[name]) fail('attachment-hash-mismatch', 'attachment SHA256 mismatch')
        result.legacyCheckedFiles += 1
      } catch (error) {
        result.issues.push(issueFrom(error, name))
      }
    }), 3)
  }
  return finalize(result)
}

/**
 * 检查一份目录。keys 为空/未知/重复和目录为空/重复都直接拒绝，避免“没检查就算通过”。
 * @param {any} registry
 * @param {{keys?: string[], fetch?: typeof fetch, timeoutMs?: number}} [options]
 */
export async function checkExtensionReleases(registry, options = {}) {
  if (registry === null || typeof registry !== 'object' || registry.version !== 1 || !Array.isArray(registry.extensions) || registry.extensions.length === 0) {
    fail('invalid-catalog', 'invalid extension catalog')
  }
  for (const entry of registry.extensions) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) fail('invalid-catalog', 'invalid extension catalog entry')
  }
  const entries = registry.extensions.filter(entry => entry.builtin !== true)
  const names = entries.map(entry => entry.key)
  if (names.length === 0 || names.some(name => typeof name !== 'string') || new Set(names).size !== names.length) {
    fail('invalid-catalog', 'empty or duplicate extension catalog')
  }
  const keys = options.keys ?? names
  if (!Array.isArray(keys) || keys.length === 0 || keys.some(key => typeof key !== 'string' || !names.includes(key))) {
    fail('invalid-catalog', 'unknown or empty extension selection')
  }
  if (new Set(keys).size !== keys.length) fail('invalid-catalog', 'duplicate extension selection')
  const results = []
  for (const entry of entries.filter(candidate => keys.includes(candidate.key))) {
    results.push(await checkExtensionRelease(entry, options))
  }
  return {
    ok: results.every(result => result.ok),
    entries: results,
    checkedEntries: results.length,
    checkedFiles: results.reduce((sum, result) => sum + result.checkedFiles, 0),
    legacyCheckedFiles: results.reduce((sum, result) => sum + result.legacyCheckedFiles, 0),
  }
}

/**
 * 默认先看候选目录；候选不存在时才看公开目录。
 * @param {string} host
 * @param {URL} [root]
 */
export function defaultRegistry(host, root = REPO_ROOT) {
  const candidate = new URL(CANDIDATE_REGISTRY[host], root)
  if (existsSync(candidate)) return { file: fileURLToPath(candidate), source: 'candidate' }
  return { file: fileURLToPath(new URL(PUBLIC_REGISTRY[host], root)), source: 'public' }
}

/** @param {string} file */
function readRegistry(file) {
  let text = ''
  try { text = readFileSync(file, 'utf8') } catch (error) { fail('read-error', `cannot read ${file}: ${messageOf(error)}`) }
  try { return JSON.parse(text) } catch (error) { fail('read-error', `cannot parse ${file}: ${messageOf(error)}`) }
}

/** 只读 CLI：本地目录 → 公开附件；不写目录、不推送。 */
async function main() {
  const args = process.argv.slice(2)
  let host = 'both'
  let keys
  let registryFile = null
  let timeoutMs = DEFAULT_TIMEOUT_MS
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') { console.log(USAGE); return }
    if (arg === '--host') {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error('missing --host value')
      host = value
    } else if (arg === '--key') {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error('missing --key value')
      keys = value.split(',').map(key => key.trim())
      if (keys.some(key => key === '')) throw new Error('missing --key value')
    } else if (arg === '--registry') {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error('missing --registry value')
      registryFile = resolve(process.cwd(), value)
    } else if (arg === '--timeout-ms') {
      const value = args[++index]
      if (!value || !/^[1-9]\d*$/.test(value)) throw new Error('invalid --timeout-ms value')
      timeoutMs = Number(value)
    } else {
      throw new Error(USAGE)
    }
  }
  if (!['github', 'gitee', 'both'].includes(host)) throw new Error('invalid host')
  const sources = []
  if (registryFile !== null) {
    const label = host === 'both' ? (/registry-gitee\.json$/i.test(registryFile) ? 'gitee' : 'github') : host
    sources.push({ host: label, source: 'explicit', file: registryFile })
  } else {
    for (const name of (host === 'both' ? ['github', 'gitee'] : [host])) {
      sources.push({ host: name, ...defaultRegistry(name) })
    }
  }
  const results = []
  for (const source of sources) {
    const registry = readRegistry(source.file)
    const checked = await checkExtensionReleases(registry, { keys, timeoutMs })
    results.push({ ...source, ...checked })
  }
  const ok = results.every(result => result.ok)
  console.log(JSON.stringify({ mode: 'read-only', ok, results }, null, 2))
  if (!ok) process.exitCode = 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(messageOf(error))
    process.exitCode = 1
  })
}
