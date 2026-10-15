// @ts-check
/** 在独立进程里验证 fetch 和 Node HTTP 都实际访问本机服务器。 */
import assert from 'node:assert/strict'
import { createServer, get } from 'node:http'
import { test } from 'node:test'

test('继承代理时回环请求仍直连', async () => {
  let requests = 0
  const server = createServer((request, response) => { requests++; response.end('local') })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const url = 'http://127.0.0.1:' + server.address().port
    assert.equal(await (await fetch(url)).text(), 'local')
    const status = await new Promise((resolve, reject) => {
      get(url, response => { response.resume(); response.on('end', () => resolve(response.statusCode)) }).on('error', reject)
    })
    assert.equal(status, 200)
    assert.equal(requests, 2)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})
