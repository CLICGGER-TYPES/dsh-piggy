// @ts-check
/** Windows launch commands and TypeScript argument transport, without a shell or GUI. */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { npmPackCommand } from '../scripts/npm-command.mjs'
import { responseArguments } from '../scripts/typecheck-command.mjs'

const require = createRequire(import.meta.url)
const PACK = ['pack', '--json', '--dry-run', '--ignore-scripts']

test('Windows npm pack starts npm-cli.js with Node, preserving paths with spaces', () => {
  const execPath = 'C:\\Program Files\\nodejs\\node.exe'
  const cli = 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js'
  const command = npmPackCommand({ platform: 'win32', execPath, env: {}, exists: path => path === cli })
  assert.deepEqual(command, { file: execPath, args: [cli, ...PACK] })
})

test('Windows npm run context and PATH installations are both supported', () => {
  const execPath = 'C:\\node\\node.exe', cli = 'D:\\npm tools\\node_modules\\npm\\bin\\npm-cli.js'
  for (const env of [{ npm_execpath: cli }, { PATH: 'D:\\npm tools;C:\\other' }]) {
    assert.equal(npmPackCommand({ platform: 'win32', execPath, env, exists: path => path === cli }).args[0], cli)
  }
  assert.throws(() => npmPackCommand({ platform: 'win32', execPath, env: {}, exists: () => false }), /npm-cli.js not found/)
  assert.deepEqual(npmPackCommand({ platform: 'linux' }), { file: 'npm', args: PACK })
})

test('TypeScript really parses response arguments with spaces, Unicode, Windows separators and many files', () => {
  const ts = require('typescript'), temporary = mkdtempSync(join(tmpdir(), 'piggy-rsp-'))
  try {
    const files = ['C:\\a b\\猪\\main.js', '/tmp/a b/中文.js', ...Array.from({ length: 1500 }, (_, index) => '/long-path/' + index + '.js')]
    const file = join(temporary, 'arguments.rsp')
    writeFileSync(file, responseArguments(['--noEmit', '--allowJs', ...files]))
    const parsed = ts.parseCommandLine(['@' + file], path => readFileSync(path, 'utf8'))
    assert.deepEqual(parsed.errors, [])
    assert.equal(parsed.options.noEmit, true)
    assert.deepEqual(parsed.fileNames, files)
    assert.throws(() => responseArguments(['bad"argument']), /unsupported quote/)
  } finally { rmSync(temporary, { recursive: true, force: true }) }
})
