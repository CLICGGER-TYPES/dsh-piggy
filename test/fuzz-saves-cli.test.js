// @ts-check
/**
 * fuzz-saves 的命令行守卫（回归守卫）。
 *
 * 这个脚本一上来就会清空 outDir/crashes——以前 `argument()` 对未知参数是「忽略、回落默认值」，
 * 所以 `node tools/fuzz-saves.mjs --help`（或任何拼错的参数）会按默认 1500 例真跑起来，
 * 并把已归档的崩溃证据删掉。现在 --help 只打印说明，未知参数 / 缺值在碰目录之前就报错。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCRIPT = join(ROOT, 'tools', 'fuzz-saves.mjs')
const tempDirs = []
after(() => { for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true }) })

/** 跑一次脚本；`--out` 指向临时目录，绝不碰真的归档目录。 */
function run(args, outDir) {
  const argv = [...args, '--out', outDir]
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...argv], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { status: 0, stdout, stderr: '' }
  } catch (error) {
    return { status: error.status ?? -1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' }
  }
}

/** 造一个带「已归档崩溃」的临时产物目录，返回目录与哨兵文件路径。 */
function archivedOutDir() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-fuzz-cli-'))
  tempDirs.push(dir)
  mkdirSync(join(dir, 'crashes'), { recursive: true })
  const sentinel = join(dir, 'crashes', '01-archived.json')
  writeFileSync(sentinel, '{"keep":true}')
  writeFileSync(join(dir, 'run-summary.json'), '{"cases":5000}')
  return { dir, sentinel }
}

assert.deepEqual(readdirSync(join(ROOT, 'tools')).includes('fuzz-saves.mjs'), true, '缺少被测脚本')

test('--help 只打印用法并 exit 0，不跑用例、不动产物目录', () => {
  const { dir, sentinel } = archivedOutDir()
  const help = run(['--help'], dir)
  assert.equal(help.status, 0)
  for (const flag of ['--cases', '--seed', '--jobs', '--timeout', '--out', '--minimize']) {
    assert.match(help.stdout, new RegExp(flag.replace(/-/g, '\\-')), `用法里应有 ${flag}`)
  }
  assert.equal(existsSync(sentinel), true, '已归档的 crashes 不能被删')
  const short = run(['-h'], dir)
  assert.equal(short.status, 0, '-h 与 --help 等价')
})

test('未知参数在触碰 outDir 之前报错退出', () => {
  const { dir, sentinel } = archivedOutDir()
  const result = run(['--casess', '200'], dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /未知参数/)
  assert.equal(existsSync(sentinel), true, '拼错参数不能清空 crashes')
  assert.deepEqual(readdirSync(join(dir, 'crashes')), ['01-archived.json'])
})

test('缺少值 / 非数字在触碰 outDir 之前报错退出', () => {
  for (const args of [['--cases'], ['--seed', 'not-a-number'], ['--jobs', 'x'], ['--timeout', '--minimize', '3']]) {
    const { dir, sentinel } = archivedOutDir()
    const result = run(args, dir)
    assert.notEqual(result.status, 0, `${args.join(' ')} 应报错`)
    assert.match(result.stderr, /缺少值|必须是数字|未知参数/)
    assert.equal(existsSync(sentinel), true, `args=${args.join(' ')} 时不能动 crashes`)
  }
})
