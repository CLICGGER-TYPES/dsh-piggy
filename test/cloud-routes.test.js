// @ts-check
/** 云存档 HTTP 面：错误文案分类。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { describeCloudError } from '../runtime/cloud-routes.js'

test('网络类错误对界面只回一句短话', () => {
  assert.deepEqual(describeCloudError(new Error("fatal: unable to access 'https://x/y.git/': Could not resolve host: github.com")),
    { reason: 'network', message: '无法连接到 git' })
  assert.equal(describeCloudError(new Error('SSL certificate problem')).message, '无法连接到 git')
})

test('其它错误原样返回，方便定位', () => {
  const result = describeCloudError(new Error('index.lock exists'))
  assert.equal(result.reason, 'error')
  assert.match(result.message, /index\.lock/)
})
