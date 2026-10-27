#!/usr/bin/env node
// @ts-check
/**
 * 一次生成两个提交入库的产物：面板 client.js，以及菜园扩展的服务端单文件。
 *
 * 菜园 server.js 必须单文件下载，源码却在 src/extensions/farm/；这里复用两个
 * 构建函数，避免 npm run build 只更新其中一个产物。
 *
 * 用法：npm run build
 */
import { copyFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildClient } from './build-client.mjs'
import { buildFarmServer } from './build-farm-server.mjs'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Shell migration and game runtime must use the identical save-owner lock protocol.
copyFileSync(join(packageRoot, 'runtime/owner-lock.js'), join(packageRoot, 'apps/desktop/lib/save-owner-lock.js'))
const outputs = [
  ['client.js', await buildClient()],
  ['extensions/farm/server.js', await buildFarmServer()],
]
for (const [name, text] of outputs) {
  const path = join(packageRoot, name)
  writeFileSync(path, text)
  console.log(`build: wrote ${path} (${text.length} bytes)`)
}
