// @ts-check
/**
 * Type-check the JavaScript with `tsc --noEmit --checkJs` — no build step, no
 * TypeScript rewrite (see docs/CONVENTIONS.md).
 *
 * The compiler is not a dependency of this package: like the client bundler, it
 * resolves from the checkout it lives in (DSH's own pnpm store), with
 * DSH_PIG_TSC and DSH_PIG_TYPES as escape hatches.
 *
 * Usage:
 *   npm run typecheck          # check everything
 *   node scripts/typecheck.mjs --quiet
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

/** The DSH checkout this package is developed inside, if any. */
function harnessRoot() {
  const candidates = [
    process.env.DSH_ROOT,
    join(packageRoot, '..', '..', 'deepseek-harness'),
    join(packageRoot, '..', 'deepseek-harness'),
  ].filter(Boolean)
  return candidates.find(candidate => candidate !== undefined && existsSync(join(candidate, 'package.json'))) ?? null
}

/** First existing path wins. */
const firstExisting = paths => paths.find(path => path !== null && existsSync(path)) ?? null

/**
 * `tsc` — ours, the harness's, or the newest one in its pnpm store.
 *
 * Resolves the JavaScript entry point (`typescript/bin/tsc`), not the `.bin`
 * shell wrapper: the wrapper is a shell script and cannot be run with node.
 */
function findTsc() {
  if (process.env.DSH_PIG_TSC !== undefined && existsSync(process.env.DSH_PIG_TSC)) return process.env.DSH_PIG_TSC
  try {
    return require.resolve('typescript/bin/tsc')
  } catch (error) {
    // not installed here — fall through to the harness
  }
  const harness = harnessRoot()
  const store = harness === null ? null : join(harness, 'node_modules', '.pnpm')
  const fromStore = store === null || !existsSync(store)
    ? []
    : readdirSync(store)
      .filter(name => /^typescript@\d/.test(name))
      .sort()
      .reverse()
      .map(name => join(store, name, 'node_modules', 'typescript', 'bin', 'tsc'))
  return firstExisting([
    join(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
    harness === null ? null : join(harness, 'node_modules', 'typescript', 'bin', 'tsc'),
    ...fromStore,
  ])
}

/** `@types/node` — needed for `node:fs`, `process` and friends. */
function findTypesRoot() {
  if (process.env.DSH_PIG_TYPES !== undefined) return process.env.DSH_PIG_TYPES
  const harness = harnessRoot()
  const store = harness === null ? null : join(harness, 'node_modules', '.pnpm')
  const fromStore = store === null || !existsSync(store)
    ? []
    : readdirSync(store)
      .filter(name => /^@types\+node@\d/.test(name))
      .sort()
      .reverse()
      .map(name => join(store, name, 'node_modules', '@types'))
  return firstExisting([
    join(packageRoot, 'node_modules', '@types'),
    harness === null ? null : join(harness, 'node_modules', '@types'),
    ...fromStore,
  ])
}

/** Every .js / .mjs file we ship or run, minus generated output. */
function sources(dir = packageRoot, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'test') continue
    const path = join(dir, entry.name)
    // The desktop app's Electron entry (and first-run.js, its first-start download window) needs Electron's types,
    // which only apps/desktop installs; its build output and packed game copy are not sources.
    if (dir === join(packageRoot, 'apps', 'desktop') && ['main.js', 'first-run.js', 'dist', 'dist-game', 'game'].includes(entry.name)) continue
    if (entry.isDirectory()) sources(path, out)
    else if (/\.(js|mjs)$/.test(entry.name) && entry.name !== 'client.js') out.push(path)
  }
  return out
}

const tsc = findTsc()
if (tsc === null) {
  console.error('typecheck: no tsc found. Install typescript, or set DSH_PIG_TSC=/path/to/tsc.')
  process.exit(1)
}
const typesRoot = findTypesRoot()

const args = [
  '--noEmit',
  '--allowJs',
  '--checkJs',
  '--target', 'es2022',
  '--module', 'esnext',
  '--moduleResolution', 'bundler',
  '--lib', 'es2022,dom',
  '--skipLibCheck',
  // The code predates any annotations: implicit-any stays off so the check is
  // about real mistakes (wrong property, wrong argument) rather than a wall of
  // missing JSDoc. Ratchet this on once the annotations have caught up.
  '--noImplicitAny', 'false',
  ...(typesRoot === null ? [] : ['--typeRoots', typesRoot, '--types', 'node']),
  ...sources(),
]
const run = spawnSync(process.execPath, [tsc, ...args], { stdio: 'inherit', cwd: packageRoot })
process.exit(run.status ?? 1)
