'use strict'

const crypto = require('crypto')

const PROTOCOL = 'chord-v2'
const VERSION = 1
const TYPES = new Set(['request', 'response', 'event'])

function defaultIdFactory() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return crypto.randomBytes(16).toString('hex')
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`)
  }
}

function createRequest({ id = defaultIdFactory(), from, to, method, payload = null }) {
  assertString(id, 'id')
  assertString(from, 'from')
  assertString(to, 'to')
  assertString(method, 'method')
  return { protocol: PROTOCOL, version: VERSION, type: 'request', id, correlationId: null, from, to, method, payload }
}

function createResponse({ id = defaultIdFactory(), correlationId, from, to, ok = true, payload = null, error = null }) {
  assertString(id, 'id')
  assertString(correlationId, 'correlationId')
  assertString(from, 'from')
  assertString(to, 'to')
  if (typeof ok !== 'boolean') throw new TypeError('ok must be a boolean')
  return { protocol: PROTOCOL, version: VERSION, type: 'response', id, correlationId, from, to, ok, payload, error }
}

function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') throw new TypeError('envelope must be an object')
  if (envelope.protocol !== PROTOCOL) throw new TypeError(`unsupported protocol ${envelope.protocol}`)
  if (envelope.version !== VERSION) throw new TypeError(`unsupported protocol version ${envelope.version}`)
  if (!TYPES.has(envelope.type)) throw new TypeError(`unsupported envelope type ${envelope.type}`)
  assertString(envelope.id, 'envelope.id')
  assertString(envelope.from, 'envelope.from')
  assertString(envelope.to, 'envelope.to')
  if (envelope.type === 'request') {
    assertString(envelope.method, 'envelope.method')
    if (envelope.correlationId !== null) throw new TypeError('request correlationId must be null')
  }
  if (envelope.type === 'response') {
    assertString(envelope.correlationId, 'envelope.correlationId')
    if (typeof envelope.ok !== 'boolean') throw new TypeError('response ok must be a boolean')
  }
  return envelope
}

module.exports = { PROTOCOL, VERSION, defaultIdFactory, createRequest, createResponse, validateEnvelope }
