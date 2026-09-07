'use strict'

function mod(value, modulus) {
  const result = value % modulus
  return result >= 0n ? result : result + modulus
}

function size(bits) {
  return 1n << BigInt(bits)
}

function open(left, key, right, bits) {
  const m = size(bits)
  left = mod(left, m); key = mod(key, m); right = mod(right, m)
  if (left === right) return key !== left
  if (left < right) return left < key && key < right
  return key > left || key < right
}

function openClosed(left, key, right, bits) {
  const m = size(bits)
  left = mod(left, m); key = mod(key, m); right = mod(right, m)
  if (left === right) return true
  if (left < right) return left < key && key <= right
  return key > left || key <= right
}

function uniqueSorted(ids) {
  return [...new Set(ids.map(String))].map(BigInt).sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
}

function successor(ids, key) {
  const nodes = uniqueSorted(ids)
  if (nodes.length === 0) throw new Error('ring must not be empty')
  for (const id of nodes) if (id >= key) return id
  return nodes[0]
}

function fingerStart(nodeId, index, bits) {
  return mod(nodeId + (1n << BigInt(index)), size(bits))
}

module.exports = { mod, size, open, openClosed, uniqueSorted, successor, fingerStart }
