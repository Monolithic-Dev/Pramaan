# Architecture: JanSetu

## 1. High-level diagram

```mermaid
flowchart LR
  subgraph Ingestion Channels
    WEB[Web / PWA form]
    WA[WhatsApp Business API]
    VOICE[In-app voice recording]
  end

  WEB --> GW[Ingestion Gateway - Cloud Run]
  WA --> GW
  VOICE --> STT[Cloud Speech-to-Text] --> GW

  GW --> TR[Cloud Translation API]
  TR --> TOPIC[(Pub/Sub: raw-submissions)]

  TOPIC --> CAT[Categorization Service - Gemini structured output]
  CAT --> EMB[Embedding Service - Vertex AI Embeddings]
  EMB --> DEDUP[Dedup & Geo-Clustering Service]
  DEDUP --> FS[(Firestore: Issues, GeoClusters)]

  FS --> SCORE[Prioritization Engine]
  EXT[(External data: InfraIndex, InvestmentRecord)] --> SCORE
  SCORE --> BQ[(BigQuery: scored issues)]

  BQ --> GEN[Brief Generation - Gemini, RAG-grounded]
  GEN --> DASH_API[Dashboard API]
  DASH_API --> UI[Officer / Policymaker Web App]

  FS --> VERIFY[Verification / Anti-fraud Service]
  UI --> IMPACT[Impact Tracking Service]
  IMPACT --> FS
```

## 2. Component responsibilities

| Component | Responsibility | Notes |
|---|---|---|
| Ingestion Gateway | Accepts submissions from all channels, normalizes into one schema, writes raw record, publishes to Pub/Sub | Must respond fast (<2s) even if downstream AI is slow — never block the citizen on AI processing |
| Speech-to-Text | Converts voice recordings to text in the source language | Google Cloud Speech-to-Text, language auto-detect with a manual override option |
| Translation API | Translates to a canonical working language for backend processing; translates responses back | Keep original text stored alongside translation — never discard the source |
| Categorization Service | Gemini call in JSON/structured-output mode: category, subcategory, severity, extracted location text, short summary, confidence | Low-confidence outputs are routed to manual officer review, not silently trusted |
| Embedding Service | Generates a vector embedding of the canonical summary | Vertex AI Embeddings API |
| Dedup & Geo-Clustering Service | Finds candidate existing Issues within a geo-radius + same category, computes similarity, merges or creates new Issue | See `AI_PIPELINE.md` for the algorithm |
| Prioritization Engine | Computes the composite score per Issue/cluster using demand + vulnerability + gap + duplication-penalty | Deterministic, explainable formula is the reliable path; AutoML ranking model is a documented stretch goal |
| Brief Generation | Gemini call that writes the natural-language justification for a recommended project, grounded in the exact numbers passed into the prompt | Post-generation consistency check verifies every cited number exists in the input context |
| Dashboard API | Serves ranked issues, score breakdowns, and briefs to the officer/policymaker UI | Read-heavy, cacheable |
| Verification/Anti-fraud Service | Rate limiting, geofencing, burst detection, optional photo plausibility check | Flags for human review, never auto-rejects a citizen report outright |
| Impact Tracking Service | Sends resolution-confirmation prompts to original reporters, aggregates `ImpactRecord`s | Feeds back into future gap-score calculations |

## 3. Data flow narrative
1. Citizen submits via any channel → Ingestion Gateway normalizes and stores raw `Submission`, publishes an event.
2. Categorization Service extracts structured fields via Gemini.
3. Embedding Service + Dedup Service decide: merge into an existing `Issue` or create a new one.
4. Prioritization Engine periodically (or on-demand) recomputes composite scores for all open Issues in a region, joining against `InfraIndex` and `InvestmentRecord` reference tables in BigQuery.
5. Brief Generation produces a grounded, human-readable justification for the top-N ranked issues per region.
6. Officer/Policymaker UI reads from the Dashboard API, which serves cached, pre-scored data (scoring doesn't need to be real-time-to-the-second).
7. When an officer marks a project complete, Impact Tracking Service notifies original reporters and records confirmations.

## 4. Tech stack rationale
See `README.md` for the full table. Key rationale points:
- **Cloud Run everywhere** for compute — scales to zero (cost-friendly for a hackathon), no cluster to manage, fast to deploy under time pressure.
- **Firestore for operational writes, BigQuery for analytics** — Firestore's low-latency document writes are right for "citizen just submitted something," while BigQuery's SQL joins are right for "combine this cluster's demand with three different reference datasets."
- **Pub/Sub between ingestion and processing** — decouples "citizen got a response" from "AI pipeline finished," which matters both for perceived speed and for resilience if Gemini has a slow moment.
- **Deterministic scoring formula as the primary path, ML ranking as a stretch** — a government stakeholder will ask "why did my ward score lower," and "the model said so" is a weak answer during a pilot. Explainability is a feature, not a limitation.

## 5. Scalability / federation model ("built for India")
Two deployment models, and a deliberate choice about which to build for the hackathon:

- **Option A — Single multi-tenant deployment (build this for the hackathon):** one codebase, one set of services, every table partitioned by `state_id`. Simpler to build and demo in the available time.
- **Option B — Per-state federated deployment (document as the production target):** each state runs its own instance/project with data residency in-state, and a lightweight national aggregator polls a shared, versioned API contract for cross-state reporting. This mirrors how real Indian Digital Public Infrastructure is typically federated.

The important engineering decision: **the schema and API contract in `DATA_MODEL.md` / `API_SPEC.md` are designed so that moving from Option A to Option B is a deployment/config change, not a data-model rewrite.** This is worth stating explicitly on a pitch deck slide — it shows the team understood the "scale across India" requirement structurally, not just as a marketing line.

## 6. Attribution
Any open-source libraries, public datasets, or third-party APIs used must be listed here with source and license, per hackathon Rule 03.
