# Flowchain Ledger adapter boundary

Pipeline 7 freezes the integration contract between generic Chord v2 routing and Flowchain ledger semantics before `flowchain-ledger` is modified.

## Direction

The dependency direction is intentionally one-way:

```text
flowchain-ledger
    |
    | derives a ledger/application key
    v
node-p2p-chord v2 PlacementAdapter
    |
    | findSuccessor(key)
    v
owner node identifier
```

The Chord repository does not derive Flowchain transaction keys and does not know how data is persisted after ownership is resolved.

## Chord-owned responsibilities

The v2 integration surface accepts an already-derived identifier and returns placement metadata:

- normalized key;
- responsible `ownerId`;
- lookup path;
- hop count.

Placement delegates to the same verified `findSuccessor()` implementation used by the core lookup gates. The adapter does not introduce a second ownership algorithm.

## Ledger-owned responsibilities

The following remain outside generic Chord and must be implemented by `flowchain-ledger` or its adapter layer:

- `save(data)` and `read(key)` application operations;
- deterministic Flowchain data/transaction key derivation;
- the paper's double-SHA256 data-key policy if adopted for the ledger;
- transaction database and persistence policy;
- virtual block creation/submission;
- `NOTIFY_EDGE` or other Flowchain application messages;
- verification, signing, replication, migration, and application-level idempotency policy.

## Identifier width

Chord v2 keeps identifier width configurable. A ledger adapter must explicitly map its key material into the configured Chord identifier space. This prevents a silent change from the historical 160-bit Chord node identifier space to the paper's 256-bit data-key formulation.

The correct production policy must therefore be explicit, for example either:

1. configure the Chord ring as 256-bit and normalize both node and data identifiers accordingly; or
2. keep a 160-bit ring and define a documented deterministic projection from ledger keys into that space.

Pipeline 7 deliberately does not choose that Flowchain product policy inside the generic Chord package.

## Migration gate

`flowchain-ledger/p2p` remains a frozen compatibility reference. The next repository-integration pipeline should introduce a ledger-side adapter that calls this placement contract while the old path still serves production behavior. Shadow validation should compare ownership before any cutover.
