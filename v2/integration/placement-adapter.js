'use strict'

const { findSuccessor } = require('../core/lookup')

function assertFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} is required`)
}

class PlacementAdapter {
  constructor({ space, getNode, isLive = () => true, maxHops = 4096 }) {
    if (!space || typeof space.normalize !== 'function') throw new TypeError('space is required')
    assertFunction(getNode, 'getNode')
    assertFunction(isLive, 'isLive')
    this.space = space
    this.getNode = getNode
    this.isLive = isLive
    this.maxHops = maxHops
  }

  locate({ startId, key }) {
    if (typeof key === 'undefined' || key === null) throw new TypeError('key is required')
    const normalizedKey = this.space.normalize(key)
    const result = findSuccessor(this.space, {
      startId,
      target: normalizedKey,
      getNode: this.getNode,
      isLive: this.isLive,
      maxHops: this.maxHops
    })

    return {
      key: normalizedKey,
      ownerId: result.successor,
      path: result.path,
      hops: result.hops
    }
  }
}

function createPlacementAdapter(options) {
  return new PlacementAdapter(options)
}

module.exports = { PlacementAdapter, createPlacementAdapter }
