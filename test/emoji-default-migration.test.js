import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emojiStyle, setEmojiStyle, EMOJI_STYLE_KEY, EMOJI_DEFAULT_MIGRATION_KEY } from '../src/client/emoji-style.js'

function withStorage(entries, run) {
  const previous = globalThis.window
  const data = new Map(entries)
  globalThis.window = { localStorage: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  } }
  try { run(data) } finally {
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  }
}

test('next release migrates an existing system emoji preference to bundled once', () => {
    withStorage([[EMOJI_STYLE_KEY, 'system'], ['unrelated', 'keep']], data => {
      assert.equal(emojiStyle(), 'bundled')
      assert.equal(data.get(EMOJI_STYLE_KEY), 'bundled')
      assert.equal(data.get(EMOJI_DEFAULT_MIGRATION_KEY), '1')
      assert.equal(data.get('unrelated'), 'keep')
      setEmojiStyle('system')
      assert.equal(emojiStyle(), 'system', 'an explicit choice after migration survives subsequent renders and restarts')
    })
})

test('a fresh device defaults to bundled and may still explicitly choose system emoji', () => {
  withStorage([], () => {
    assert.equal(emojiStyle(), 'bundled')
    setEmojiStyle('system')
    assert.equal(emojiStyle(), 'system')
    setEmojiStyle('bundled')
    assert.equal(emojiStyle(), 'bundled')
  })
})

test('already migrated devices keep their later explicit system choice', () => {
  withStorage([[EMOJI_DEFAULT_MIGRATION_KEY, '1'], [EMOJI_STYLE_KEY, 'system']], () => {
    assert.equal(emojiStyle(), 'system')
  })
})
