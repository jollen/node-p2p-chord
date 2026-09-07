'use strict'

const assert = require('assert')
const { Topology } = require('../testing/topology')

const topology = new Topology({ bits: 16, successorListLength: 3 })
const base = [1000n, 15000n, 32000n, 52000n]
topology.initializeStableBase(base)
topology.assertInvariants()

const joins = [5000n, 9000n, 22000n, 27000n, 40000n, 47000n, 60000n]
const rounds = []
for (const id of joins) {
  topology.join(id, base[0])
  topology.assertInvariants()
  rounds.push(topology.converge())
  topology.assertInvariants()
  assert.strictEqual(topology.isIdealRing(), true)
}

assert(rounds.every(n => n <= 6))
console.log(JSON.stringify({ joins: joins.length, rounds, invariants: topology.invariants() }, null, 2))
