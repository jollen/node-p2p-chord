'use strict'

function legacyHalfRange(key, node, successor) {
  if (node < successor) return key > node && key <= successor
  return key > successor && key <= node
}

function legacyOpenRange(key, left, right) {
  if (left < right) return key > left && key < right
  return key > right && key < left
}

module.exports = { legacyHalfRange, legacyOpenRange }
