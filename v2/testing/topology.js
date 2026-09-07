'use strict'

const assert = require('assert')
const { IdentifierSpace } = require('../core/identifier')
const { betweenOpen, betweenOpenClosed } = require('../core/interval')
const { sortedUnique, successor } = require('../core/reference-ring')
const { stabilizationPlan, firstLiveSuccessor, shouldAcceptPredecessor } = require('../core/maintenance')

class Topology {
  constructor({ bits = 16, successorListLength = 3 } = {}) {
    this.space = new IdentifierSpace(bits)
    this.r = successorListLength
    this.nodes = new Map()
    this.stableBase = new Set()
  }

  get(id) { return this.nodes.get(this.space.normalize(id).toString()) }
  isLive(id) { const node = this.get(id); return Boolean(node && node.live) }
  liveIds() { return sortedUnique(this.space, [...this.nodes.values()].filter(n => n.live).map(n => n.id)) }

  initializeStableBase(ids) {
    const unique = sortedUnique(this.space, ids)
    assert(unique.length >= this.r + 1, `stable base requires at least r+1=${this.r + 1} nodes`)
    this.nodes.clear(); this.stableBase.clear()
    for (const id of unique) {
      this.nodes.set(id.toString(), { id, live: true, predecessor: null, successorList: [] })
      this.stableBase.add(id.toString())
    }
    for (let i = 0; i < unique.length; i += 1) {
      const node = this.get(unique[i])
      node.predecessor = unique[(i - 1 + unique.length) % unique.length]
      for (let j = 1; j <= this.r; j += 1) node.successorList.push(unique[(i + j) % unique.length])
    }
  }

  lookup(startId, key) {
    let current = this.get(startId)
    assert(current && current.live, 'start node must be live')
    const path = [current.id]
    const limit = this.liveIds().length + 8
    for (let step = 0; step < limit; step += 1) {
      const succ = firstLiveSuccessor(this.space, current, id => this.isLive(id))
      if (succ === null) throw new Error('no live successor')
      if (betweenOpenClosed(this.space, current.id, key, succ)) return { successor: succ, path, hops: path.length - 1 }
      current = this.get(succ)
      if (!current || !current.live) throw new Error('lookup selected dead node')
      path.push(current.id)
    }
    throw new Error('lookup did not terminate')
  }

  join(id, knownId) {
    id = this.space.normalize(id)
    assert(!this.nodes.has(id.toString()), 'duplicate node id')
    const known = this.get(knownId)
    assert(known && known.live, 'known node must be live')
    const succ = this.lookup(known.id, id).successor
    const succNode = this.get(succ)
    const list = [succ, ...succNode.successorList].slice(0, this.r)
    this.nodes.set(id.toString(), { id, live: true, predecessor: null, successorList: list })
  }

  fail(id) {
    id = this.space.normalize(id)
    assert(!this.stableBase.has(id.toString()), 'stable-base node cannot fail in correctness model')
    const node = this.get(id)
    assert(node && node.live, 'node must be live')
    node.live = false
  }

  stabilizeOne(id) {
    const node = this.get(id)
    if (!node || !node.live) return false
    const oldList = node.successorList.map(String).join(',')
    const plan = stabilizationPlan(this.space, node, {
      getNode: x => this.get(x),
      isLive: x => this.isLive(x),
      successorListLength: this.r
    })
    node.successorList = plan.successorList
    let changed = oldList !== node.successorList.map(String).join(',')

    const target = this.get(plan.notify.targetId)
    if (target && target.live && shouldAcceptPredecessor(this.space, target, plan.notify.candidateId, {
      getNode: x => this.get(x),
      isLive: x => this.isLive(x)
    })) {
      const before = target.predecessor
      target.predecessor = plan.notify.candidateId
      if (before !== target.predecessor) changed = true
    }
    return changed
  }

  maintenanceRound() {
    let changed = false
    for (const id of this.liveIds()) if (this.stabilizeOne(id)) changed = true
    return changed
  }

  isIdealRing() {
    const live = this.liveIds()
    if (live.length === 0) return false
    for (let i = 0; i < live.length; i += 1) {
      const node = this.get(live[i])
      if (firstLiveSuccessor(this.space, node, id => this.isLive(id)) !== live[(i + 1) % live.length]) return false
      if (node.predecessor !== live[(i - 1 + live.length) % live.length]) return false
    }
    return true
  }

  converge(maxRounds = 250) {
    for (let round = 1; round <= maxRounds; round += 1) {
      const changed = this.maintenanceRound()
      if (!changed && this.isIdealRing()) return round
    }
    throw new Error('maintenance did not converge')
  }

  invariants() {
    const live = this.liveIds()
    const liveSet = new Set(live.map(String))
    if (live.length === 0) return { atLeastOneRing: false, atMostOneRing: false, orderedRing: false, connectedAppendages: false, baseNotSkipped: false }
    const best = new Map()
    for (const id of live) {
      const succ = firstLiveSuccessor(this.space, this.get(id), x => this.isLive(x))
      if (succ !== null) best.set(id.toString(), succ)
    }
    const cycles = []; const cycleKeys = new Set()
    for (const start of live) {
      const path = []; const indexes = new Map(); let current = start
      for (let step = 0; step <= live.length + 1; step += 1) {
        const key = current.toString()
        if (indexes.has(key)) {
          const cycle = path.slice(indexes.get(key))
          const canonical = cycle.map(String).sort().join('|')
          if (!cycleKeys.has(canonical)) { cycleKeys.add(canonical); cycles.push(cycle) }
          break
        }
        indexes.set(key, path.length); path.push(current)
        const next = best.get(key)
        if (next === undefined || !liveSet.has(next.toString())) break
        current = next
      }
    }
    const atLeastOneRing = cycles.length >= 1
    const atMostOneRing = cycles.length <= 1
    let orderedRing = atLeastOneRing && atMostOneRing
    if (orderedRing) {
      const cycle = cycles[0]
      for (let i = 0; i < cycle.length; i += 1) {
        if (cycle[(i + 1) % cycle.length] !== successor(this.space, cycle, this.space.add(cycle[i], 1n))) { orderedRing = false; break }
      }
    }
    let connectedAppendages = atLeastOneRing && atMostOneRing
    if (connectedAppendages) {
      const ring = new Set(cycles[0].map(String))
      for (const start of live) {
        let current = start; const visited = new Set(); let reaches = ring.has(current.toString())
        while (!reaches && !visited.has(current.toString())) {
          visited.add(current.toString()); const next = best.get(current.toString()); if (next === undefined) break
          current = next; reaches = ring.has(current.toString())
        }
        if (!reaches) { connectedAppendages = false; break }
      }
    }
    let baseNotSkipped = true
    for (const id of live) {
      const extended = [id, ...this.get(id).successorList]
      for (let i = 0; i < extended.length - 1 && baseNotSkipped; i += 1) {
        for (const base of this.stableBase) {
          const baseId = BigInt(base)
          if (baseId === extended[i] || baseId === extended[i + 1]) continue
          if (betweenOpen(this.space, extended[i], baseId, extended[i + 1])) { baseNotSkipped = false; break }
        }
      }
      if (!baseNotSkipped) break
    }
    return { atLeastOneRing, atMostOneRing, orderedRing, connectedAppendages, baseNotSkipped }
  }

  assertInvariants() {
    const inv = this.invariants()
    for (const [name, ok] of Object.entries(inv)) assert.strictEqual(ok, true, `invariant failed: ${name}`)
  }
}

module.exports = { Topology }
