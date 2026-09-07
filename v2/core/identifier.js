'use strict'

const assert = require('assert')

class IdentifierSpace {
  constructor(bits = 160) {
    assert(Number.isInteger(bits) && bits > 0, 'bits must be a positive integer')
    this.bits = bits
    this.modulus = 1n << BigInt(bits)
    this.mask = this.modulus - 1n
    this.hexLength = Math.ceil(bits / 4)
  }

  normalize(value) {
    const n = this.toBigInt(value)
    const result = n % this.modulus
    return result >= 0n ? result : result + this.modulus
  }

  toBigInt(value) {
    if (typeof value === 'bigint') return value
    if (typeof value === 'number') {
      assert(Number.isSafeInteger(value), 'number identifiers must be safe integers; use BigInt for large identifiers')
      return BigInt(value)
    }
    if (Buffer.isBuffer(value)) {
      if (value.length === 0) return 0n
      return BigInt('0x' + value.toString('hex'))
    }
    if (typeof value === 'string') {
      const text = value.trim()
      assert(text.length > 0, 'identifier string must not be empty')
      return BigInt(text)
    }
    throw new TypeError('identifier must be bigint, safe integer, Buffer, or BigInt-compatible string')
  }

  fromHex(hex) {
    assert(typeof hex === 'string' && /^[0-9a-fA-F]+$/.test(hex), 'hex identifier must contain hexadecimal digits only')
    return this.normalize(BigInt('0x' + hex))
  }

  toHex(value) {
    return this.normalize(value).toString(16).padStart(this.hexLength, '0')
  }

  add(value, delta) {
    return this.normalize(this.normalize(value) + this.toBigInt(delta))
  }

  distanceClockwise(from, to) {
    return this.normalize(this.normalize(to) - this.normalize(from))
  }
}

module.exports = { IdentifierSpace }
