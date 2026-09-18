# Feature 5: Instant State Onboarding Demo

## Why this is unique
`docs/ARCHITECTURE.md` already claims the system can move from a single shared deployment to a
per-state federated one "as a config change, not a rewrite." Almost every team will make a
scalability claim on a slide. This makes yours literally demonstrable, live, in front of judges —
which is a categorically stronger signal for "Deployability & Scalability" than any amount of
prose.

## What to build (~1 day)

- New admin-only screen: `apps/web/src/routes/admin/AddStatePage.tsx` — a form taking a state
  name and a small reference-data CSV (or a "use sample data" button for the demo).
- Wraps the **existing** `scripts/seed-demo-data/generateReferenceData.ts` (from Phase 2) behind
  a new endpoint `POST /admin/states` — this is a thin UI/API wrapper around a script you already
  built, not new logic.
- On submit: creates the new `state_id` partition, loads a small starter `InfraIndex` sample for
  it, and the new state immediately appears as a filter option in the officer/policymaker
  dashboard — no redeploy, no code change.
- Admin-only, obviously — gate behind the `state_admin`/platform-owner role, not exposed publicly.

## Demo moment
*"Watch — I'm adding Odisha to the platform right now, live, with zero code deployed."* Submit
the form, then immediately switch the dashboard's state filter to show Odisha now listed
alongside your existing demo states.

## Watch out for
- This must genuinely reuse Phase 2's existing seeding script — if it turns into a parallel,
  separately-maintained data-loading path, it stops proving the "config change, not a rewrite"
  claim and starts undermining it.
- Keep this admin-gated — don't accidentally expose state-creation to any authenticated officer.

## Effort
~1 day — almost entirely UI plus wiring to a script that already exists, which is exactly why
it's a good Tier 2 pick: low technical risk, high pitch-deck payoff.
