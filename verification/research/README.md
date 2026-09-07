# Chord v2 research oracle

This directory is the executable correctness oracle carried forward from the Flowchain Chord v2 research phase. It is intentionally independent from the production implementation under `v2/`.

The oracle freezes four semantics before production work:

1. identifiers are exact integers in a configurable `2^m` space;
2. circular intervals use clockwise wrap-around;
3. `successor(k)` is the first live node clockwise whose identifier is greater than or equal to `k`, wrapping to the first node;
4. `finger[i]` begins at `n + 2^i (mod 2^m)`.

Run:

```sh
node verification/research/audit.js
```

This compact audit proves that the legacy interval predicates disagree with circular Chord semantics and verifies the known 160-bit finger arithmetic vector. The larger deterministic research campaign that preceded this repository migration additionally exercised 100,000 static lookups and dynamic successor-list repair; those gates are reintroduced as production tests in later pipelines.
