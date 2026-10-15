// @ts-check
/** 外部代理不可达时，本地 HTTP 回归仍必须真正命中本机服务。 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

test('测试入口为回环地址绕过继承的环境代理', () => {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/test.mjs', import.meta.url)),
    fileURLToPath(new URL('./fixtures/local-network.mjs', import.meta.url))], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NO_PROXY: '', no_proxy: '',
      HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1',
      http_proxy: 'http://127.0.0.1:1', https_proxy: 'http://127.0.0.1:1' },
  })
  assert.equal(run.status, 0, run.stdout + run.stderr)
})
