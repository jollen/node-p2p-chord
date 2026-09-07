# Chord v2 transport boundary

Pipeline 6 separates Chord algorithm correctness from network transport behavior. The pure routing and maintenance core does not import WebSocket and does not own connection state.

## Contract

Transport messages use a JSON-safe envelope with:

- protocol/version discrimination;
- globally unique message `id`;
- `correlationId` on responses;
- explicit `from`, `to`, and RPC `method`;
- structured success/error responses.

`ReliableRpc` provides request/response semantics above any concrete transport adapter. Retries reuse the same request ID so a receiving node can answer duplicate requests idempotently from its completed-request cache. Concurrent duplicate deliveries share one in-flight handler execution.

`ConnectionPoolTransport` owns connection reuse only. A disconnected cached connection is evicted, reconnected, and the current packet is sent on the replacement connection. This is the explicit regression guard for the v0.5 behavior that deleted a stale cached connection and returned before sending the packet that triggered reconnection.

## Failure semantics

Timeout and retry are transport concerns. Chord topology code consumes successful RPC results or explicit transport failures; it does not infer ring ownership from WebSocket connection state.

A transport failure may later feed a failure detector, but topology repair remains a Chord-core operation based on successor lists rather than `successor = self`.

## WebSocket migration

The historical WebSocket server remains untouched during this pipeline. A later adapter can implement the `send`/`subscribe` contract using the existing server without changing Chord core algorithms. Shadow validation should compare legacy and v2 routing before ownership cutover.
