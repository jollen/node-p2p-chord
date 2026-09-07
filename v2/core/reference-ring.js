'use strict'

const assert = require('assert')
const { fingerStart } = require('./finger-table')

function sortedUnique(space, ids) {
  const byText = new Map()
  for (const raw of ids) {
    const id = space.normalize(raw)
    byText.set(id.toString(), id)
  }
  return [...byText.values()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

function successor(space, ids, key) {
  const nodes = sortedUnique(space, ids)
  assert(nodes.length > 0, 'ring must not be empty')
  key = space.normalize(key)
  for (const node of nodes) if (node >= key) return node
  return nodes[0]
}

function predecessor(space, ids, key) {
  const nodes = sortedUnique(space, ids)
  assert(nodes.length > 0, 'ring must not be empty')
  key = space.normalize(key)
  let previous = nodes[nodes.length - 1]
  for (const node of nodes) {
    if (node >= key) return previous
    previous = node
  }
  return nodes[nodes.length - 1]
}

function idealFingerTable(space, ids, nodeId) {
  const table = []
  for (let index = 0; index < space.bits; index += 1) {
    const start = fingerStart(space, nodeId, index)
    table.push({ index, start, successor: successor(space, ids, start) })
  }
  return table
}

function buildIdealState(space, ids) {
  const nodes = sortedUnique(space, ids)
  const state = new Map()
  for (const id of nodes) {
    state.set(id.toString(), {
      id,
      successor: successor(space, nodes, space.add(id, 1n)),
      fingers: idealFingerTable(space, nodes, id)
    })
  }
  return { nodes, state }
}

module.exports = { sortedUnique, successor, predecessor, idealFingerTable, buildIdealState }
