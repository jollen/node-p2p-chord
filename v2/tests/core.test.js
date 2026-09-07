'use strict'

const assert = require('assert')
const { IdentifierSpace, betweenOpen, betweenOpenClosed, fingerStart, successor } = require('..')

const space8 = new IdentifierSpace(8)
assert.strictEqual(space8.normalize(-1n), 255n)
assert.strictEqual(space8.add(250n, 10n), 4n)
assert.strictEqual(space8.distanceClockwise(250n, 4n), 10n)
assert.strictEqual(betweenOpenClosed(space8, 240n, 250n, 16n), true)
assert.strictEqual(betweenOpenClosed(space8, 240n, 0n, 16n), true)
assert.strictEqual(betweenOpenClosed(space8, 240n, 16n, 16n), true)
assert.strictEqual(betweenOpenClosed(space8, 240n, 128n, 16n), false)

let intervalCases = 0
const space6 = new IdentifierSpace(6)
for (let left = 0n; left < 64n; left += 1n) {
  for (let right = 0n; right < 64n; right += 1n) {
    for (let key = 0n; key < 64n; key += 1n) {
      const lr = space6.distanceClockwise(left, right)
      const lk = space6.distanceClockwise(left, key)
      const expectedOpen = left === right ? key !== left : lk > 0n && lk < lr
      const expectedOpenClosed = left === right ? true : lk > 0n && lk <= lr
      assert.strictEqual(betweenOpen(space6, left, key, right), expectedOpen)
      assert.strictEqual(betweenOpenClosed(space6, left, key, right), expectedOpenClosed)
      intervalCases += 1
    }
  }
}

const space160 = new IdentifierSpace(160)
const key = space160.fromHex('a40990f3092be5541c2edf2d8ce9a7f32a5bad14')
const finger64 = space160.toHex(fingerStart(space160, key, 64))
assert.strictEqual(finger64, 'a40990f3092be5541c2edf2e8ce9a7f32a5bad14')

assert.strictEqual(successor(space8, [10n, 80n, 200n], 81n), 200n)
assert.strictEqual(successor(space8, [10n, 80n, 200n], 250n), 10n)

console.log(JSON.stringify({ intervalCases, finger64 }, null, 2))
