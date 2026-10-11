import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { PIG_ART_ASSETS, NO_OUTLINE_ART_ASSETS } from '../packages/pet-core/src/data/art-assets.js'
import { ART_STYLE_KEY, refreshArtImages } from '../src/client/art-style.js'
import { ART_BOUNDS, builtinFrame, FRAME_HEIGHT, MAX_ART_ASPECT } from '../src/client/art-framing.js'
import { findByAttr, findByClass, hostOf, mount, openPanel } from './helpers/bundle.js'

test('all approved alternative PNGs have matching provenance and the same visible height', () => {
  const entries = JSON.parse(readFileSync(new URL('../assets/pigs/no-outline/manifest.json', import.meta.url)))
  assert.deepEqual(entries.map(e => e.key).sort(), Object.keys(PIG_ART_ASSETS).sort())
  let total = 0
  for (const entry of entries) {
    assert.equal(entry.status, 'user-approved')
    assert.equal(entry.path, NO_OUTLINE_ART_ASSETS[entry.key])
    const png = readFileSync(new URL('../assets/' + entry.path, import.meta.url))
    assert.equal(createHash('sha256').update(png).digest('hex'), entry.sha256)
    assert.ok(png.readUInt32BE(16) <= 256 && png.readUInt32BE(20) <= 256)
    assert.ok(png[25] === 6 || (png[25] === 3 && png.includes(Buffer.from('tRNS'))))
    const bounds = ART_BOUNDS[entry.path]
    const aspect = (bounds[2] - bounds[0]) / (bounds[3] - bounds[1])
    assert.ok(aspect <= MAX_ART_ASPECT + .0001)
    if (entry.action !== 'badge') {
      const [zoom, x, y] = builtinFrame('/dsh-piggy/art/' + entry.path)
      assert.ok(Math.abs((bounds[3] - bounds[1]) * zoom - FRAME_HEIGHT) < .0001, entry.key)
      assert.ok(Math.abs((.5 - (bounds[0] + bounds[2]) / 2) * zoom * 100 / (entry.action === 'sleep' ? 1.2 : 1) - x) < .01)
      assert.ok(Math.abs((.5 - (bounds[1] + bounds[3]) / 2) * zoom * 100 - y) < .01)
    }
    total += png.length
  }
  assert.ok(total < 2_000_000)
})

test('settings switches both ways immediately, persists the choice, and defaults to the existing style', async () => {
  const { dom, store } = await mount()
  openPanel(dom, 'settings')
  const host = hostOf(dom)
  assert.equal(findByAttr(host, 'data-art-style', 'outlined').disabled, true)
  findByAttr(host, 'data-art-style', 'no-outline').fire('click')
  assert.equal(store.get(ART_STYLE_KEY), 'no-outline')
  assert.equal(findByAttr(host, 'data-art-style', 'no-outline').disabled, true)
  assert.match(findByClass(host, 'dp-pig-img').src, /\/pigs\/no-outline\//)
  findByAttr(host, 'data-art-style', 'outlined').fire('click')
  assert.equal(store.get(ART_STYLE_KEY), 'outlined')
  assert.doesNotMatch(findByClass(host, 'dp-pig-img').src, /no-outline/)
  const reopened = await mount({ store: { [ART_STYLE_KEY]: 'no-outline' } })
  assert.match(findByClass(hostOf(reopened.dom), 'dp-pig-img').src, /no-outline/)
})

test('a panel storage event updates the pet and legacy extension URLs while leaving imported skins alone', async () => {
  const { dom, store, windowListeners } = await mount()
  const host = hostOf(dom)
  const recruit = new dom.FakeElement('img')
  recruit.src = '/dsh-piggy/art/feedback/recruit.png'
  host.appendChild(recruit)
  const imported = new dom.FakeElement('img')
  imported.src = '/dsh-piggy/art/custom-owner-sleep'
  host.appendChild(imported)
  store.set(ART_STYLE_KEY, 'no-outline')
  for (const fn of windowListeners.storage ?? []) fn({ key: ART_STYLE_KEY })
  assert.equal(recruit.src, '/dsh-piggy/art/pigs/no-outline/feedback/recruit.png')
  assert.equal(imported.src, '/dsh-piggy/art/custom-owner-sleep')
  const late = new dom.FakeElement('img')
  late.src = '/dsh-piggy/art/badge-pig-jobs-hundred.svg'
  host.appendChild(late)
  refreshArtImages(host)
  assert.equal(late.src, '/dsh-piggy/art/' + NO_OUTLINE_ART_ASSETS['badge-pig-jobs-hundred'])
  store.delete(ART_STYLE_KEY)
  for (const fn of windowListeners.storage ?? []) fn({ key: null })
  assert.equal(recruit.src, '/dsh-piggy/art/pigs/feedback/recruit.png')
})
