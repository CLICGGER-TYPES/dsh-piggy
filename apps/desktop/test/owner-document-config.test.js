// @ts-check
/** Explicit OwnerDocument desktop opt-in parser contracts; default startup reads no task file. */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { readOwnerDocumentConfig } from '../lib/owner-document-config.js'

test('desktop does not read owner config by default and accepts only an explicit isolated config path', t => {
  assert.equal(readOwnerDocumentConfig({}), null)
  const directory = mkdtempSync(join(tmpdir(), 'dsh-piggy-owner-config-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const path = join(directory, 'owner.json')
  writeFileSync(path, JSON.stringify({
    ownerDocumentPath: join(directory, 'owner-document.json'),
    legacyStatePath: join(directory, 'legacy-v15.json'),
    ownerId: 'owner-local',
    pigId: 'pig-a',
  }))
  assert.deepEqual(readOwnerDocumentConfig({ PIGGY_OWNER_DOCUMENT_CONFIG: path }), {
    ownerDocumentPath: join(directory, 'owner-document.json'),
    legacyStatePath: join(directory, 'legacy-v15.json'),
    ownerId: 'owner-local',
    pigId: 'pig-a',
  })
})

test('desktop owner config rejects relative paths and unknown fields instead of falling back', t => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-piggy-owner-config-bad-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const path = join(directory, 'owner.json')
  writeFileSync(path, JSON.stringify({ ownerDocumentPath: 'relative.json', pigId: 'pig-a' }))
  assert.throws(() => readOwnerDocumentConfig({ PIGGY_OWNER_DOCUMENT_CONFIG: path }), /invalid shape/)
  writeFileSync(path, JSON.stringify({ ownerDocumentPath: '/tmp/owner.json', pigId: 'pig-a', token: 'never-accepted' }))
  assert.throws(() => readOwnerDocumentConfig({ PIGGY_OWNER_DOCUMENT_CONFIG: path }), /invalid shape/)
})
