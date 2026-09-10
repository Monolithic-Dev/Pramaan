# AI Pipeline: JanSetu

This is the core technical differentiator of the submission — judges scoring "AI/Technical Execution" (25%, the heaviest criterion) should be able to see Google AI doing real, verifiable work at each stage below, not one Gemini call wrapping a form.

## Stage 1 — Multichannel normalization
- Voice input → Cloud Speech-to-Text (auto language detection, with manual override if confidence is low).
- All text (whichever source language) → Cloud Translation API → canonical working language for backend processing.
- The **original, untranslated text is always retained** alongside the translation — never discard the source, both for auditability and because translation errors are exactly the kind of thing an officer needs to be able to check.

## Stage 2 — Categorization & entity extraction (Gemini, structured output)
Example prompt (structured/JSON mode):
```
System: You are an information extraction system for a citizen infrastructure
complaint platform. Given the citizen's report, output strict JSON with fields:
category (one of: water, roads, electricity, sanitation, health_infra,
education_infra, other), subcategory, severity_estimate (low/medium/high),
extracted_location_text, summary (<=25 words), confidence (0-1).
Do not include any text outside the JSON object.

User: <translated submission text>
```
Implementation notes:
- Validate the response against a strict JSON schema before accepting it.
- If `confidence < 0.5` or schema validation fails, route to manual officer review rather than silently trusting the extraction (see `EDGE_CASES.md`, item on malformed Gemini output).
- `summary` becomes the text that gets embedded in Stage 3 — keep it short and information-dense.

## Stage 3 — Semantic + geospatial deduplication
This is the single most technically substantial piece of the system, and the part almost no competing team will attempt.

Algorithm:
1. Generate a vector embedding of the new submission's `summary` (Vertex AI Embeddings API).
2. Query existing `Issue`s whose `GeoCluster` centroid is within a configurable radius (e.g. 300m for dense urban areas, wider in rural areas) **and** whose `category` matches.
3. Compute cosine similarity between the new embedding and each candidate Issue's stored embedding.
4. If similarity ≥ threshold (start at 0.82, tune against a labeled test set — see `TESTING.md`) → merge: increment `report_count`, append `submission_id`, recompute centroid.
5. Otherwise → create a new `Issue` and `GeoCluster`.

Pseudocode:
```python
def process_submission(sub):
    embedding = embed(sub.summary)
    candidates = query_issues(near=sub.location, radius_m=300, category=sub.category)
    best_match, best_score = None, 0.0
    for issue in candidates:
        score = cosine_similarity(embedding, issue.embedding)
        if score > best_score:
            best_match, best_score = issue, score
    if best_score >= SIMILARITY_THRESHOLD:
        merge_into(best_match, sub)
    else:
        create_new_issue(sub, embedding)
```

## Stage 4 — Optional photo verification (Gemini Vision)
When a photo is attached, a lightweight Gemini Vision call asks whether the image content is plausibly consistent with the stated category — e.g. "does this photo show a road/pothole issue, a water-related issue, or something unrelated?"

This is used as a **soft signal only, never a hard auto-reject** — false positives here would unfairly block a legitimate citizen report, which is a worse failure mode than letting a borderline case through to officer review.

## Stage 5 — The Gemini Agent (Core Orchestration)
Instead of a static dashboard, officers interrogate the data via a conversational agent.

The agent's job is threefold:
1. Parse a natural-language question into tool calls.
2. Synthesize an answer that stays faithful to the structured data returned by tools, with explicit citations.
3. **Refuse to answer** if the retrieved data does not support a confident response.

Tools available to the agent:
- `query_fused_data(location, category, timeframe)`: Retrieves matching demand records from BigQuery.
- `check_investment_status(location, category)`: Cross-references against `InvestmentRecord` to check for prior funding.
- `score_priority(candidates)`: Runs the prioritization formula (Stage 6) on the fly for the selected candidates.
- `generate_brief(topic)`: Retrieves policy documents and generates a RAG-grounded brief (Stage 7).

## Stage 6 — Explainable prioritization
Composite score, computed per `Issue` (or its `GeoCluster`):

```
composite_score = 0.35 * demand_score
                + 0.25 * vulnerability_score
                + 0.25 * gap_score
                - 0.15 * duplication_penalty
```

| Component | Definition |
|---|---|
| `demand_score` | Log-scaled, normalized `report_count` within the cluster (log scaling prevents one viral issue from dominating the ranking) |
| `vulnerability_score` | Derived from `InfraIndex` — e.g. inverse of existing infra access, poverty index for the region |
| `gap_score` | Years since the last relevant `InvestmentRecord` in that region/category (longer gap → higher score) |
| `duplication_penalty` | Reduces score if a matching, recent `InvestmentRecord` already funds this category/region — prevents double-funding |

**Stretch goal (only if time permits):** train a Vertex AI AutoML Tables model on historical scheme-outcome data to learn the weights instead of hand-tuning them. Keep the hand-tuned formula as the permanent fallback and the thing you actually explain in the demo — a government stakeholder will ask "why did my ward score lower than that one," and "a model decided" is a weak answer during a pilot conversation. Explainability here is a design decision, not a shortcut.

## Stage 7 — Policy-Grounded Justification Generation (RAG)
When the officer asks for a formal brief, the agent executes a genuine document-retrieval RAG pipeline to ground the justification in real government policy.

1. Policy/scheme documents (e.g., PMGSY guidelines, rural infrastructure schemes) are chunked and embedded in Vertex AI Vector Search.
2. The agent retrieves relevant chunks based on the category/location.
3. Gemini generates the brief, explicitly citing both the **demand/investment data** and the **scheme/policy basis**.

Example prompt:
```
System: You write short, factual briefs for government officials.
Use ONLY the data provided below. Do not invent statistics. 
Cite the provided scheme guidelines to justify funding eligibility.

Data:
- Demand: Ward 14, Roads (14 distinct reports)
- Investment: None in last 2 years
- Policy: [Retrieved chunk from PMGSY guidelines regarding unpaved roads]
```

Post-generation guardrail: A consistency check ensures every number and policy referenced exists in the tool output. If not, the brief is regenerated or rejected.

## Stage 8 — Impact loop reasoning
After a `Project` is marked complete, the Impact Tracking Service messages the original reporters (via their original channel) asking for a resolution confirmation. Aggregated `ImpactRecord`s are joined back into future `gap_score` calculations — e.g. "how often has past investment in this category/region actually resolved the reported issue?" This is a genuine (if simple) feedback loop, and it's the direct answer to the brief's stated gap: "no way to measure the impact."

## Model/prompt versioning
Every scored `PriorityScore` and generated `Project.generated_brief` records a `model_version` / prompt-version identifier, so that a scoring or prompt change can be evaluated against historical output before being rolled out — see `TESTING.md` for the regression-test approach.
