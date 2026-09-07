'use strict'

const assert = require('assert')
const { createRequest, createResponse, validateEnvelope } = require('../transport/envelope')
const { ConnectionPoolTransport } = require('../transport/connection-pool')
const { ReliableRpc, RpcTimeoutError } = require('../transport/reliable-rpc')

async function testEnvelopeCorrelation() {
  const request = createRequest({ id: 'req-1', from: 'a', to: 'b', method: 'findSuccessor', payload: { key: '01' } })
  const response = createResponse({ id: 'res-1', correlationId: request.id, from: 'b', to: 'a', payload: { owner: '02' } })
  assert.strictEqual(validateEnvelope(request), request)
  assert.strictEqual(validateEnvelope(response), response)
  assert.strictEqual(response.correlationId, request.id)
}

async function testDisconnectedCachedConnectionDoesNotDropPacket() {
  const sent = []
  let connectCount = 0
  const connector = {
    async connect(peer) {
      connectCount += 1
      const generation = connectCount
      return {
        connected: true,
        async send(envelope) { sent.push({ generation, peer, id: envelope.id }) }
      }
    }
  }

  const transport = new ConnectionPoolTransport({ connector })
  const peer = { id: 'node-b' }
  await transport.send(peer, { id: 'first' })
  transport.connections.get('node-b').connected = false
  await transport.send(peer, { id: 'second' })

  assert.strictEqual(connectCount, 2)
  assert.deepStrictEqual(sent.map(item => item.id), ['first', 'second'])
  assert.strictEqual(sent[1].generation, 2)
}

function linkedSubscribers() {
  const subscribers = new Map()
  return {
    subscribe(id, handler) {
      subscribers.set(id, handler)
      return () => subscribers.delete(id)
    },
    deliver(id, envelope) {
      const handler = subscribers.get(id)
      if (handler) queueMicrotask(() => handler(envelope))
    }
  }
}

async function testRetryCorrelationAndIdempotency() {
  const bus = linkedSubscribers()
  let attemptsFromA = 0
  let handlerCalls = 0

  const a = new ReliableRpc({
    nodeId: 'a',
    timeoutMs: 5,
    maxAttempts: 3,
    idFactory: (() => { let n = 0; return () => `a-${++n}` })(),
    subscribe: handler => bus.subscribe('a', handler),
    send: async (to, envelope) => {
      if (envelope.type === 'request') {
        attemptsFromA += 1
        if (attemptsFromA === 1) return
      }
      bus.deliver(to, envelope)
    }
  })

  const b = new ReliableRpc({
    nodeId: 'b',
    timeoutMs: 5,
    maxAttempts: 3,
    idFactory: (() => { let n = 0; return () => `b-${++n}` })(),
    subscribe: handler => bus.subscribe('b', handler),
    send: async (to, envelope) => bus.deliver(to, envelope)
  })

  b.register('findSuccessor', async payload => {
    handlerCalls += 1
    return { owner: payload.key === 'k' ? 'node-k' : 'unknown' }
  })

  const payload = await a.request('b', 'findSuccessor', { key: 'k' }, { requestId: 'stable-request-id' })
  assert.deepStrictEqual(payload, { owner: 'node-k' })
  assert.strictEqual(attemptsFromA, 2)
  assert.strictEqual(handlerCalls, 1)

  const duplicate = createRequest({ id: 'stable-request-id', from: 'a', to: 'b', method: 'findSuccessor', payload: { key: 'k' } })
  await b.receive(duplicate)
  assert.strictEqual(handlerCalls, 1)

  a.close()
  b.close()
}

async function testTimeoutGate() {
  const rpc = new ReliableRpc({
    nodeId: 'a',
    timeoutMs: 2,
    maxAttempts: 2,
    idFactory: () => 'timeout-request',
    subscribe: () => () => {},
    send: async () => {}
  })

  await assert.rejects(
    rpc.request('missing', 'ping'),
    error => error instanceof RpcTimeoutError && error.requestId === 'timeout-request' && error.attempts === 2
  )
  rpc.close()
}

;(async () => {
  await testEnvelopeCorrelation()
  await testDisconnectedCachedConnectionDoesNotDropPacket()
  await testRetryCorrelationAndIdempotency()
  await testTimeoutGate()
  console.log(JSON.stringify({
    envelopeCorrelation: 'PASS',
    disconnectedCachedConnection: 'PASS',
    retryWithStableRequestId: 'PASS',
    idempotentDuplicateHandling: 'PASS',
    timeoutGate: 'PASS'
  }, null, 2))
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
