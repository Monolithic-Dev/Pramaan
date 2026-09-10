# PRD: JanSetu

## 1. Problem statement (recap)
Governments across India struggle to consolidate citizen feedback and align it with national infrastructure priorities. Development requests live in fragmented systems, leading to misaligned public spending, unaddressed infrastructure gaps, and no way to measure the impact of large-scale digital public infrastructure initiatives.

## 2. Objective / vision
Give every citizen — regardless of language, literacy, or device — a way to report an infrastructure gap in under a minute. Give every policymaker an intelligent conversational agent to interrogate this demand—asking natural-language questions to receive a small, trustworthy, ranked list of what to fund next, grounded in cross-referenced infrastructure data and government policy.

Non-negotiable design principle: **the system should be usable by someone with a basic feature phone and no English**, and **defensible in front of a state secretary who will ask "why did you rank this ward above that one?"** The AI must refuse to answer if it lacks sufficient data, ensuring zero hallucinations in public funding recommendations.

## 3. Users & personas

| Persona | Who they are | What they need |
|---|---|---|
| **Citizen (Reporter)** | Any resident, any literacy level, any of India's major languages | Report an issue in <60 seconds by voice, text, or WhatsApp; know it was received; eventually confirm if it got fixed |
| **Field/Block Officer** | Local government staff who verify ground reality | See issues in their jurisdiction, mark verified/disputed, close out resolved ones |
| **District Collector / Policymaker** | Decision-maker allocating budget | Ask natural-language questions about constituency needs; get evidence-cited answers cross-referencing demand against planned investment; generate formal policy-grounded briefs |
| **State Admin** | Platform configuration owner | Manage jurisdiction boundaries, category taxonomy, scoring weights per state |

## 4. Goals (hackathon MVP)
- G1: A citizen can submit a report via web text, in-app voice recording, or WhatsApp, in at least 3 Indian languages.
- G2: Duplicate/near-duplicate reports of the same real-world issue are automatically merged into one canonical `Issue`.
- G3: Issues are scored by an explainable, multi-factor formula (not a black box) and ranked per region.
- G4: Policymakers can interact with a conversational agent (Gemini with Function Calling) that answers questions by executing real-time data queries.
- G5: Every agent recommendation explicitly cites its evidence, and the agent refuses to answer if unsupported by data.
- G6: A basic anti-fraud/verification layer exists (rate limiting, geofencing, duplicate-burst detection).
- G7: A citizen can confirm resolution after a project is marked complete, and that feeds an `ImpactRecord`.

## 5. Non-goals (hackathon scope)
- Full telephony-based IVR integration (voice recording in-app satisfies the voice requirement for MVP; real IVR is a stretch goal — see `ROADMAP.md`).
- Full production-grade fraud ML model — MVP uses rule-based heuristics, explicitly documented as an upgrade path.
- Actual disbursement/budget integration with real government financial systems — MVP recommends, does not execute, funding decisions.
- Full coverage of all 22 scheduled languages — MVP targets 3, architected to add more.

## 6. Functional requirements (user stories)

### 6.1 Ingestion
- As a citizen, I can submit a report via a web form with text, an optional photo, and my location, so that my issue is recorded.
- As a citizen, I can record a voice note in my language instead of typing, so that literacy isn't a barrier.
- As a citizen, I can send a report via WhatsApp, so that I don't need to install an app.
- As a citizen with no GPS/location sharing enabled, I can describe my location in text (landmark, ward name) and have it geocoded, so that low-tech users aren't excluded.

### 6.2 Deduplication & clustering
- As the system, I automatically detect when a new submission describes the same real-world issue as an existing one nearby, so that demand isn't inflated by duplicate reports.
- As an officer, I can see how many raw submissions were merged into a given `Issue`, so that I can trust the reported demand number.

### 6.3 Prioritization & scoring
- As a policymaker, I see issues ranked by a composite score combining citizen demand, vulnerability indices, existing infrastructure gaps, and already-committed investment, so that I don't fund the same problem twice.
- As a policymaker, I can see the exact breakdown of a score (not just the final number), so that I can defend the ranking to stakeholders.

### 6.4 Policymaker dashboard & Agent Interface
- As a policymaker, I can ask a conversational agent natural-language questions about my jurisdiction's infrastructure needs, so I don't have to manually cross-reference dashboards.
- As a policymaker, every answer I receive includes explicit citations to demand data, demographic metrics, or investment records, so I can defend the decision.
- As a policymaker, I can ask the agent to generate a formal, policy-grounded brief on demand, so that I can hand something concrete to other decision-makers.
- As a system operator, I want the agent to explicitly refuse or flag questions that lack supporting data, rather than guessing.
- As a state admin, I see a map view alongside the chat to filter/drill down geographically.

### 6.5 Verification & anti-fraud
- As the system, I flag submissions with implausible location data, unusually high submission bursts from a single source, or low-confidence AI extraction, so that officers review edge cases before they affect public rankings.
- As an officer, I can mark an issue verified or disputed after ground-truth checking.

### 6.6 Impact loop
- As a citizen, after a project addressing my report is marked complete, I receive a request to confirm resolution (photo or simple yes/no), so that the platform measures real outcomes.
- As a policymaker, I can see historical realized-impact rates per category/region, so that future scoring accounts for which interventions actually worked.

### 6.7 Multilingual / voice
- As a citizen, I interact entirely in my chosen language for both input and any response/confirmation messages, including spoken read-back of confirmations for low-literacy users.

## 7. Success metrics (mapped to judging criteria)

| Judging criterion | What we demo to prove it |
|---|---|
| Problem-Solution Fit (20%) | Live demo showing dedup collapsing 10+ raw submissions into 1 issue, and a conversational agent answering questions with citations. |
| AI/Technical Execution (25%) | Real Gemini function-calling orchestration using tools (`query_fused_data`, `check_investment_status`), not just generating text. Demonstration of explicit refusal guardrails. |
| Depth & Reach Across India (20%) | Demo dataset spans 3+ states, 3+ languages, 5+ issue categories |
| Impact Potential (15%) | Dashboard shows population-weighted impact estimate per recommended project |
| Deployability & Scalability (20%) | Architecture doc shows a single-codebase, per-state config model that a state IT department could stand up without a rewrite |

## 8. Assumptions & constraints
- Real-time government infrastructure investment data is not fully open — MVP uses realistic sample/mock `InvestmentRecord` data, clearly labeled as such in the demo (permitted per hackathon rules: "real or realistic data").
- Vulnerability/infra-gap indices are approximated using public sources (e.g., Census handbooks, SDG India Index-style indicators) rather than a single authoritative live feed.
- Hackathon demo uses a synthetic-but-realistic submission dataset (see `TESTING.md`) to populate the dashboard convincingly; live citizen traffic is out of scope for demo day.

## 9. Future roadmap (post-hackathon, for the pitch deck's "how it scales" slide)
- Full IVR phone-line channel for feature-phone users with zero data connectivity.
- Vertex AI AutoML ranking model trained on real historical scheme-outcome data, replacing/augmenting the hand-tuned formula.
- Per-state federated deployment with a national aggregation layer.
- Integration with existing India Stack components (e.g., DigiLocker for officer identity, Aadhaar-based optional citizen verification for high-trust reports).
