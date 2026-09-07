'use strict'

function fingerStart(space, nodeId, index) {
  if (!Number.isInteger(index) || index < 0 || index >= space.bits) {
    throw new RangeError('finger index must be within the identifier width')
  }
  return space.add(nodeId, 1n << BigInt(index))
}

function buildFingerStarts(space, nodeId) {
  const starts = new Array(space.bits)
  for (let index = 0; index < space.bits; index += 1) starts[index] = fingerStart(space, nodeId, index)
  return starts
}

module.exports = { fingerStart, buildFingerStarts }
