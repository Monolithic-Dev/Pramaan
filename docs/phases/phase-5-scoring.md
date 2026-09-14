# Phase 5 of 10: Prioritisation Engine

**Days 8-9 · Track A · Blocks Phase 6**

## Objective
The explainable composite score, batch-computed, with a visible breakdown and honest disclosure of every data fallback.

This phase implements the corrected formula: weights normalised to sum to 1.0, the impact-loop term actually entering the maths, and a worked example that reproduces the published number.

## Prerequisites
Phases 1-4 complete. Issues exist. Reference data loaded against `AdminRegion`.

## Reference docs
`AI_PIPELINE.md` Stage 6 · `DATA_MODEL.md` (`PriorityScore`) · `EDGE_CASES.md` #7, #8, #11, #16

---

## Deliverables

### 5.1 The formula
```ts
base       = 0.40*demand + 0.30*vulnerability + 0.30*gap   // ∈ [0,1]
dupFactor  = 1 - 0.15*duplicationPenalty                   // ∈ [0.85, 1.00]
effFactor  = 0.85 + 0.30*impactEfficacy                    // ∈ [0.85, 1.15]; 1.00 if unknown
composite  = clamp01(base * dupFactor * effFactor)
```

Weights come from `CountryProfile`, not from constants in code — a state admin tuning weights per state is a PRD user story (§3, State Admin persona) and it is a two-line change now versus a refactor later.

### 5.2 Components

**demand_score** — `log(1 + distinct_reporter_count) / log(1 + P95_country)`, clamped to 1.
Uses distinct reporters, not raw reports. One person filing twelve times is one unit of demand. `P95_country` is recomputed per batch run and stored on the score so historical scores remain reproducible.

**vulnerability_score** — mean of available `InfraIndex.normalised_value` for the region, inverted for access-type indices (high road density → low vulnerability). Falls back **up the AdminRegion chain** (ward → block → district → state), recording the level used in `data_fallbacks`.

**gap_score** — `min(1, years_since_last_relevant_investment / 5)`. No record at all → 1.0 with an `unverified` flag.

**duplication_penalty** — 1.0 if a matching `InvestmentRecord` exists in the same category/region within 2 fiscal years; else 0. Unknown data → 0 with `unverified` (`EDGE_CASES.md` #8 — never reward or punish an issue for missing data).

**impact_efficacy** — historical `ImpactRecord.efficacy` mean for `(category, region ancestry)`, or `null` when there is no history. This is the term that closes the loop — earlier drafts described the feedback loop in Stage 8 and never entered it into the formula.

### 5.3 Fallback disclosure
Every fallback writes a structured record:
```json
{ "component": "vulnerability_score", "used_level": "district",
  "reason": "no ward-level poverty_index for LGD:IN-07-091-0014" }
```
The generated brief (Phase 6) reads this array and states every fallback in prose. Missing data becomes a visible honesty feature rather than a silent guess — and it is one of the few places where a system admitting a limitation scores *better* than one that does not.

### 5.4 Batch runner
Cloud Run job on Cloud Scheduler, every 15 minutes.
1. Query eligible issues (`distinct_reporter_count >= 3` OR `emergency_override`) — `EDGE_CASES.md` #16, #11.
2. Join reference data in BigQuery in one pass, not per-issue.
3. Compute, write `PriorityScore` with `is_canonical: true` to BigQuery (history) and the latest score onto the `Issue` document (for fast reads).
4. Emit metrics: issues scored, mean composite, fallback rate by component.

**Canonical scores are the only thing any read path returns.** The agent's `simulate_priority` tool in Phase 6 writes `is_canonical: false` and those never reach the map or the priorities list.

### 5.5 Score breakdown endpoint
`GET /v1/issues/{id}/score` — every component, the weights used, the fallbacks, `model_version`. `PRD.md` §6.3 requires this.

### 5.6 Population-weighted impact estimate
`estimated_impact_population` = sum of `AdminRegion.population` for regions within the cluster radius, scaled by the category's typical service radius. This is the entire Impact Potential criterion (15%) and it is roughly twenty lines of code.

### 5.7 Emergency override
`POST /v1/issues/{id}/emergency-override` — bypasses the minimum-report threshold and the batch cadence, triggers an immediate rescore. Logged to audit with actor and justification (`EDGE_CASES.md` #11).

---

## Acceptance criteria

- [ ] Golden-value unit test: `demand=0.71, vuln=0.55, gap=0.63, dup=0.10, efficacy=null` → `base=0.638`, `composite=0.628` (±0.001)
- [ ] Every `composite_score` produced over the full dataset is within `[0, 1]`
- [ ] An issue in a ward with recent matching investment ranks measurably below an equivalent issue in an unfunded ward — **screenshot this, it is your "we don't double-fund" demo moment**
- [ ] Issues with `distinct_reporter_count < 3` are absent from `GET /priorities`
- [ ] Setting `emergency_override` on a 1-report issue makes it appear within one batch cycle
- [ ] Missing ward-level InfraIndex produces a district-level fallback **and** a populated `data_fallbacks` entry
- [ ] Missing InvestmentRecord yields `duplication_penalty: 0` with an `unverified` flag, not a penalty and not a bonus
- [ ] `GET /issues/{id}/score` returns every component and the weights used
- [ ] Full-dataset batch run completes in under 2 minutes
- [ ] Two consecutive runs on unchanged data produce identical scores (reproducibility)
- [ ] Fallback rate is reported per component in the run metrics

## Definition of done
Given any ranked issue, you can show its complete score derivation on screen, in under five seconds, including what data was missing and what was substituted — which is precisely the question a state secretary asks.

## Traps
- Recomputing `P95_country` at query time makes scores non-reproducible. Compute per batch, store it on the score.
- `clamp01` after multiplication, not before. `effFactor` can exceed 1.0.
- Float comparison in tests needs a tolerance. `toBeCloseTo(0.628, 3)`.
- Do not let the agent's simulation tool write canonical scores. Assert `is_canonical` on every read path.
- If `impact_efficacy` is null, `effFactor` must be exactly 1.0, not 0.85. A region with no impact history must not be penalised for having no history.

## Handoff
Every eligible `Issue` has a canonical, explainable `PriorityScore` with a full breakdown and honest fallback disclosure. Tag `phase-5-done`. Phase 6's agent tools can now read real, trustworthy scores instead of placeholder data.
