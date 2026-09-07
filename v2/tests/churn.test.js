'use strict'

const assert = require('assert')
const { successor, findSuccessor, ownershipDelta } = require('..')
const { Topology } = require('../testing/topology')

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomBigInt(rng, bits) {
  let value = 0n
  for (let done = 0; done < bits; done += 32) {
    const take = Math.min(32, bits - done)
    value = (value << BigInt(take)) | (BigInt(Math.floor(rng() * 0x100000000)) & ((1n << BigInt(take)) - 1n))
  }
  return value
}

function randomUniqueIds(count, bits, seed) {
  const rng = mulberry32(seed); const set = new Set()
  while (set.size < count) set.add(randomBigInt(rng, bits).toString())
  return [...set].map(BigInt)
}

const bits = 16
const topology = new Topology({ bits, successorListLength: 3 })
const base = [1000n, 17000n, 33000n, 50000n]
topology.initializeStableBase(base)

const candidates = randomUniqueIds(140, bits, 0xBADC0DE).filter(id => !base.includes(id)).slice(0, 96)
const joinRounds = []
for (const id of candidates) {
  topology.join(id, base[0])
  topology.assertInvariants()
  joinRounds.push(topology.converge())
  topology.assertInvariants()
}
assert.strictEqual(topology.liveIds().length, 100)

const rngKeys = mulberry32(0xC0FFEE)
const keys = Array.from({ length: 10000 }, () => randomBigInt(rngKeys, bits))
const beforeJoin = topology.liveIds()
const newNode = 35000n
if (!topology.get(newNode)) {
  topology.join(newNode, base[1])
  topology.converge()
}
const afterJoin = topology.liveIds()
const joinMoves = ownershipDelta(topology.space, beforeJoin, afterJoin, keys)
for (const move of joinMoves) assert.strictEqual(move.to, newNode)

const failureCandidates = topology.liveIds().filter(id => !topology.stableBase.has(id.toString()) && id !== newNode).slice(10, 20)
const failureRounds = []
for (const id of failureCandidates) {
  const before = topology.liveIds()
  topology.fail(id)
  topology.assertInvariants()
  failureRounds.push(topology.converge())
  topology.assertInvariants()
  const after = topology.liveIds()
  const failMoves = ownershipDelta(topology.space, before, after, keys)
  const next = successor(topology.space, after, id)
  for (const move of failMoves) {
    assert.strictEqual(move.from, id)
    assert.strictEqual(move.to, next)
  }
}

topology.refreshFingers()
const live = topology.liveIds()
const liveSet = new Set(live.map(String))
const rng = mulberry32(0x1234ABCD)
let wrong = 0; let totalHops = 0; let maxHops = 0
const trials = 100000
for (let i = 0; i < trials; i += 1) {
  const key = randomBigInt(rng, bits)
  const start = live[Math.floor(rng() * live.length)]
  const result = findSuccessor(topology.space, {
    startId: start,
    target: key,
    getNode: id => topology.routingNode(id),
    isLive: id => liveSet.has(id.toString()),
    maxHops: 512
  })
  const expected = successor(topology.space, live, key)
  if (result.successor !== expected) wrong += 1
  totalHops += result.hops
  maxHops = Math.max(maxHops, result.hops)
}
assert.strictEqual(wrong, 0)
console.log(JSON.stringify({
  liveNodes: live.length,
  joins: candidates.length + 1,
  joinRoundMax: Math.max(...joinRounds),
  sequentialFailures: failureCandidates.length,
  failureRoundMax: Math.max(...failureRounds),
  joinOwnershipMoves: joinMoves.length,
  lookup: { trials, wrong, averageHops: +(totalHops / trials).toFixed(3), maxHops },
  invariants: topology.invariants()
}, null, 2))
