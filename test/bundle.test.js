// @ts-check
/**
 * 产物新鲜度守卫。
 *
 * DSH 加载的是打包产物 client.js，源码在 src/client/。如果改了源码没重打包，
 * 浏览器会静默跑旧代码 —— 这类"看起来生效了其实没有"的坑只能靠逐字节比对挡住。
 *
 * 修法：`npm run build` 后提交 client.js。仅规范化依赖软链路径可能改变的
 * node_modules 源路径注释；其余 bundle 内容仍逐字节比较。
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { buildClient } from '../scripts/build-client.mjs'

test('the committed client bundle is up to date with src/client', async () => {
  const committed = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  const rebuilt = await buildClient()
  const canonicalizeNodeModulesCommentPaths = (text) => text.replace(
    /^([ \t]*\/\/ )(?:[^ \r\n]*\/)?node_modules\//gm,
    '$1node_modules/',
  )
  assert.equal(
    canonicalizeNodeModulesCommentPaths(committed),
    canonicalizeNodeModulesCommentPaths(rebuilt),
    'client.js is stale — run `npm run build` and commit the result',
  )
})

test('the bundle keeps the single-file contract DSH depends on', async () => {
  const bundle = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  // DSH loads one classic script per package and requires it to self-register
  // under the package id; a bundle that lost either half mounts nothing.
  assert.match(bundle, /__ModuleLoader__\.load\(/)
  assert.match(bundle, /id:\s*"dsh-piggy"/)
  assert.ok(!/^\s*import\s/m.test(bundle), 'a classic script cannot contain import statements')
})
