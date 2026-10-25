import test from 'node:test'
import assert from 'node:assert/strict'
import { registerArtRoute } from '../store/art-route.js'

test('the packaged independent hand atlas is served as WebP, without widening the asset allowlist', () => {
  let handler
  registerArtRoute({ register(route) { handler = route.handler } }, {}, (res, code) => { res.code = code })
  const res = { writeHead(code, headers) { this.code = code; this.headers = headers }, end(body) { this.body = body } }
  handler({ method: 'GET', url: '/dsh-piggy/art/animations/pet-hand/hand.webp?v=hd-spring-9' }, res)
  assert.equal(res.code, 200)
  assert.equal(res.headers['content-type'], 'image/webp')
  assert.equal(res.body.subarray(0, 4).toString(), 'RIFF')
  for (const path of ['animations/pet-hand/../manifest.json', 'animations/pet-hand/other.webp', 'animations/pet-hand/PROVENANCE.md']) {
    handler({ method: 'GET', url: '/dsh-piggy/art/' + path }, res)
    assert.equal(res.code, 404)
  }
})
