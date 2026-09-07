'use strict'

function betweenOpen(space, left, key, right) {
  left = space.normalize(left)
  key = space.normalize(key)
  right = space.normalize(right)

  if (left === right) return key !== left
  if (left < right) return left < key && key < right
  return key > left || key < right
}

function betweenOpenClosed(space, left, key, right) {
  left = space.normalize(left)
  key = space.normalize(key)
  right = space.normalize(right)

  if (left === right) return true
  if (left < right) return left < key && key <= right
  return key > left || key <= right
}

module.exports = { betweenOpen, betweenOpenClosed }
