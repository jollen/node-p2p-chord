'use strict'

const assert = require('assert')
const ref = require('./reference')
const legacy = require('./legacy-model')

function auditIntervals(bits = 6) {
  const m = 1n << BigInt(bits)
  let cases = 0
  let legacyHalfMismatch = 0
  let legacyOpenMismatch = 0
  for (let left = 0n; left < m; left += 1n) {
    for (let right = 0n; right < m; right += 1n) {
      for (let key = 0n; key < m; key += 1n) {
        if (legacy.legacyHalfRange(key, left, right) !== ref.openClosed(left, key, right, bits)) legacyHalfMismatch += 1
        if (legacy.legacyOpenRange(key, left, right) !== ref.open(left, key, right, bits)) legacyOpenMismatch += 1
        cases += 1
      }
    }
  }
  assert(legacyHalfMismatch > 0)
  assert(legacyOpenMismatch > 0)
  return { bits, cases, legacyHalfMismatch, legacyOpenMismatch }
}

function auditFinger160() {
  const key = BigInt('0xa40990f3092be5541c2edf2d8ce9a7f32a5bad14')
  const exact = ref.fingerStart(key, 64, 160).toString(16).padStart(40, '0')
  assert.strictEqual(exact, 'a40990f3092be5541c2edf2e8ce9a7f32a5bad14')
  return { exact, legacyExpected: 'a40990f3092be5541c2edf2e8ce9a7f32a5bb000' }
}

const report = { interval: auditIntervals(), finger160: auditFinger160() }
console.log(JSON.stringify(report, null, 2))
