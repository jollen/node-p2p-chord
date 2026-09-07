'use strict'

const { betweenOpen } = require('./interval')

function firstLiveSuccessor(space, node, isLive) {
  const list = Array.isArray(node.successorList) ? node.successorList : []
  for (const raw of list) {
    const id = space.normalize(raw)
    if (isLive(id)) return id
  }
  return null
}

function shouldAcceptPredecessor(space, targetNode, candidateId, { getNode, isLive }) {
  candidateId = space.normalize(candidateId)
  if (targetNode.predecessor === null || typeof targetNode.predecessor === 'undefined') return true
  const predecessorId = space.normalize(targetNode.predecessor)
  const predecessor = getNode(predecessorId)
  if (!predecessor || !isLive(predecessorId)) return true
  return betweenOpen(space, predecessorId, candidateId, targetNode.id)
}

function stabilizationPlan(space, node, { getNode, isLive, successorListLength }) {
  let successorId = firstLiveSuccessor(space, node, isLive)
  if (successorId === null) throw new Error(`node ${space.toHex(node.id)} has no live successor`)

  let successorNode = getNode(successorId)
  if (!successorNode) throw new Error(`unknown successor ${space.toHex(successorId)}`)

  const candidate = successorNode.predecessor
  if (candidate !== null && typeof candidate !== 'undefined') {
    const candidateId = space.normalize(candidate)
    if (isLive(candidateId) && betweenOpen(space, node.id, candidateId, successorId)) {
      successorId = candidateId
      successorNode = getNode(successorId)
      if (!successorNode) throw new Error(`unknown stabilization candidate ${space.toHex(successorId)}`)
    }
  }

  const candidates = [successorId, ...(successorNode.successorList || [])]
  const refreshed = []
  const seen = new Set()
  for (const raw of candidates) {
    const id = space.normalize(raw)
    const key = id.toString()
    if (seen.has(key) || !isLive(id)) continue
    seen.add(key)
    refreshed.push(id)
    if (refreshed.length === successorListLength) break
  }

  if (refreshed.length < successorListLength) {
    throw new Error(`successor list underflow at ${space.toHex(node.id)}: have ${refreshed.length}, need ${successorListLength}`)
  }

  return {
    successorList: refreshed,
    notify: { targetId: refreshed[0], candidateId: space.normalize(node.id) }
  }
}

module.exports = { firstLiveSuccessor, shouldAcceptPredecessor, stabilizationPlan }
