// @ts-check
/**
 * 云存档 git 传输层的进程与常量子模块：固定文件名、meta 结构版本、超时边界、
 * git 子进程执行器、远端只读探测，以及错误文本的安全化。
 *
 * 这里不读写存档、不建仓库、不提交/推送；传输编排在 git-sync.js，
 * 提交节奏在 git-sync-commit.js，历史/分支读取在 git-sync-history.js。
 *
 * @module dsh-piggy/runtime/git-sync-process
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** 数据仓库里两个固定文件名。 */
export const SAVE_FILE = 'save.zip'
export const META_FILE = 'meta.json'

/** meta.json 的当前结构版本；改字段时加。 */
export const META_SCHEMA = 1

/** 运行中两次提交之间至少隔这么久（默认 10 分钟，见设计稿 §5）。 */
export const DEFAULT_DEBOUNCE_MS = 10 * 60 * 1000

/** Network Git must not keep shutdown or the plugin process alive indefinitely. */
export const DEFAULT_GIT_TIMEOUT_MS = 30_000
export const MAX_GIT_TIMEOUT_MS = 120_000
export const MAX_QUEUED_GIT_OPERATIONS = 8

export function boundedTimeout(value) {
  return Number.isFinite(value) && value > 0 ? Math.min(value, MAX_GIT_TIMEOUT_MS) : DEFAULT_GIT_TIMEOUT_MS
}

export function safeGitDetail(error) {
  const raw = `${error?.stderr ?? ''}\n${error?.stdout ?? ''}\n${error?.message ?? ''}`
  const safe = raw
    .replace(/(?:https?|ssh|git):\/\/[^\s'"<>]+/giu, '[remote]')
    .replace(/\b[^\s/@:]+@[^\s/:]+:[^\s]+/gu, '[remote]')
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
  return safe.find(line => /^(?:fatal|error|remote):/iu.test(line)) ?? safe.at(-1) ?? 'unknown Git error'
}

function gitFailure(error, command, timeoutMs) {
  const timedOut = error?.killed === true || error?.signal === 'SIGKILL' || error?.code === 'ETIMEDOUT'
  if (error?.code === 'ENOENT') return Object.assign(new Error('git is not installed or not available on PATH'), { code: 'GIT_MISSING' })
  return Object.assign(new Error(timedOut
    ? `git ${command} timed out after ${timeoutMs} ms`
    : `git ${command} failed: ${safeGitDetail(error)}`), { code: timedOut ? 'GIT_TIMEOUT' : 'GIT_FAILED' })
}

/**
 * Read-only remote probe used by the settings screen. It never calls ensure(),
 * initializes a repository, changes an origin, or reads/writes a save archive.
 * @param {{remote:string,cwd:string,git?:(args:string[],options:{cwd:string,sslVerify?:boolean,timeoutMs?:number})=>Promise<{stdout:string,stderr:string}>,timeoutMs?:number}} input
 */
export async function testGitRemote({ remote, cwd, git = defaultGit, timeoutMs = 15_000 }) {
  try {
    await git(['ls-remote', '--symref', remote, 'HEAD'], { cwd, timeoutMs: boundedTimeout(timeoutMs) })
    return { ok: true }
  } catch (error) {
    const code = /** @type {any} */ (error)?.code
    const reason = code === 'GIT_TIMEOUT' ? '连接超时' : code === 'GIT_MISSING' ? '当前环境没有可用的 Git' : '无法连接，请检查地址和本机 Git 凭据配置'
    return { ok: false, reason }
  }
}

/**
 * 默认的 git 执行器：不读交互式输入，避免在无人值守时卡住。
 * @param {string[]} args
 * @param {{ cwd: string, sslVerify?: boolean, timeoutMs?: number }} options
 */
export async function defaultGit(args, { cwd, sslVerify = true, timeoutMs: requestedTimeoutMs = DEFAULT_GIT_TIMEOUT_MS }) {
  const timeoutMs = boundedTimeout(requestedTimeoutMs)
  const full = sslVerify ? ['-c', 'user.name=dsh-piggy', '-c', 'user.email=dsh-piggy@localhost', ...args]
    : ['-c', 'user.name=dsh-piggy', '-c', 'user.email=dsh-piggy@localhost', '-c', 'http.sslVerify=false', ...args]
  try {
    const result = await run('git', full, { cwd, windowsHide: true, timeout: timeoutMs, killSignal: 'SIGKILL',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } })
    return { stdout: result.stdout, stderr: result.stderr }
  } catch (error) { throw gitFailure(error, args[0] ?? 'command', timeoutMs) }
}

/**
 * 取二进制（`git show <ref>:save.zip`）用的执行器；文本执行器会按 utf8 解码，不能拿来读 zip。
 * @param {string[]} args
 * @param {{ cwd: string, sslVerify?: boolean, timeoutMs?: number }} options
 * @returns {Promise<Buffer>}
 */
export async function defaultGitBinary(args, { cwd, sslVerify = true, timeoutMs: requestedTimeoutMs = DEFAULT_GIT_TIMEOUT_MS }) {
  const timeoutMs = boundedTimeout(requestedTimeoutMs)
  const full = sslVerify ? ['-c', 'user.name=dsh-piggy', '-c', 'user.email=dsh-piggy@localhost', ...args]
    : ['-c', 'user.name=dsh-piggy', '-c', 'user.email=dsh-piggy@localhost', '-c', 'http.sslVerify=false', ...args]
  try {
    const result = await run('git', full, {
      cwd, windowsHide: true, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024,
      timeout: timeoutMs, killSignal: 'SIGKILL',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
    })
    return /** @type {Buffer} */ (result.stdout)
  } catch (error) { throw gitFailure(error, args[0] ?? 'command', timeoutMs) }
}
