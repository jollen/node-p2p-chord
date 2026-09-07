'use strict'

const assert = require('assert')
const { IdentifierSpace, successor, buildIdealState, findSuccessor } = require('..')

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
  let remaining = bits
  while (remaining > 0) {
    const take = Math.min(remaining, 32)
    const chunk = BigInt(Math.floor(rng() * 0x100000000))
    const mask = (1n << BigInt(take)) - 1n
    value = (value << BigInt(take)) | (chunk & mask)
    remaining -= take
  }
  return value
}

function randomUniqueIds(count, bits, seed) {
  const rng = mulberry32(seed)
  const set = new Set()
  while (set.size < count) set.add(randomBigInt(rng, bits).toString())
  return [...set].map(BigInt)
}

const bits = 160
const space = new IdentifierSpace(bits)
const nodes = randomUniqueIds(100, bits, 0xC0FFEE)
const prepared = buildIdealState(space, nodes)
const live = new Set(prepared.nodes.map(id => id.toString()))
const rng = mulberry32(0x5EED1234)

let wrong = 0
let totalHops = 0
let maxHops = 0
const trials = 100000

for (let i = 0; i < trials; i += 1) {
  const target = randomBigInt(rng, bits)
  const startId = prepared.nodes[Math.floor(rng() * prepared.nodes.length)]
  const expected = successor(space, prepared.nodes, target)
  const result = findSuccessor(space, {
    startId,
    target,
    getNode: id => prepared.state.get(id.toString()),
    isLive: id => live.has(id.toString()),
    maxHops: 512
  })
  if (result.successor !== expected) wrong += 1
  totalHops += result.hops
  maxHops = Math.max(maxHops, result.hops)
}

assert.strictEqual(wrong, 0)
console.log(JSON.stringify({ trials, wrong, averageHops: +(totalHops / trials).toFixed(3), maxHops }, null, 2))
