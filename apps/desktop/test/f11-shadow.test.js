import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

test('F11 desktop shadows stay inside the clickable shape: game pack ships the rules, the shell keeps them for old packs', () => {
  const page = readFileSync(new URL('../../../src/client/desktop/css.js', import.meta.url), 'utf8')
  assert.match(page, /\[data-dsh-pig\]\[data-open="false"\] \.dp-pig\{filter:none!important\}/)
  assert.match(page, /\[data-dsh-pig\] \.dp-pig-img,\[data-dsh-pig\] \.dp-pig-emoji\{filter:none!important\}/)
  assert.match(page, /\[data-dsh-pig\] \.dp-card\{box-shadow:inset/)
  const html = readFileSync(new URL('../renderer/index.html', import.meta.url), 'utf8')
  assert.match(html, /html:not\(\[data-piggy-desktop\]\) \[data-dsh-pig\]\[data-open="false"\] \.dp-pig\{filter:none!important\}/)
  assert.match(html, /<script src="loader\.js"><\/script>/)
})
