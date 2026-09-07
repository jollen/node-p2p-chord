'use strict'

function defaultKeyOf(peer) {
  if (typeof peer === 'string') return peer
  if (peer && typeof peer === 'object') {
    if (peer.id) return String(peer.id)
    if (peer.address && peer.port) return `${peer.address}:${peer.port}`
  }
  throw new TypeError('peer must be a string or contain id/address+port')
}

function defaultIsConnected(connection) {
  return Boolean(connection && connection.connected !== false)
}

class ConnectionPoolTransport {
  constructor({ connector, keyOf = defaultKeyOf, isConnected = defaultIsConnected }) {
    if (!connector || typeof connector.connect !== 'function') throw new TypeError('connector.connect is required')
    this.connector = connector
    this.keyOf = keyOf
    this.isConnected = isConnected
    this.connections = new Map()
  }

  async send(peer, envelope) {
    const key = this.keyOf(peer)
    let connection = this.connections.get(key)

    // Legacy v0.5 returned here after deleting a stale cached connection,
    // which dropped the packet that triggered reconnection. V2 reconnects
    // first and sends the same packet before returning.
    if (!this.isConnected(connection)) {
      this.connections.delete(key)
      connection = await this.connector.connect(peer)
      if (!this.isConnected(connection)) throw new Error(`connection ${key} is not connected`)
      this.connections.set(key, connection)
    }

    if (typeof connection.send !== 'function') throw new TypeError('connection.send is required')

    try {
      await connection.send(envelope)
    } catch (error) {
      this.connections.delete(key)
      throw error
    }
  }

  invalidate(peer) {
    this.connections.delete(this.keyOf(peer))
  }

  clear() {
    this.connections.clear()
  }
}

module.exports = { ConnectionPoolTransport, defaultKeyOf, defaultIsConnected }
