---
name: senior-database
description: >
  Use for Firestore collection/rule/index changes and BigQuery schema/query work — anything
  in docs/DATA_MODEL.md's territory. Trigger on "add a field to X", "new Firestore
  collection", "write a BigQuery query", "add an index", "is this a Firestore or BigQuery
  table", "the query is failing at runtime".
---

## What this covers for Pramaan specifically
Pramaan deliberately splits storage: Firestore for low-latency operational documents, BigQuery
for analytical joins against reference data (`InfraIndex`, `InvestmentRecord`) — both
partitioned by `state_id` for the Option A→B federation path described in
`docs/ARCHITECTURE.md`.

## Core guidance
- **New field on an existing entity:** update `packages/shared-types` first, then the
  shape-fixture test, then the read/write code. Schema drift here is the most likely silent
  multi-service bug — see Phase 2's task 10 in `docs/phases`.
- **New Firestore query pattern:** check `docs/DATA_MODEL.md` §4 and
  `firestore.indexes.json` before shipping. Firestore fails a query with no matching
  composite index at runtime, not at build time — a bad thing to discover live.
- **Every new collection/table must carry `state_id`** (or be derivable from a field that
  does, like `geo_cluster_id`) — no exceptions. Every other skill assumes this contract holds.
- **Prefer pre-aggregated tables over ad-hoc raw joins inside a request path.** The scoring
  engine's 15-minute schedule, not per-request computation, is what makes this safe to be
  slightly stale.
- **Firestore security rules default-deny.** A new collection needs an explicit rule
  addition — don't assume the default covers it.

## Example
Adding a "category tags" multi-select to `Issue`: this is a new array field on the existing
`Issue` document (shared-types + Firestore + a composite index only if it's ever queried on),
not a new collection — don't split entities that are always read and written together.

## Watch out for
- A new collection missing `state_id`.
- A new query pattern with no matching composite index.
- Treating BigQuery as if it has Firestore's write latency.
- A `shared-types` change with no corresponding fixture-test update.
- A genuinely new collection with no `firestore.rules` entry.

## Hand off to
`senior-security` for any new PII-bearing field; `senior-backend` for implementing the actual
query/write code.
