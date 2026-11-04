import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('the discovery alias is an installable DSH bundle for the released pig', () => {
  const root = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))
  const alias = JSON.parse(readFileSync(new URL('../../../packages/dsh-plugin-piggy/package.json', import.meta.url), 'utf8'))
  const patch = readFileSync(new URL('../../../packages/dsh-plugin-piggy/cordis.patch.yml', import.meta.url), 'utf8')

  assert.equal(alias.name, 'dsh-plugin-piggy')
  assert.equal(alias.version, root.version)
  assert.equal(alias.dependencies?.['dsh-piggy'], root.version)
  assert.equal(alias.dsh?.bundle?.patch, './cordis.patch.yml')
  assert.match(patch, /id:\s*dsh-piggy\s+name:\s*dsh-piggy/)
})
