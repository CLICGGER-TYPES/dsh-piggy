// @ts-check
/**
 * 产物新鲜度守卫。
 *
 * DSH 加载的是打包产物 client.js，源码在 src/client/。client.js 不再提交，由
 * `npm run build` 生成；CI 和发布流程都先构建再跑测试。这里比较磁盘上的产物和
 * 从 src/client 重新构建的结果，挡住"源码改了没重打包，浏览器静默跑旧代码"。
 *
 * 仅规范化依赖软链路径可能改变的 node_modules 源路径注释；其余 bundle 内容仍逐字节比较。
 */
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { buildClient } from '../scripts/build-client.mjs'

const artifactUrl = new URL('../client.js', import.meta.url)

test('the generated client bundle is up to date with src/client', async () => {
  await access(artifactUrl).catch(() => {
    throw new Error('client.js is missing — run `npm run build` first')
  })
  const generated = await readFile(artifactUrl, 'utf8')
  const rebuilt = await buildClient()
  const canonicalizeNodeModulesCommentPaths = (text) => text.replace(
    /^([ \t]*\/\/ )(?:[^ \r\n]*\/)?node_modules\//gm,
    '$1node_modules/',
  )
  assert.equal(
    canonicalizeNodeModulesCommentPaths(generated),
    canonicalizeNodeModulesCommentPaths(rebuilt),
    'client.js is stale — run `npm run build`',
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
