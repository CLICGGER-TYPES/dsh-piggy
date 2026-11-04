#!/usr/bin/env node
// @ts-check
/**
 * 校验动作/音效素材包。失败时用非零退出码，并指到文件与字段。
 *
 * 用法：
 *   npm run check:assets
 *   npm run check:assets -- --pack base
 */
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkAssets } from './asset-packs.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const onlyIndex = args.indexOf('--pack')
const only = onlyIndex === -1 ? undefined : args[onlyIndex + 1]
const generatedPath = join(root, 'src/client/packs.generated.js')
const problems = checkAssets(root, { only, generatedPath })
if (problems.length > 0) {
  console.error('素材包校验失败：')
  for (const problem of problems) console.error('  ' + problem)
  process.exit(1)
}
console.log('素材包校验通过' + (only === undefined ? '' : `（${only}）`))
