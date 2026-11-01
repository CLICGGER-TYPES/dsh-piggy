#!/usr/bin/env node
// @ts-check
/**
 * 生成菜园扩展唯一分发文件 extensions/farm/client.js。
 *
 * 作者源码按状态、宿主适配、菜地和商店职责拆分；在线扩展仍只下载一个 classic
 * script，因此这里复用面板 bundle 的 esbuild 解析器和单文件输出约定。
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadEsbuild } from './build-client.mjs'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entryPoint = join(packageRoot, 'src/extensions/farm/client/entry.js')
const outfile = join(packageRoot, 'extensions/farm/client.js')

/** @returns {Promise<string>} 可读的单文件 classic script */
export async function buildFarmClient() {
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
      js: '// GENERATED FILE. Edit src/extensions/farm/client/ and run `npm run build`; do not edit by hand.',
    },
  })
  return result.outputFiles[0].text
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  try {
    const text = await buildFarmClient()
    writeFileSync(outfile, text)
    console.log(`build-farm-client: wrote ${outfile} (${text.length} bytes)`)
  } catch (error) {
    console.error(`build-farm-client failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
