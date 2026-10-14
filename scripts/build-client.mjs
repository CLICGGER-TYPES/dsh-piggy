#!/usr/bin/env node
// @ts-check
/**
 * 打包客户端插件。
 *
 * DSH 的客户端插件是按 classic <script src> 加载的**单文件**（见
 * packages/client/modules/src/client/system.ts 的 loadBundle），源码拆分之后
 * 必须有这一步；产物 client.js 提交入库，由 test/bundle.test.js 守住新鲜度。
 *
 * 用法：node scripts/build-client.mjs
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entryPoint = join(packageRoot, 'adapters/dsh/client.js')
const outfile = join(packageRoot, 'client.js')
const require = createRequire(import.meta.url)

/**
 * Find esbuild, in order: an installed dependency, an explicit override, then a
 * checkout that happens to have it in the pnpm store.
 *
 * The override exists because this environment has no registry access; the
 * documented, portable way is `pnpm add -D esbuild`.
 * @returns {any} the esbuild module
 */
function loadEsbuild() {
  try {
    return require('esbuild')
  } catch {
    // Not installed locally: fall through to the explicit locations below.
  }

  const explicit = process.env.DSH_PIG_ESBUILD
  if (explicit !== undefined && explicit.trim() !== '') {
    return require(explicit.trim())
  }

  // A sibling checkout (…/DSH/deepseek-harness next to …/DSH/workspaces/<pkg>)
  // keeps this working in the author's environment without an install step.
  const candidates = []
  const stores = [
    join(packageRoot, 'node_modules/.pnpm'),
    resolve(packageRoot, '../../deepseek-harness/node_modules/.pnpm'),
  ]
  for (const store of stores) {
    if (!existsSync(store)) continue
    for (const entry of readdirSync(store)) {
      if (!entry.startsWith('esbuild@')) continue
      const candidate = join(store, entry, 'node_modules/esbuild')
      if (existsSync(candidate)) candidates.push(candidate)
    }
  }
  if (candidates.length === 0) {
    throw new Error(
      'build-client: esbuild not found. Install it with `pnpm add -D esbuild`, '
      + 'or point DSH_PIG_ESBUILD at an esbuild entry.',
    )
  }
  return require(candidates[candidates.length - 1])
}

/** @returns {Promise<string>} the bundle text */
export async function buildClient() {
  const esbuild = loadEsbuild()
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    // No minify: the shipped file stays readable, and the freshness test compares
    // bytes, so any transform change is visible in review.
    minify: false,
    legalComments: 'none',
    absWorkingDir: packageRoot,
    write: false,
    logLevel: 'warning',
    banner: {
      js: '// GENERATED FILE. Edit src/client/ and run `npm run build`; do not edit by hand.',
    },
  })
  return result.outputFiles[0].text
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  try {
    const text = await buildClient()
    writeFileSync(outfile, text)
    console.log(`build-client: wrote ${outfile} (${text.length} bytes)`)
  } catch (error) {
    console.error(`build-client failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
