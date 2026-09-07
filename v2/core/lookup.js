'use strict'

const assert = require('assert')
const { betweenOpen, betweenOpenClosed } = require('./interval')

function fingerSuccessor(entry) {
  if (entry === null || typeof entry === 'undefined') return null
  if (typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'successor')) return entry.successor
  return entry
}

function closestPrecedingNode(space, node, target, isLive = () => true) {
  target = space.normalize(target)
  const nodeId = space.normalize(node.id)
  const fingers = Array.isArray(node.fingers) ? node.fingers : []

  for (let index = fingers.length - 1; index >= 0; index -= 1) {
    const raw = fingerSuccessor(fingers[index])
    if (raw === null) continue
    const candidate = space.normalize(raw)
    if (!isLive(candidate)) continue
    if (betweenOpen(space, nodeId, candidate, target)) return candidate
  }

  return nodeId
}

function findSuccessor(space, { startId, target, getNode, isLive = () => true, maxHops = 4096 }) {
  assert(typeof getNode === 'function', 'getNode is required')
  let currentId = space.normalize(startId)
  target = space.normalize(target)
  const path = [currentId]
  const visited = new Set()

  for (let hops = 0; hops <= maxHops; hops += 1) {
    const current = getNode(currentId)
    if (!current) throw new Error(`unknown Chord node ${space.toHex(currentId)}`)

    const nodeId = space.normalize(current.id)
    const successorId = space.normalize(current.successor)
    if (!isLive(successorId)) throw new Error(`successor ${space.toHex(successorId)} is not live`)

    if (betweenOpenClosed(space, nodeId, target, successorId)) {
      return { successor: successorId, path, hops: path.length - 1 }
    }

    const visitKey = nodeId.toString()
    if (visited.has(visitKey)) throw new Error(`lookup loop detected at ${space.toHex(nodeId)}`)
    visited.add(visitKey)

    let nextId = closestPrecedingNode(space, current, target, isLive)
    if (nextId === nodeId) nextId = successorId

    currentId = nextId
    path.push(currentId)
  }

  throw new Error(`lookup exceeded maxHops=${maxHops}`)
}

module.exports = { closestPrecedingNode, findSuccessor }
