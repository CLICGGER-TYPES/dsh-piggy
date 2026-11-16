#!/usr/bin/env node
// @ts-check
/**
 * 生成左轮轮盘唯一分发文件 extensions/roulette/client.js。
 *
 * 面板玩法拆在 src/extensions/roulette/client/ 的多个小模块里，下载协议仍只收
 * 一个 classic script，所以沿用菜园客户端的 esbuild 单文件输出约定。
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadEsbuild } from './build-client.mjs'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entryPoint = join(packageRoot, 'src/extensions/roulette/client/entry.js')
const outfile = join(packageRoot, 'extensions/roulette/client.js')

/** @returns {Promise<string>} 可读的单文件 classic script */
export async function buildRouletteClient() {
  const esbuild = loadEsbuild()
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    minify: false,
    legalComments: 'none',
    absWorkingDir: packageRoot,
    write: false,
    logLevel: 'warning',
    banner: {
      js: '// GENERATED FILE. Edit src/extensions/roulette/client/ and run `node scripts/build-roulette-client.mjs`; do not edit by hand.',
    },
  })
  return result.outputFiles[0].text
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  try {
    const text = await buildRouletteClient()
    writeFileSync(outfile, text)
    console.log(`build-roulette-client: wrote ${outfile} (${text.length} bytes)`)
  } catch (error) {
    console.error(`build-roulette-client failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
