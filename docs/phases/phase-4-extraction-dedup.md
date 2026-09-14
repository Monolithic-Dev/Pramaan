# Phase 4 of 10: Extraction & Deduplication

**Days 5-8 · Track A · Blocks Phase 5**

## Objective
Gemini structured extraction, embeddings, and the geohash-based dedup that collapses many raw submissions into one canonical `Issue`.

This is your Problem-Solution Fit proof point (20%) and half your AI/Technical Execution story. It is also where the dedup algorithm becomes actually implementable — a naive Firestore geo-radius query, as an earlier draft of this pipeline assumed, does not exist.

## Prerequisites
Phases 1-3 complete. Seed data loaded as `submissions` only, no pre-created issues.

## Reference docs
`AI_PIPELINE.md` Stages 2-4 · `DATA_MODEL.md` (`Issue` entity) · `EDGE_CASES.md` #4, #9, #16, #17

---

## Deliverables

### 4.1 Categorisation service
Pub/Sub-triggered worker. Gemini with an SDK **`responseSchema`**, not prompt-instructed JSON.

This distinction matters: schema-typed output eliminates the malformed-JSON failure class structurally, rather than handling it after the fact. `EDGE_CASES.md` #9's retry logic stays as a backstop, but it should almost never fire.

Extract: `category` · `subcategory` · `severity_estimate` · `extracted_location_text` · `summary` (≤25 words) · `confidence` · `contains_personal_emergency`.

Routing:
- `confidence < 0.5` or schema failure → officer review queue, `status: "flagged"`
- `contains_personal_emergency` → separate flow, out of the infra pipeline
- Malformed twice → raw-text-only categorisation, never silently dropped

Prompts live in `packages/ai-prompts` with a version string. Every output records `prompt_version`.

### 4.2 Embedding service
`text-embedding-005`, 768-dim, over `summary`. Batch where possible — the seed run is ~1,500 calls and batching cuts both time and cost.

### 4.3 Geohash utilities (`packages/shared-utils`)
```ts
geohashEncode(lat, lng, precision)   // ngeohash
geohashNeighbours(hash): string[9]   // self + 8 surrounding
haversineMeters(a, b): number
cosine(a, b): number
densityClass(regionId): 'urban'|'peri'|'rural'
```

Pure functions, no I/O. Unit-test each at boundary values — these are the easiest correct tests in the whole project and they protect the most important algorithm.

### 4.4 Dedup service — the core

```ts
async function processSubmission(sub: Submission) {
  // 1. Same-reporter pre-check (EDGE #4) — before embedding, before cost
  const own = await findOwnRecentIssue(sub.citizen_id, sub.category, HOURS_72);
  if (own) return mergeInto(own, sub, { incrementDistinctReporter: false });

  // 2. Geohash candidate retrieval
  const cells = geohashNeighbours(sub.geohash);
  const candidates = await scopedQuery('issues', ctx)
    .where('category', '==', sub.category)
    .where('geohash', 'in', cells)
    .where('status', 'not-in', ['resolved', 'tombstoned'])
    .limit(200).get();

  // 3. Exact distance filter
  const radius = RADIUS_M[densityClass(sub.admin_region_id)];
  const near = candidates.filter(i => haversineMeters(sub, i) <= radius);

  // 4. Similarity
  const emb = await embed(sub.summary);
  const { best, score } = argmaxCosine(emb, near);

  return score >= SIMILARITY_THRESHOLD
    ? mergeInto(best, sub, { embedding: emb, incrementDistinctReporter: true })
    : createIssue(sub, emb);
}
```

`RADIUS_M`: urban 300 · peri-urban 800 · rural 2000.

**Merge semantics:**
- `report_count` += 1 always
- `distinct_reporter_count` += 1 only for a new reporter
- Centroid = mean of member coordinates, weighting `location_confidence: "low"` at 0.3
- Issue embedding = re-normalised running mean of member embeddings, **not** a replacement with the newest — otherwise the canonical issue drifts toward whoever reported last
- `last_reported_at` updated

### 4.5 Threshold tuning — do not skip this
Build a labelled set of **120 submission pairs** (60 true duplicates, 60 near-misses — same category and street but genuinely different issues). Sweep the threshold from 0.70 to 0.92 in 0.02 steps. Record precision, recall, and F1 at each point. Pick the threshold, commit the table to the repo.

```
scripts/tune-threshold.ts → docs/DEDUP-TUNING.md
```

Half a day of work. It converts "we used 0.82" into "we evaluated 12 thresholds against 120 hand-labelled pairs and selected 0.82 at precision 0.94 / recall 0.88." Those are the two sentences that separate a project doing real engineering from one that pasted a magic constant, under the criterion carrying the most weight.

### 4.6 Point-in-polygon region resolution (`EDGE_CASES.md` #17)
`lat/lng` → `admin_region_id` via BigQuery `ST_CONTAINS`. Never trust citizen-typed admin names. Cache resolutions by geohash7 — ward boundaries do not move.

### 4.7 Photo verification 🟡
Gemini Vision plausibility check → `fraud_flags`. Soft signal, never a block. Only if Phase 4 finishes on Day 7.

---

## Acceptance criteria

- [ ] Full seed dataset processes end-to-end with **zero unhandled errors**
- [ ] ~1,500 submissions collapse to a plausible issue count (expect 300-600; if it is ~1,500 the threshold is too high, if it is <100 it is too low)
- [ ] **The demo cluster: 12+ submissions across 3 languages collapse into exactly 1 Issue** with `report_count >= 12`
- [ ] Same-citizen duplicates increment `report_count` but not `distinct_reporter_count`
- [ ] Two genuinely different issues 50 m apart in the same category stay separate
- [ ] Two identical issues 5 km apart in a rural region merge; in an urban region they do not
- [ ] `docs/DEDUP-TUNING.md` contains the full sweep table with P/R/F1
- [ ] Malformed Gemini output (force it with a broken prompt fixture) retries once then degrades gracefully — no dropped submission
- [ ] A no-GPS submission geocodes from `location_text` and is down-weighted in the centroid
- [ ] Geohash/Haversine/cosine unit tests pass at boundary values
- [ ] Reprocessing the same submission twice does not double-count

## Definition of done
You can point at a Firestore document, say "these fourteen reports in three languages are one pothole," and show the similarity scores that decided it.

## Traps
- Firestore `in` queries cap at 30 values. Nine geohash neighbours is fine; do not extend to precision-5 neighbours without checking.
- Geohash cells do not align to radii. The neighbour set plus Haversine filter is required — a prefix match alone silently misses issues just across a cell boundary. This is the classic geohash bug.
- `status not-in` combined with `in` on another field needs the composite index from Phase 1. Verify it is `READY`.
- Embedding dimensions must match across all stored issues. Changing the model mid-build invalidates every stored embedding — pin `text-embedding-005` in config and do not change it.
- Concurrent submissions to the same cluster can race on `report_count`. Use a Firestore transaction, not a read-modify-write.

## Handoff
Raw submissions become deduplicated `Issue`s automatically, with real Gemini calls doing real categorisation and real embedding-based merging. Tag `phase-4-done`. Phase 5 can now score real `Issue` documents instead of test fixtures.
