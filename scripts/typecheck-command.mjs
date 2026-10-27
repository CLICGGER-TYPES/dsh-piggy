// @ts-check
/** TypeScript response files keep Windows command lines short and retain every source. */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function responseArguments(args) {
  return args.map(arg => {
    if (/["\r\n]/.test(arg)) throw new Error('unsupported quote or newline in TypeScript argument')
    return '"' + arg + '"'
  }).join('\n') + '\n'
}

export function runTypecheck(tsc, args, cwd) {
  const temporary = mkdtempSync(join(tmpdir(), 'piggy-typecheck-'))
  try {
    const file = join(temporary, 'arguments.rsp')
    writeFileSync(file, responseArguments(args))
    const run = spawnSync(process.execPath, [tsc, '@' + file], { stdio: 'inherit', cwd })
    if (run.error) console.error('typecheck: failed to start compiler:', run.error.message)
    return run.status ?? 1
  } finally { rmSync(temporary, { recursive: true, force: true }) }
}
