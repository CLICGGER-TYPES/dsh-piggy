import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setArtSwapHook, syncPigArt } from '../src/client/art.js'

test('a queued feel transition cannot overwrite a newer immediate reaction', () => {
  const attrs = { 'data-art': 'piglet', 'data-mood': 'fine' }
  const pig = { getAttribute: k => attrs[k] ?? null, setAttribute(k, v) { attrs[k] = v } }
  const image = { src: '', getAttribute() { return this.src }, style: { setProperty() {} } }
  syncPigArt(pig, image, null)
  let queued
  try {
    setArtSwapHook(apply => { queued = apply })
    attrs['data-art'] = 'skin-mint'
    syncPigArt(pig, image, null)
    setArtSwapHook(apply => apply())
    attrs['data-art'] = 'piglet'; attrs['data-react'] = 'pet'
    syncPigArt(pig, image, null)
    const newest = image.src
    queued()
    assert.equal(image.src, newest)
  } finally { setArtSwapHook(null) }
})

test('returning to the currently displayed sprite invalidates a pending old selection', () => {
  const attrs = { 'data-art': 'piglet', 'data-mood': 'fine' }
  const pig = { getAttribute: k => attrs[k] ?? null, setAttribute(k, v) { attrs[k] = v } }
  const image = { src: '', getAttribute() { return this.src }, style: { setProperty() {} } }
  syncPigArt(pig, image, null)
  const idle = image.src
  let queued
  try {
    setArtSwapHook(apply => { queued = apply })
    attrs['data-art'] = 'skin-mint'; syncPigArt(pig, image, null)
    attrs['data-art'] = 'piglet'; syncPigArt(pig, image, null)
    queued()
    assert.equal(image.src, idle)
  } finally { setArtSwapHook(null) }
})
