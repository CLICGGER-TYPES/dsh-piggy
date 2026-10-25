import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { FISHING_ART_HASHES } from '../packages/pet-core/src/data/fishing-art.js'
import { registerArtRoute } from '../store/art-route.js'

test('钓鱼场景与透明插画实际可读取，元数据与导出一致，路径范围不扩大', () => {
  let handler
  registerArtRoute({ register(route) { handler = route.handler } }, {}, (res, code) => { res.code = code })
  const manifest = JSON.parse(readFileSync(new URL('../assets/fishing/manifest.json', import.meta.url), 'utf8'))
  assert.equal(manifest.length, 7)
  assert.deepEqual(Object.keys(FISHING_ART_HASHES).sort(), manifest.map(e => e.output).sort())
  for (const entry of manifest) {
    const res = { writeHead(code, headers) { this.code = code; this.headers = headers }, end(body) { this.body = body } }
    handler({ method: 'GET', url: '/dsh-piggy/art/fishing/' + entry.output + '?v=20261024' }, res)
    assert.equal(res.code, 200, entry.output)
    assert.equal(FISHING_ART_HASHES[entry.output], entry.export_sha256.slice(0, 12))
    assert.equal(res.headers['content-type'], 'image/png')
    assert.equal(createHash('sha256').update(res.body).digest('hex'), entry.export_sha256)
    assert.deepEqual([res.body.readUInt32BE(16), res.body.readUInt32BE(20)], entry.export_size)
    assert.equal(res.body[25], entry.name.startsWith('scene-') ? 2 : 6, entry.name)
  }
  for (const path of ['manifest.json', 'PROVENANCE.md', '../PROVENANCE.md', '%2e%2e/PROVENANCE.md', 'other.png']) {
    const res = { code: 0 }
    handler({ method: 'GET', url: '/dsh-piggy/art/fishing/' + path }, res)
    assert.equal(res.code, 404, path)
  }
})
