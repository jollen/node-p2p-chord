# Chord v2 legacy baseline

This document freezes the historical baseline before Chord v2 development.

## Canonical historical sources

- `flowchain/node-p2p-chord` `master` at `998ec98a2002a1ac31c2c37c8bb5980bbcc41b8a` (`node-p2p-chord` v0.5.1).
- `flowchain/flowchain-ledger` `master`, whose embedded `p2p/` package identifies itself as `node-p2p-chord` v0.5.2 and contains later Flowchain-specific extensions.
- `flowchain-chord-v2-research`, used as the executable-specification direction for the replacement implementation.

The legacy files under `libs/` remain untouched during the first Chord v2 pipelines. They are compatibility references, not the implementation base for the new core.

## Known legacy correctness defects

The following behaviors are intentionally *not* copied into Chord v2:

1. Circular interval predicates reverse the wrap-around region when `left > right`.
2. `FIND_SUCCESSOR` may return `closest_preceding_node(id)` as `FOUND_SUCCESSOR` instead of continuing the lookup for the original target identifier.
3. Finger offsets use JavaScript `Number`, which is not an exact representation for a 160-bit identifier space.
4. The default table contains only eight low-order fingers in a 160-bit identifier space, which degrades routing toward successor walking.
5. Legacy key generation mixes time and randomness into the hash input, so it is not a deterministic content/key mapping.
6. The historical Flowchain fork detects successor failure by resetting the successor to self rather than recovering from a successor list.
7. The WebSocket transport can discard the current control packet when a cached connection exists but is disconnected.

## Chord v2 boundary

`node-p2p-chord` v2 owns only DHT topology and routing concerns:

- identifier arithmetic and circular intervals;
- successor/predecessor topology;
- successor lists;
- `findSuccessor` / `closestPrecedingNode`;
- finger tables;
- join, stabilize/rectify, failure recovery;
- topology invariants.

Flowchain-specific data operations such as transaction `save/read`, virtual blocks, edge notifications, database policy, and transaction-key derivation belong in `flowchain-ledger` adapters rather than the generic Chord engine.

## Migration rule

The migration order is:

1. Build and verify a pure Chord v2 core in this repository.
2. Keep legacy v0.5.x behavior frozen as a compatibility reference.
3. Add a Flowchain adapter in `flowchain-ledger` only after the v2 lookup and maintenance gates pass.
4. Keep `flowchain-hybrid` unchanged until the ledger adapter has passed shadow validation.
