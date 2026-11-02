// @ts-check
/** owner document 纯 codec 契约：投影无损、资源归属不串、拒绝输入不变。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  OWNER_DOCUMENT_VERSION,
  ownerDocumentFromLegacyV15,
  parseOwnerDocument,
  projectOwnerDocumentToLegacyV15,
  serializeOwnerDocument,
  validateOwnerDocument,
} from '../store/owner-document.js'
import { splitLegacyState } from '../store/legacy-projection.js'

function legacyV15(name = '甲') {
  return {
    version: 15,
    name,
    bornAt: 1_800_000_000_000,
    hatched: true,
    stage: 'piglet',
    skin: name === '甲' ? 'default' : 'pink',
    coins: 500,
    inventory: { apple: 2 },
    customSkins: [{ key: 'custom-a', name: '柔粉' }],
    dialogue: { quiet: false },
    economy: { totals: { work: 3 }, fatigue: name === '甲' ? 0.2 : 0.8, futureEconomyField: 'keep-economy' },
    fishing: { bag: ['carp'], pending: null, spot: 'river', futureFishField: 'keep-fishing' },
    extData: { farm: { version: 5, plots: [] }, mine: { ore: 3 } },
    futureTopLevel: { nested: ['keep', 1] },
  }
}

function clone(value) {
  return structuredClone(value)
}

test('flat v15 round-trips through validated owner document JSON without losing opaque data', () => {
  const original = legacyV15()
  const document = ownerDocumentFromLegacyV15(original, { ownerId: 'owner-a', pigId: 'pig-a' })

  assert.equal(document.documentVersion, OWNER_DOCUMENT_VERSION)
  assert.deepEqual(document.legacyFormat, { version: 15 })
  assert.equal(document.resources.coins, 500)
  assert.deepEqual(document.pigs, [{
    pigId: 'pig-a',
    body: {
      name: '甲', bornAt: 1_800_000_000_000, hatched: true, stage: 'piglet', skin: 'default',
      dialogue: { quiet: false }, economy: { fatigue: 0.2 }, fishing: { pending: null, spot: 'river' },
    },
  }])
  assert.deepEqual(document.opaque.extData, { mine: { ore: 3 } })
  assert.deepEqual(document.opaque.futureTopLevel, { nested: ['keep', 1] })
  assert.equal(document.opaque.economy.futureEconomyField, 'keep-economy')
  assert.equal(document.opaque.fishing.futureFishField, 'keep-fishing')

  const serialized = serializeOwnerDocument(document)
  const parsed = parseOwnerDocument(serialized)
  assert.deepEqual(parsed, document)
  assert.deepEqual(projectOwnerDocumentToLegacyV15(parsed, 'pig-a'), original)
  assert.deepEqual(original, legacyV15(), 'projection must not mutate its input')
})

test('two pig records share owner resources while projecting independent bodies', () => {
  const ownerDocument = ownerDocumentFromLegacyV15(legacyV15(), { ownerId: 'owner-shared', pigId: 'pig-a' })
  const otherParts = splitLegacyState(legacyV15('乙'))
  ownerDocument.pigs.push({ pigId: 'pig-b', body: otherParts.body })

  const first = projectOwnerDocumentToLegacyV15(ownerDocument, 'pig-a')
  const second = projectOwnerDocumentToLegacyV15(ownerDocument, 'pig-b')
  assert.equal(first.coins, second.coins)
  assert.deepEqual(first.inventory, second.inventory)
  assert.deepEqual(first.customSkins, second.customSkins)
  assert.deepEqual(first.extData.farm, second.extData.farm)
  assert.equal(first.name, '甲')
  assert.equal(second.name, '乙')
  assert.equal(first.skin, 'default')
  assert.equal(second.skin, 'pink')
  assert.equal(first.economy.fatigue, 0.2)
  assert.equal(second.economy.fatigue, 0.8)
  assert.deepEqual(first.extData.mine, second.extData.mine, 'opaque legacy data stays once in the owner document')
})

test('invalid version, IDs, duplicate pig IDs, shape, and unsafe keys reject without mutation', () => {
  const valid = ownerDocumentFromLegacyV15(legacyV15(), { ownerId: 'owner-a', pigId: 'pig-a' })
  const rejectedUnchanged = input => {
    const before = clone(input)
    assert.throws(() => validateOwnerDocument(input), TypeError)
    assert.deepEqual(input, before)
  }

  const badVersion = clone(valid)
  badVersion.documentVersion += 1
  rejectedUnchanged(badVersion)

  const badOwnerId = clone(valid)
  badOwnerId.ownerId = ''
  rejectedUnchanged(badOwnerId)

  const badPigId = clone(valid)
  badPigId.pigs[0].pigId = '__proto__'
  rejectedUnchanged(badPigId)

  const duplicate = clone(valid)
  duplicate.pigs.push(clone(duplicate.pigs[0]))
  rejectedUnchanged(duplicate)

  const wrongShape = clone(valid)
  wrongShape.unrecognizedEnvelopeField = true
  rejectedUnchanged(wrongShape)

  const unsafe = clone(valid)
  unsafe.opaque.hostile = JSON.parse('{"constructor":{"polluted":true}}')
  rejectedUnchanged(unsafe)
  assert.equal({}.polluted, undefined)

  const unsafeLegacy = legacyV15()
  unsafeLegacy.futureTopLevel.hostile = JSON.parse('{"__proto__":{"polluted":true}}')
  const beforeLegacy = clone(unsafeLegacy)
  assert.throws(() => ownerDocumentFromLegacyV15(unsafeLegacy, { ownerId: 'owner-a', pigId: 'pig-a' }), TypeError)
  assert.deepEqual(unsafeLegacy, beforeLegacy)
  assert.equal({}.polluted, undefined)
  assert.throws(() => parseOwnerDocument('{'), /owner document JSON is invalid/)
})

test('known state fields must stay in their canonical ownership buckets', () => {
  const valid = ownerDocumentFromLegacyV15(legacyV15(), { ownerId: 'owner-a', pigId: 'pig-a' })
  const rejectedUnchanged = input => {
    const before = clone(input)
    assert.throws(() => validateOwnerDocument(input), TypeError)
    assert.deepEqual(input, before)
  }

  const pigFieldInResources = clone(valid)
  pigFieldInResources.resources.name = 'wrong bucket'
  rejectedUnchanged(pigFieldInResources)

  const ownerFieldInBody = clone(valid)
  ownerFieldInBody.pigs[0].body.coins = 500
  rejectedUnchanged(ownerFieldInBody)

  const ownerFieldInOpaque = clone(valid)
  ownerFieldInOpaque.opaque.coins = 500
  rejectedUnchanged(ownerFieldInOpaque)

  const pigMixedFieldInResources = clone(valid)
  pigMixedFieldInResources.resources.economy.fatigue = 0.2
  rejectedUnchanged(pigMixedFieldInResources)

  const ownerMixedFieldInBody = clone(valid)
  ownerMixedFieldInBody.pigs[0].body.economy.totals = { work: 3 }
  rejectedUnchanged(ownerMixedFieldInBody)

  const knownMixedFieldInOpaque = clone(valid)
  knownMixedFieldInOpaque.opaque.extData.farm = { version: 5, plots: [] }
  rejectedUnchanged(knownMixedFieldInOpaque)

  const unknownFormatField = clone(valid)
  unknownFormatField.legacyFormat.oldPigVersion = 15
  rejectedUnchanged(unknownFormatField)
})

test('legacy conversion requires normalized v15 and explicit safe IDs', () => {
  assert.throws(() => ownerDocumentFromLegacyV15({ ...legacyV15(), version: 14 }, { ownerId: 'o', pigId: 'p' }), /legacy state version is unsupported/)
  assert.throws(() => ownerDocumentFromLegacyV15(legacyV15(), { ownerId: 'o/p', pigId: 'p' }), /ownerId is invalid/)
  assert.throws(() => ownerDocumentFromLegacyV15(legacyV15(), { ownerId: 'owner-a' }), /owner and pig IDs has an invalid shape/)
  assert.throws(() => projectOwnerDocumentToLegacyV15(
    ownerDocumentFromLegacyV15(legacyV15(), { ownerId: 'owner-a', pigId: 'pig-a' }),
    'missing',
  ), /requested pigId is missing or ambiguous/)
})
