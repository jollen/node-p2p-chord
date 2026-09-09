'use strict'

const assert = require('assert')
const { IdentifierSpace, buildIdealState, successor, createPlacementAdapter } = require('..')

function testPlacementUsesChordOwnershipOnly() {
  const space = new IdentifierSpace(8)
  const prepared = buildIdealState(space, [0x10n, 0x40n, 0x90n, 0xD0n])
  const live = new Set(prepared.nodes.map(id => id.toString()))
  const adapter = createPlacementAdapter({
    space,
    getNode: id => prepared.state.get(id.toString()),
    isLive: id => live.has(id.toString())
  })

  const keys = [0x00n, 0x10n, 0x11n, 0x8Fn, 0x90n, 0xD1n, 0xFFn]
  for (const key of keys) {
    const result = adapter.locate({ startId: 0x40n, key })
    assert.strictEqual(result.ownerId, successor(space, prepared.nodes, key))
    assert.strictEqual(result.key, space.normalize(key))
    assert(Array.isArray(result.path))
    assert(Number.isInteger(result.hops))
  }
}

function testAdapterDoesNotDeriveLedgerKeys() {
  const space = new IdentifierSpace(8)
  const prepared = buildIdealState(space, [0x20n, 0x80n])
  const adapter = createPlacementAdapter({
    space,
    getNode: id => prepared.state.get(id.toString())
  })

  assert.throws(
    () => adapter.locate({ startId: 0x20n, key: undefined }),
    /key is required/
  )

  // The adapter accepts an already-derived identifier. It intentionally has
  // no save(data), read(key), hashing, transaction, or virtual-block API.
  assert.strictEqual(typeof adapter.save, 'undefined')
  assert.strictEqual(typeof adapter.read, 'undefined')
  assert.strictEqual(typeof adapter.hash, 'undefined')
}

testPlacementUsesChordOwnershipOnly()
testAdapterDoesNotDeriveLedgerKeys()

console.log(JSON.stringify({
  placementOwnership: 'PASS',
  ledgerKeyBoundary: 'PASS'
}, null, 2))
