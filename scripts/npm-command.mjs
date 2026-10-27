// @ts-check
/** Run npm's fixed read-only pack command without asking Windows to execute npm.cmd. */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { win32 } from 'node:path'

const PACK_ARGS = ['pack', '--json', '--dry-run', '--ignore-scripts']

/** @param {{platform?:string,execPath?:string,env?:NodeJS.ProcessEnv,exists?:(path:string)=>boolean}} [options] */
export function npmPackCommand({ platform = process.platform, execPath = process.execPath,
  env = process.env, exists = existsSync } = {}) {
  if (platform !== 'win32') return { file: 'npm', args: [...PACK_ARGS] }
  const candidates = [env.npm_execpath, win32.join(win32.dirname(execPath), 'node_modules/npm/bin/npm-cli.js')]
  for (const directory of (env.PATH ?? env.Path ?? '').split(';').filter(Boolean)) {
    candidates.push(win32.join(directory.replace(/^"|"$/g, ''), 'node_modules/npm/bin/npm-cli.js'))
  }
  const cli = candidates.find(path => path && win32.basename(path) === 'npm-cli.js' && exists(path))
  if (!cli) throw new Error('npm-cli.js not found; run the check from npm test or install npm alongside Node')
  return { file: execPath, args: [cli, ...PACK_ARGS] }
}

export function runNpmPack(directory) {
  const command = npmPackCommand()
  return execFileSync(command.file, command.args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}
