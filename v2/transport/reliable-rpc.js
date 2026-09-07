'use strict'

const { defaultIdFactory, createRequest, createResponse, validateEnvelope } = require('./envelope')

class RpcTimeoutError extends Error {
  constructor(requestId, attempts) {
    super(`Chord RPC ${requestId} timed out after ${attempts} attempt(s)`)
    this.name = 'RpcTimeoutError'
    this.requestId = requestId
    this.attempts = attempts
  }
}

class RemoteRpcError extends Error {
  constructor(message, details) {
    super(message)
    this.name = 'RemoteRpcError'
    this.details = details || null
  }
}

class ReliableRpc {
  constructor({ nodeId, send, subscribe, timeoutMs = 1000, maxAttempts = 3, idFactory = defaultIdFactory, cacheSize = 1024 }) {
    if (typeof nodeId !== 'string' || nodeId.length === 0) throw new TypeError('nodeId is required')
    if (typeof send !== 'function') throw new TypeError('send is required')
    if (typeof subscribe !== 'function') throw new TypeError('subscribe is required')
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new TypeError('maxAttempts must be >= 1')
    if (!(timeoutMs >= 0)) throw new TypeError('timeoutMs must be >= 0')

    this.nodeId = nodeId
    this.send = send
    this.timeoutMs = timeoutMs
    this.maxAttempts = maxAttempts
    this.idFactory = idFactory
    this.cacheSize = cacheSize
    this.handlers = new Map()
    this.pending = new Map()
    this.completed = new Map()
    this.inflight = new Map()
    this.unsubscribe = subscribe(envelope => {
      Promise.resolve(this.receive(envelope)).catch(() => {})
    })
  }

  register(method, handler) {
    if (typeof method !== 'string' || method.length === 0) throw new TypeError('method is required')
    if (typeof handler !== 'function') throw new TypeError('handler is required')
    this.handlers.set(method, handler)
    return this
  }

  async request(to, method, payload = null, options = {}) {
    const requestId = options.requestId || this.idFactory()
    const timeoutMs = Object.prototype.hasOwnProperty.call(options, 'timeoutMs') ? options.timeoutMs : this.timeoutMs
    const maxAttempts = options.maxAttempts || this.maxAttempts
    const envelope = createRequest({ id: requestId, from: this.nodeId, to, method, payload })

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this._attempt(envelope, timeoutMs)
      } catch (error) {
        if (!(error instanceof RpcTimeoutError) || attempt === maxAttempts) {
          if (error instanceof RpcTimeoutError) error.attempts = attempt
          throw error
        }
      }
    }

    throw new RpcTimeoutError(requestId, maxAttempts)
  }

  async _attempt(envelope, timeoutMs) {
    const result = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(envelope.id)
        reject(new RpcTimeoutError(envelope.id, 1))
      }, timeoutMs)
      this.pending.set(envelope.id, { resolve, reject, timer })
    })

    try {
      await this.send(envelope.to, envelope)
    } catch (error) {
      const pending = this.pending.get(envelope.id)
      if (pending) {
        clearTimeout(pending.timer)
        this.pending.delete(envelope.id)
        pending.reject(error)
      }
    }

    return result
  }

  async receive(rawEnvelope) {
    const envelope = validateEnvelope(rawEnvelope)
    if (envelope.to !== this.nodeId) return false

    if (envelope.type === 'response') {
      const pending = this.pending.get(envelope.correlationId)
      if (!pending) return false
      clearTimeout(pending.timer)
      this.pending.delete(envelope.correlationId)
      if (envelope.ok) pending.resolve(envelope.payload)
      else pending.reject(new RemoteRpcError((envelope.error && envelope.error.message) || 'remote RPC failed', envelope.error))
      return true
    }

    if (envelope.type !== 'request') return false

    const cached = this.completed.get(envelope.id)
    if (cached) {
      await this.send(envelope.from, cached)
      return true
    }

    let responsePromise = this.inflight.get(envelope.id)
    if (!responsePromise) {
      responsePromise = this._execute(envelope)
      this.inflight.set(envelope.id, responsePromise)
    }

    const response = await responsePromise
    await this.send(envelope.from, response)
    return true
  }

  async _execute(envelope) {
    try {
      const handler = this.handlers.get(envelope.method)
      if (!handler) throw new Error(`unknown RPC method ${envelope.method}`)
      const payload = await handler(envelope.payload, envelope)
      const response = createResponse({ id: this.idFactory(), correlationId: envelope.id, from: this.nodeId, to: envelope.from, ok: true, payload })
      this._remember(envelope.id, response)
      return response
    } catch (error) {
      const response = createResponse({
        id: this.idFactory(),
        correlationId: envelope.id,
        from: this.nodeId,
        to: envelope.from,
        ok: false,
        error: { name: error.name || 'Error', message: error.message || String(error) }
      })
      this._remember(envelope.id, response)
      return response
    } finally {
      this.inflight.delete(envelope.id)
    }
  }

  _remember(requestId, response) {
    this.completed.set(requestId, response)
    while (this.completed.size > this.cacheSize) {
      const oldest = this.completed.keys().next().value
      this.completed.delete(oldest)
    }
  }

  close() {
    if (typeof this.unsubscribe === 'function') this.unsubscribe()
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error('RPC endpoint closed'))
    }
    this.pending.clear()
  }
}

module.exports = { ReliableRpc, RpcTimeoutError, RemoteRpcError }
