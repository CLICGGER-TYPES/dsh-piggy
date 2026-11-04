// @ts-check
/** 本机工作事件端点的 429 必须带 Retry-After，客户端才知道退避。 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { startWorkEventServer } from '../../../runtime/local-server.js'

test('收据容量 429 返回 Retry-After: 60', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'piggy-local-server-'))
  const server = await startWorkEventServer({
    directory,
    runtime: {
      async acceptWorkEvent() {
        throw Object.assign(new Error('work receipt capacity reached'), { status: 429 })
      },
    },
  })
  t.after(async () => { await server.close(); rmSync(directory, { recursive: true, force: true }) })
  const discovery = JSON.parse(readFileSync(join(directory, 'endpoint.json'), 'utf8'))
  const response = await fetch(`http://127.0.0.1:${discovery.port}/events`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${discovery.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ type: 'work', source: 'dsh', id: 'x', at: Date.now() }),
  })
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('retry-after'), '60')
  assert.deepEqual(await response.json(), { ok: false, reason: 'work receipt capacity reached' })
})
