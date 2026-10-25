#!/usr/bin/env node
// @ts-check
/**
 * 生成菜园的服务端单文件 extensions/farm/server.js。
 *
 * 菜园源码在 src/extensions/farm/，但在线扩展协议只有 manifest.json / server.js /
 * client.js + assets，运行时不加载额外模块。这里用已有的 esbuild 把源码打成
 * 可读的 ESM（不压缩、不引外部依赖），产物提交入库，由 freshness 测试守住。
 *
 * 用法：npm run build（生成 client.js 后再生成它）
 *       node scripts/build-farm-server.mjs（只生成菜园服务端）
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadEsbuild } from './build-client.mjs'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entryPoint = join(packageRoot, 'src/extensions/farm/server.js')
const outfile = join(packageRoot, 'extensions/farm/server.js')

/** @returns {Promise<string>} 生成的 ESM 文本 */
export async function buildFarmServer() {
  const esbuild = loadEsbuild()
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    // 保留 UTF-8：产物里的中文和 emoji 直接可读，不变成一长串转义。
    charset: 'utf8',
    // 不压缩：下载下来的 server.js 仍然可读，新鲜度测试逐字节比较，任何转换变化都能在审阅里看见。
    minify: false,
    legalComments: 'none',
    absWorkingDir: packageRoot,
    write: false,
    logLevel: 'warning',
    banner: {
      js: '// GENERATED FILE. Edit src/extensions/farm/ and run `npm run build`; do not edit by hand.\n'
        + '// The download protocol is still manifest.json + server.js + client.js + assets; this bundle has no runtime imports.',
    },
  })
  return result.outputFiles[0].text
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  try {
    const text = await buildFarmServer()
    writeFileSync(outfile, text)
    console.log(`build-farm-server: wrote ${outfile} (${text.length} bytes)`)
  } catch (error) {
    console.error(`build-farm-server failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
