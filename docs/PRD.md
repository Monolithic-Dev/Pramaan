# PRD: JanSetu

## 1. Problem statement (recap)
Governments across India struggle to consolidate citizen feedback and align it with national infrastructure priorities. Development requests live in fragmented systems, leading to misaligned public spending, unaddressed infrastructure gaps, and no way to measure the impact of large-scale digital public infrastructure initiatives.

## 2. Objective / vision
Give every citizen — regardless of language, literacy, or device — a way to report an infrastructure gap in under a minute, and give every policymaker a small, trustworthy, ranked list of what to fund next, with the reasoning shown and the outcome tracked.

Non-negotiable design principle: **the system should be usable by someone with a basic feature phone and no English**, and **defensible in front of a state secretary who will ask "why did you rank this ward above that one?"**

## 3. Users & personas

| Persona | Who they are | What they need |
|---|---|---|
| **Citizen (Reporter)** | Any resident, any literacy level, any of India's major languages | Report an issue in <60 seconds by voice, text, or WhatsApp; know it was received; eventually confirm if it got fixed |
| **Field/Block Officer** | Local government staff who verify ground reality | See issues in their jurisdiction, mark verified/disputed, close out resolved ones |
| **District Collector / Policymaker** | Decision-maker allocating budget | See a ranked, explained list of where to spend next; avoid duplicate funding; report upward |
| **State Admin** | Platform configuration owner | Manage jurisdiction boundaries, category taxonomy, scoring weights per state |

## 4. Goals (hackathon MVP)
- G1: A citizen can submit a report via web text, in-app voice recording, or WhatsApp, in at least 3 Indian languages.
- G2: Duplicate/near-duplicate reports of the same real-world issue are automatically merged into one canonical `Issue`.
- G3: Issues are scored by an explainable, multi-factor formula (not a black box) and ranked per region.
- G4: A policymaker dashboard shows the ranked list with a Gemini-generated, data-grounded justification per item.
- G5: A basic anti-fraud/verification layer exists (rate limiting, geofencing, duplicate-burst detection).
- G6: A citizen can confirm resolution after a project is marked complete, and that feeds an `ImpactRecord`.

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

### 6.4 Policymaker dashboard
- As a policymaker, I see a map and ranked list of top-priority issues in my jurisdiction, each with a short AI-generated brief citing real numbers, so that I can make a funding decision quickly.
- As a state admin, I can filter/drill down by district, category, and time window.

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
| Problem-Solution Fit (20%) | Live demo showing dedup collapsing 10+ raw submissions into 1 issue, and a resolved issue with citizen-confirmed impact — both explicitly named gaps in the brief |
| AI/Technical Execution (25%) | Real Gemini calls at 3 distinct pipeline stages (extraction, dedup embeddings, grounded generation), all visible in the demo, not mocked |
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
