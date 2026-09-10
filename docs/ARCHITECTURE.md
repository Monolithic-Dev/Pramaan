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
  BQ --> AGENT[AI Agent Layer - Gemini Function Calling]
  EXT[(External data: InfraIndex, InvestmentRecord)] --> BQ
  AGENT --> T1[Tool: query_fused_data]
  AGENT --> T2[Tool: check_investment_status]
  AGENT --> T3[Tool: score_priority]
  AGENT --> T4[Tool: generate_brief]
  
  T1 --> BQ
  T2 --> BQ
  T3 --> BQ
  T4 --> FS
  
  AGENT --> DASH_API[Agent/Dashboard API]
  DASH_API --> UI[Officer / Policymaker Web App (Chat + Map)]

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
| AI Agent Layer | Gemini function-calling orchestrator that parses user questions and calls relevant tools below to get data | The primary interface for policymakers |
| Tool: query_fused_data | Retrieves matching clustered demand records from BigQuery | Used by Agent |
| Tool: check_investment_status | Cross-references against InvestmentRecord data to see if an issue is funded | Used by Agent |
| Tool: score_priority | Computes the composite score using demand, vulnerability, and duplication penalty | Used by Agent to rank issues |
| Tool: generate_brief | Retrieves policy documents and generates a RAG-grounded justification | Used by Agent for formal exports |
| Agent/Dashboard API | Serves chat responses and map data to the UI | Handles session state and streaming responses |
| Verification/Anti-fraud Service | Rate limiting, geofencing, burst detection, optional photo plausibility check | Flags for human review, never auto-rejects a citizen report outright |
| Impact Tracking Service | Sends resolution-confirmation prompts to original reporters, aggregates `ImpactRecord`s | Feeds back into future gap-score calculations |

## 3. Data flow narrative
1. Citizen submits via any channel → Ingestion Gateway normalizes and stores raw `Submission`, publishes an event.
2. Categorization Service extracts structured fields via Gemini.
3. Embedding Service + Dedup Service decide: merge into an existing `Issue` or create a new one.
4. The AI Agent Layer stands ready. When a policymaker asks a question via the UI, the Agent invokes the required tools (`query_fused_data`, `check_investment_status`, `score_priority`).
5. Tools execute SQL queries against BigQuery (joining operational data with reference datasets like `InfraIndex`) and return structured, sourced data to the Agent.
6. The Agent synthesizes an answer with citations. If asked, it can call `generate_brief` to produce a RAG-grounded policy document.
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
