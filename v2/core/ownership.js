'use strict'

const { successor, sortedUnique } = require('./reference-ring')

function ownershipDelta(space, beforeIds, afterIds, keys) {
  const before = sortedUnique(space, beforeIds)
  const after = sortedUnique(space, afterIds)
  if (before.length === 0 || after.length === 0) throw new Error('ownership delta requires non-empty before/after rings')
  const moved = []
  for (const rawKey of keys) {
    const key = space.normalize(rawKey)
    const from = successor(space, before, key)
    const to = successor(space, after, key)
    if (from !== to) moved.push({ key, from, to })
  }
  return moved
}

module.exports = { ownershipDelta }
