<div align="center">

<img src="apps/web/public/icon.svg" width="88" alt="Pramaan logo" />

# Pramaan

### Citizen voice → funded, verified public works

**A citizen reports a problem in their own language. Pramaan understands it, merges it with what the neighbours said, ranks it in the open, finds the national scheme that can pay for the fix, helps the officer spend the budget where it reaches the most people, and only calls it "fixed" when the citizens who asked for it say so.**

*Built for Google Cloud **Build with AI: Code for Communities** (India).*

<a href="https://github.com/Monolithic-Dev/Pramaan/actions/workflows/ci.yml"><img src="https://github.com/Monolithic-Dev/Pramaan/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
<img src="https://img.shields.io/badge/tests-328%20passing-2ea44f?logo=vitest&logoColor=white" alt="328 tests passing" />
<img src="https://img.shields.io/badge/end--to--end-69%2F69%20with%20real%20Gemini-2ea44f?logo=googlegemini&logoColor=white" alt="69 of 69 end-to-end checks" />
<img src="https://img.shields.io/badge/languages-11-FF9933" alt="11 languages" />
<img src="https://img.shields.io/badge/states%20%26%20UTs-36-138808" alt="36 states and UTs" />
<img src="https://img.shields.io/badge/runs%20on-free%20tiers-0B1A3C" alt="Runs on free tiers" />

<br/><br/>

**AI and cloud**

<img src="https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Google Gemini" />
<img src="https://img.shields.io/badge/Google%20Cloud-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white" alt="Google Cloud" />
<img src="https://img.shields.io/badge/Firebase-DD2C00?style=for-the-badge&logo=firebase&logoColor=white" alt="Firebase" />
<img src="https://img.shields.io/badge/Cloud%20Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white" alt="Cloud Run" />
<img src="https://img.shields.io/badge/BigQuery-669DF6?style=for-the-badge&logo=googlebigquery&logoColor=white" alt="BigQuery" />
<img src="https://img.shields.io/badge/Render-000000?style=for-the-badge&logo=render&logoColor=white" alt="Render" />

**Application**

<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/React%2019-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" />
<img src="https://img.shields.io/badge/Tailwind%20CSS%204-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8" alt="Tailwind CSS 4" />
<img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
<img src="https://img.shields.io/badge/Node.js%2020-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 20" />
<img src="https://img.shields.io/badge/Fastify%205-000000?style=for-the-badge&logo=fastify&logoColor=white" alt="Fastify 5" />
<img src="https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white" alt="Zod" />
<img src="https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet" />

**Engineering**

<img src="https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white" alt="pnpm" />
<img src="https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white" alt="Turborepo" />
<img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
<img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />
<img src="https://img.shields.io/badge/GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="GitHub Actions" />
<img src="https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="Installable PWA" />

<br/><br/>

**[▶ Live demo](#-live-demo-and-video)** · **[🎬 Demo video](#-live-demo-and-video)** · **[📸 Screenshots](#-a-tour-of-the-product)** · **[🏗 Architecture](#-architecture)** · **[🚀 Run it locally](#-run-it-locally-in-10-minutes)**

</div>

---

## 📊 At a glance

<table>
<tr>
<td align="center" width="25%"><h2>🗣️ 11</h2><b>languages</b><br/><sub>10 Indian + Portuguese, by voice, text or photo</sub></td>
<td align="center" width="25%"><h2>📥 5</h2><b>intake channels</b><br/><sub>web, offline app, voice, WhatsApp, SMS</sub></td>
<td align="center" width="25%"><h2>✨ 7</h2><b>Gemini jobs</b><br/><sub>classify, translate, see, hear, embed, advise, brief</sub></td>
<td align="center" width="25%"><h2>🗺️ 36</h2><b>states and UTs</b><br/><sub>plus Brazil, on the same code</sub></td>
</tr>
<tr>
<td align="center"><h2>🔁 1</h2><b>closed loop</b><br/><sub>report → rank → fund → fix → citizens confirm</sub></td>
<td align="center"><h2>📈 +60%</h2><b>people reached</b><br/><sub>budget optimiser vs funding by report volume</sub></td>
<td align="center"><h2>🧪 328</h2><b>tests</b><br/><sub>plus 69 end-to-end checks on real Gemini</sub></td>
<td align="center"><h2>₹0</h2><b>to run a pilot</b><br/><sub>Firebase Spark, Render, Gemini API key</sub></td>
</tr>
</table>

---

## Contents

1. [At a glance](#-at-a-glance)
2. [The problem](#-the-problem)
3. [What Pramaan does](#-what-pramaan-does)
4. [Live demo and video](#-live-demo-and-video)
5. [How it maps to the judging criteria](#-how-it-maps-to-the-judging-criteria)
6. [A tour of the product](#-a-tour-of-the-product) (screenshots)
7. [Architecture](#-architecture)
8. [The AI: where Gemini does the work](#-the-ai-where-gemini-does-the-work)
9. [How a score is built](#-how-a-score-is-built)
10. [Roles and access control](#-roles-and-access-control)
11. [Tech stack](#-tech-stack)
12. [Repository layout](#-repository-layout)
13. [API overview](#-api-overview)
14. [Security, privacy and trust](#-security-privacy-and-trust)
15. [Quality: how we know it works](#-quality-how-we-know-it-works)
16. [Run it locally in 10 minutes](#-run-it-locally-in-10-minutes)
17. [Deploy](#-deploy)
18. [5-minute demo script](#-5-minute-demo-script)
19. [Roadmap](#-roadmap)
20. [Data honesty](#-data-honesty)
21. [Team](#-team)

---

## 🧭 The problem

> *Governments across India struggle to consolidate citizen feedback and align it with national infrastructure priorities. Development requests live in fragmented systems, leading to misaligned public spending, unaddressed infrastructure gaps, and no way to measure the impact of large-scale digital public infrastructure initiatives.* (hackathon problem statement)

In practice, that looks like this:

| Gap | What happens today |
|---|---|
| **Fragmented** | The same broken culvert is reported ten times, in five languages, across a helpline, WhatsApp groups, a portal and a ward meeting. Nobody can say how many people are really affected. |
| **Misaligned** | Budgets follow habit or whoever shouts loudest. Nobody checks whether the most vulnerable areas actually get served, or which national scheme could have paid for the work. |
| **Unmeasured** | A project is "completed" on paper. Nobody asks the people who reported it whether anything actually changed. |

## 💡 What Pramaan does

Pramaan closes the loop from **a citizen's words** to **a funded fix the citizens confirm**:

```
 Speak / type / snap  →  AI understands & merges  →  Scored in the open  →  Matched to a national scheme
        ↑                                                                               ↓
 Citizens confirm the fix  ←  Tracked to completion  ←  Budget optimised with an equity floor
```

Three audiences, one platform:

| | Who | What they get |
|---|---|---|
| 🧑‍🤝‍🧑 | **Citizens** | Report in **11 languages** by voice, text or photo (web, installable offline app, WhatsApp, SMS). **Snap a photo and Gemini writes the report** in your language, flagging safety hazards. From a basic phone, text **`STATUS <code>`** to hear where your report stands. An *"is this already reported nearby?"* check before filing. A **tracking code** to follow the report with no account. Notifications. A **"was it really fixed?"** vote, which reopens the work if the majority says no. |
| 🏛️ | **Officers** (3 roles, jurisdiction-scoped) | Ranked, explainable priorities; a live map; **my queue** with SLA clocks and **automatic escalation**; assignment and internal notes; a **budget optimiser** with an equity floor; a **national scheme matcher**; a **need-vs-spend map** that finds districts where need is high and investment is low; a **scheme impact ledger** (which central programmes actually deliver, and do citizens agree); a **grounded AI policy co-pilot**; early-warning forecasts; an equity audit; an impact ledger; a **printable AI weekly briefing**. |
| 🌐 | **The public** | **Follow the money**: is investment reaching the districts that need it, and which schemes deliver. **District scorecards** graded A to E by a published formula; an impact ledger; a **live WhatsApp/SMS simulator**; **open data** (CSV + a try-it API); an architecture page. Aggregates only, k-anonymous, no login. |

---

## 🎥 Live demo and video

| | Link |
|---|---|
| **Live app** | `https://<add-live-url-here>` |
| **Demo video (3–5 min)** | `https://<add-video-link-here>` |
| **Pitch deck** | `https://<add-deck-link-here>` |

**Demo logins** (seeded by `scripts/seed-demo-data/seedDemoData.ts`):

| Role | Email | Password | Sees |
|---|---|---|---|
| National administrator | `national@pramaan.demo` | `DemoAdmin!2026` | All of India |
| State administrator | `admin@pramaan.demo` | `DemoAdmin!2026` | Delhi |
| District collector | `collector@pramaan.demo` | `DemoAdmin!2026` | Central Delhi |
| Field officer | `field@pramaan.demo` | `DemoAdmin!2026` | Central Delhi (read + notes) |
| State administrator (Brazil) | `brasil@pramaan.demo` | `DemoAdmin!2026` | São Paulo |
| Citizen | `citizen@pramaan.demo` | `DemoCitizen!2026` | Their own reports |

Tracking code to try on `/track`, no login needed: **`PR-K7M3P9QD`**.

---

## 🏆 How it maps to the judging criteria

| Criterion | Weight | Where Pramaan delivers it |
|---|---|---|
| **Problem–Solution Fit** | 20% | Every part of the problem statement has a feature: *fragmented* → multilingual, multichannel ingestion with **AI deduplication** (8 reports in Hindi and English collapse into one issue); *misaligned spending* → **explainable scoring**, a **budget optimiser** that reached **60% more people** than funding by report volume on the demo data, a **national scheme matcher**, and a **need-vs-spend map** that measures the misalignment directly (on the demo data, need and investment correlate at just **r = 0.02**, and 8 districts with 2.4 crore people are underserved); *unmeasured impact* → **citizen-confirmed resolution**, an **impact ledger** and **public scorecards**. |
| **AI / Technical Execution** | 25% | Gemini classifies, translates, reads photos, transcribes voice and writes **grounded** briefs. **Gemini Vision turns a photo into a drafted report** (category, severity, safety hazard) in the citizen's language. Embeddings drive cross-language deduplication. The co-pilot uses **function calling over 8 real tools** with a 3-layer guardrail: numbers it cannot trace are removed and unanswerable questions are refused. A **model-fallback pool** keeps AI features alive when a model hangs or overloads. Exact **0/1-knapsack** optimisation with an equity reserve. **328 unit and route tests** plus a **69-check end-to-end run against real Gemini**. |
| **Depth & Reach across India** | 20% | **11 languages** (10 Indian + Portuguese) across UI, voice and reports; **36 states and UTs** in the reference geography; web, installable **offline PWA**, **voice**, **WhatsApp** and **SMS** intake, with **status by SMS** (`STATUS <code>`, also in Hindi, Tamil, Bengali and more) so a feature phone gets the whole loop; screen-reader and keyboard accessible; works on a phone. **Brazil runs on the same codebase** as proof it travels. |
| **Impact Potential** | 15% | Connects demand to real central schemes (PMGSY, JJM, AMRUT 2.0, SBM, NHM, Samagra Shiksha, RDSS, MPLADS, 15th FC grants...) with the centre/state split. Measures **people benefited**, **days to resolve**, **cost per person** and **citizen confirmation rate**, overall and **per scheme** in a public **scheme impact ledger** that flags programmes that are slow or whose fixes citizens reject. An **equity audit** checks that vulnerable areas are really served. **Graded escalation** (collector, then state admin) stops issues rotting. |
| **Deployability & Scalability** | 20% | Runs **entirely on free tiers** (Firebase Spark, Render, Gemini API key) via a one-file **Render blueprint**, or on **Cloud Run + BigQuery** for scale, from the same code. Stateless services, idempotent ingestion, a scheduled sweep/score/escalate job, read caching that keeps a demo inside the free Firestore quota, security headers, request ids, rate limits. **Adding a state is a form; adding a country is a config document.** Runs locally with **no cloud account** on the Firebase emulators. |

---

## 📸 A tour of the product

> All data in the screenshots is **illustrative sample data**: ~430 issues and ~1,850 citizen reports in 10 languages, scored by the real scoring engine. It is labelled on screen.
>
> 📌 *Screenshots live in [`docs/screenshots/`](docs/screenshots). Replace or add your own freely; the empty slots below are ready for them.*

### For citizens

| Landing page: India lights up where reports come from | Report in 11 languages by voice, text or photo |
|---|---|
| ![Landing](docs/screenshots/01-landing.png) | ![Report wizard](docs/screenshots/02-report-wizard.png) |

| Follow a report with just a code, no account | Community map: "I'm affected too" instead of a duplicate |
|---|---|
| ![Track by code](docs/screenshots/03-track-by-code.png) | ![Community](docs/screenshots/04-community-map.png) |

| My reports: every report's journey to "fixed" | Notifications in the citizen's language |
|---|---|
| ![My reports](docs/screenshots/40-citizen-my-reports.png) | ![Notifications](docs/screenshots/41-citizen-notifications.png) |

| **Snap a photo, Gemini writes the report**: category, severity, safety hazard, in your language | **Live WhatsApp/SMS phone**: a real report and a `STATUS` reply, through the real pipeline |
|---|---|
| ![AI photo assist](docs/screenshots/12-ai-photo-assist.png) | ![Channels](docs/screenshots/08-whatsapp-sms.png) |

| Profile, language and privacy (export or erase my data) | Works on a phone |
|---|---|
| ![Profile](docs/screenshots/42-citizen-profile.png) | <img src="docs/screenshots/51-mobile-report.png" width="300" alt="Mobile report" /> |

<!-- 📷 SCREENSHOT SLOT: voice recording in progress (e.g. Hindi) -->

### For officers

| Overview: KPIs, trend, hotspots, live activity, funding within reach | My queue: assigned, overdue, emergencies, unassigned |
|---|---|
| ![Overview](docs/screenshots/20-console-overview.png) | ![Queue](docs/screenshots/21-my-queue.png) |

| Issue detail: what Gemini did, original + translated reports, score, scheme, assignment | Priorities: ranked, explainable, filterable |
|---|---|
| ![Issue detail](docs/screenshots/31-issue-detail.png) | ![Priorities](docs/screenshots/22-priorities.png) |

| **Budget optimiser**: +60% people reached vs funding by report volume, with an equity reserve | **Weights lab**: see the ranking move as policy weights change |
|---|---|
| ![Planner](docs/screenshots/24-budget-planner.png) | ![Weights lab](docs/screenshots/24c-weights-lab.png) |

| **Need vs spend**: is money following need? Underserved districts, in one chart | **National schemes + scheme impact ledger**: what central programmes could fund, and which ones deliver |
|---|---|
| ![Need vs spend](docs/screenshots/35-need-vs-spend.png) | ![Schemes](docs/screenshots/25-national-schemes.png) |

| Map with forecast overlays | |
|---|---|
| ![Map](docs/screenshots/23-console-map.png) | |

| Impact ledger: people benefited, days to fix, cost per person, citizen confirmation | **AI weekly briefing**: every figure computed, fact-checked, printable, in 11 languages |
|---|---|
| ![Impact](docs/screenshots/26-impact-ledger.png) | ![Briefing](docs/screenshots/27-weekly-briefing.png) |

| Grounded policy co-pilot (Gemini function calling) | Early-warning forecasts |
|---|---|
| ![Co-pilot](docs/screenshots/29-copilot.png) | ![Forecasts](docs/screenshots/28-forecasts.png) |

| Equity audit: are vulnerable areas really served? | Projects from recommended to citizen-confirmed |
|---|---|
| ![Equity](docs/screenshots/32-equity-audit.png) | ![Projects](docs/screenshots/30-projects.png) |

| Team and access: create officers, see what each role can do | Audit log: every officer action, who and why |
|---|---|
| ![Team](docs/screenshots/33-team-and-access.png) | ![Audit](docs/screenshots/34-audit-log.png) |

| The console on a phone | Officer sign-in |
|---|---|
| <img src="docs/screenshots/52-mobile-console.png" width="300" alt="Mobile console" /> | ![Login](docs/screenshots/10-login.png) |

<!-- 📷 SCREENSHOT SLOT: co-pilot answering a question with citations -->
<!-- 📷 SCREENSHOT SLOT: approving a budget plan -->

### For the public

| District scorecards, graded A–E by a published formula | Public ledger: aggregates only, k-anonymous |
|---|---|
| ![Scorecards](docs/screenshots/05-district-scorecards.png) | ![Ledger](docs/screenshots/06-public-ledger.png) |

| **Follow the money**: need vs spend and the scheme ledger, for anyone | Open data and a try-it API |
|---|---|
| ![Follow the money](docs/screenshots/11-follow-the-money.png) | ![Open data](docs/screenshots/07-open-data-api.png) |

| How it works, for anyone to inspect | |
|---|---|
| ![About](docs/screenshots/09-architecture-page.png) | <!-- 📷 SCREENSHOT SLOT --> |

---

## 🏗 Architecture

### System overview

```mermaid
flowchart LR
    subgraph Channels["📥 Citizen channels"]
        WEB["Web / installable PWA<br/>(offline queue)"]
        VOICE["Voice notes<br/>(any language)"]
        WA["WhatsApp webhook"]
        SMS["SMS webhook"]
    end

    subgraph Gateway["🛡️ API gateway · Fastify"]
        AUTH["Auth + RBAC<br/>Firebase ID tokens,<br/>role & jurisdiction claims"]
        INGEST["Idempotent ingest<br/>rate limits · PII scrub<br/>tracking codes"]
        CONSOLE["Console APIs<br/>workflow · SLA · notes"]
        PLAN["Planner<br/>knapsack + equity floor<br/>scheme matcher"]
        AGENT["Policy co-pilot<br/>Gemini function calling<br/>3-layer guardrail"]
        PUBLIC["Public APIs<br/>scorecards · open data<br/>track by code"]
        JOBS["Jobs<br/>escalation"]
    end

    subgraph Worker["🧠 AI worker · Fastify"]
        UNDERSTAND["Understand<br/>classify · translate<br/>vision · speech-to-text"]
        DEDUP["Deduplicate<br/>embeddings + geohash"]
        SCORE["Score<br/>demand · vulnerability · gap"]
    end

    subgraph Data["🗄️ Data"]
        FS[("Firestore<br/>issues · reports · projects<br/>notifications · audit log")]
        REF[("Reference data<br/>36 states/UTs · indices<br/>investments")]
        FBAUTH[("Firebase Auth")]
    end

    GEMINI(["✨ Gemini API<br/>text · vision · audio<br/>embeddings"])

    subgraph Apps["🖥️ React 19 web app"]
        CIT["Citizen portal"]
        OFF["Officer console"]
        PUB["Public site"]
    end

    SCHED(["⏱️ Scheduler<br/>GitHub Actions / Cloud Scheduler<br/>every 15 min"])

    WEB & VOICE --> INGEST
    WA & SMS --> INGEST
    INGEST -->|"hand-off"| UNDERSTAND
    UNDERSTAND --> DEDUP --> SCORE
    UNDERSTAND & DEDUP & AGENT --> GEMINI
    SCORE --> FS
    INGEST & CONSOLE & PLAN & PUBLIC & JOBS --> FS
    SCORE & PLAN & AGENT --> REF
    AUTH --> FBAUTH
    CIT & OFF & PUB --> Gateway
    SCHED -->|"sweep · score"| Worker
    SCHED -->|"escalate"| JOBS
```

### The closed loop: from a report to a confirmed fix

```mermaid
sequenceDiagram
    autonumber
    actor C as Citizen (any language)
    participant G as API gateway
    participant W as AI worker
    participant AI as Gemini
    participant O as Officer
    participant DB as Firestore

    C->>G: Report (voice / text / photo + location)
    G->>DB: Store report, consent, tracking code
    G-->>C: 202 + tracking code (PR-XXXXXXXX)
    G->>W: Hand-off
    W->>AI: Classify, translate, read photo, transcribe
    W->>AI: Embed the summary
    W->>DB: Merge with a matching nearby issue, or create one
    W->>DB: Score (demand × vulnerability × gap)
    O->>G: Verify · assign · note (audited)
    G-->>C: Notification: "verified"
    O->>G: Match scheme · optimise budget · approve plan
    G-->>C: Notification: "funded"
    O->>G: Mark work complete
    G-->>C: "Was it really fixed?"
    C->>G: Yes / No (signed in, or just the code)
    alt Majority "not fixed"
        G->>DB: Reopen the work, alert the officer
    else Enough "fixed" + officer sign-off
        G->>DB: Resolve the issue, record impact
        G-->>C: Notification: "resolved"
    end
```

### Deployment topology

```mermaid
flowchart TB
    subgraph Free["Free stack (no GCP billing)"]
        R1["Render · static site<br/>apps/web"]
        R2["Render · web service<br/>api-gateway"]
        R3["Render · web service<br/>worker-ai-pipeline"]
        GA["GitHub Actions cron<br/>sweep · score · escalate"]
        FB["Firebase Spark<br/>Firestore + Auth"]
        GK["Gemini API key"]
    end
    subgraph Scale["Scale path (same code)"]
        CR["Cloud Run<br/>gateway + worker"]
        PS["Pub/Sub"]
        BQ["BigQuery<br/>reference data"]
        VX["Vertex AI"]
        CS["Cloud Scheduler"]
    end
    R1 --> R2 --> R3
    R2 & R3 --> FB
    R2 & R3 --> GK
    GA --> R2 & R3
    CR --> PS
    CR --> BQ
    CR --> VX
    CS --> CR
```

The switch between the two is configuration: `WORKER_URL` vs Pub/Sub, `REFERENCE_BACKEND=bigquery` vs Firestore, `GEMINI_API_KEY` vs Vertex AI with application default credentials.

### The life of an issue

Every status change is made on the server, written to the audit log, and sent to the people who reported it, in their language. Only citizens plus an officer's sign-off can close an issue; a "not fixed" majority sends it back.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> open: 🧠 AI merges reports<br/>into an issue
    open --> verified: ✅ collector verifies
    open --> disputed: ⚠️ collector disputes
    disputed --> verified: re-checked
    verified --> prioritized: 📋 project recommended<br/>(grounded brief)
    open --> prioritized: 📋 project recommended
    prioritized --> funded: 💰 plan approved<br/>scheme matched
    funded --> in_progress: 🏗️ work starts
    in_progress --> awaiting: officer marks complete
    state "🗳️ Citizens asked: was it fixed?" as awaiting
    awaiting --> in_progress: majority "not fixed"<br/>(reopened, officer alerted)
    awaiting --> resolved: enough "fixed"<br/>+ officer sign-off
    resolved --> [*]: 📊 impact recorded<br/>(people, days, cost, efficacy)

    note right of open
        ⏱️ SLA clock by priority:
        emergency 2d · high 7d · medium 21d · low 45d
        missed → district collector
        missed again → state admin
    end note
```

### Data model

The core of the Firestore data model (full reference: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)). Many **submissions** (what citizens said) merge into one **issue** (the problem in the world); an issue is scored, may become a **project**, and a finished project gets an **impact record** that citizens confirm.

```mermaid
erDiagram
    CITIZEN ||--o{ SUBMISSION : files
    SUBMISSION }o--|| ISSUE : "merged into"
    ISSUE ||--o{ PRIORITY_SCORE : "scored as"
    ISSUE ||--o| PROJECT : "funded as"
    PROJECT ||--o| IMPACT_RECORD : "confirmed by citizens"
    PROJECT }o--o| SCHEME : "paid by"
    ADMIN_REGION ||--o{ ISSUE : contains
    ADMIN_REGION ||--o{ ADMIN_REGION : "parent of"
    ADMIN_REGION ||--o{ INVESTMENT_RECORD : "received"
    OFFICER }o--|| ADMIN_REGION : "has jurisdiction over"
    OFFICER ||--o{ AUDIT_ENTRY : "acts, logged in"
    ISSUE ||--o{ NOTIFICATION : "status sent as"

    CITIZEN {
        string citizen_id PK
        string phone_hash "one-way hash, never the number"
        string preferred_language "e.g. ta-IN"
    }
    SUBMISSION {
        string submission_id PK
        string idempotency_key "no double filing"
        string channel "web, voice, whatsapp, sms"
        string pii_scrubbed_text "what the AI sees"
        string tracking_code "PR-XXXXXXXX"
        string issue_id FK
    }
    ISSUE {
        string issue_id PK
        string category
        string admin_region_id FK
        int distinct_reporter_count "feeds demand"
        string status
        float composite_score
        string sla_due_at
    }
    PRIORITY_SCORE {
        float demand_score
        float vulnerability_score
        float gap_score
        float duplication_penalty
        float impact_efficacy
        float composite_score
    }
    PROJECT {
        string project_id PK
        string generated_brief "grounded, cited"
        string status
        int budget_estimate_inr
        string scheme_id FK
    }
    IMPACT_RECORD {
        int confirmations_received
        int confirmations_required
        int confirmations_negative
        int reopened_count
        float efficacy
    }
```

### Monorepo map

One typed contract (`shared-types`) is used by all three apps, so the web app, the gateway and the worker cannot disagree about what an issue is.

```mermaid
flowchart LR
    subgraph apps["📦 apps"]
        WEBAPP["🖥️ web<br/>React 19 · Vite · Tailwind"]
        GW["🛡️ api-gateway<br/>Fastify · 63 routes"]
        WK["🧠 worker-ai-pipeline<br/>Fastify · understand → dedup → score"]
    end
    subgraph packages["🧩 packages"]
        ST["shared-types<br/>the data contract"]
        SU["shared-utils<br/>scoring · geohash · PII scrub<br/>Gemini model pool"]
        AP["ai-prompts<br/>versioned prompts + schemas"]
    end
    subgraph tooling["🛠️ scripts · CI"]
        SEED["seed-demo-data<br/>36 states/UTs + Brazil"]
        SMOKE["smoke-emulator<br/>69 end-to-end checks"]
        I18N["translate-i18n<br/>11 languages"]
        GHA["GitHub Actions<br/>CI + 15-min jobs"]
    end
    WEBAPP --> ST
    GW --> ST & SU & AP
    WK --> ST & SU & AP
    SEED --> ST
    SMOKE -. drives .-> GW & WK
    GHA -. calls .-> GW & WK
```

---

## ✨ The AI: where Gemini does the work

### The pipeline, step by step

What happens to a single report between "Submit" and a ranked issue on an officer's screen. Every AI step has a fallback, so **a report is never dropped** because a model misbehaved.

```mermaid
flowchart TD
    IN(["📥 Report arrives<br/>web · voice · WhatsApp · SMS"]) --> GATE
    subgraph GATE["🛡️ Gateway"]
        direction LR
        G1["Idempotency key<br/>no double filing"] --> G2["Rate limits<br/>burst + geofence checks"] --> G3["🔒 PII scrubbed<br/>before any AI call"] --> G4["🎫 Tracking code<br/>PR-XXXXXXXX"]
    end
    GATE -->|hand-off| AUDIO{"Voice only?"}
    AUDIO -->|yes| STT["🎙️ Gemini transcribes<br/>in the speaker's language"]
    AUDIO -->|no| PHOTO
    STT --> PHOTO{"Photo attached?"}
    PHOTO -->|yes| VIS["👁️ Gemini Vision<br/>is it a real infrastructure problem?"]
    PHOTO -->|no| CLS
    VIS -->|"no problem visible"| SOFT["🚩 soft fraud flag<br/>reviewed, never auto-rejected"]
    VIS --> CLS
    SOFT --> CLS
    CLS["🏷️ Gemini classifies<br/>category · severity · summary<br/>language + translation"] -->|"malformed twice"| RAW["raw-text fallback<br/>still becomes an issue"]
    CLS -->|"personal emergency"| ROUTE["🚑 routed out<br/>never ranked"]
    CLS --> LOC
    RAW --> LOC["📍 Resolve location<br/>geohash → district → state"]
    LOC --> EMB["🧬 gemini-embedding-001<br/>embed the summary"]
    EMB --> MATCH{"Similar issue nearby?<br/>cosine ≥ 0.72, same area"}
    MATCH -->|yes| MERGE["🔗 Merge<br/>+1 distinct reporter"]
    MATCH -->|no| NEW["🆕 New issue"]
    MERGE & NEW --> SC["📐 Score<br/>demand × vulnerability × gap"]
    SC --> OUT(["🗂️ Ranked, explained issue<br/>on the officer console"])

    classDef ai fill:#8E75B2,stroke:#5b4a7a,color:#fff
    classDef guard fill:#0B1A3C,stroke:#0B1A3C,color:#fff
    classDef warn fill:#FFEED6,stroke:#E8800F,color:#7a3e00
    class STT,VIS,CLS,EMB ai
    class G1,G2,G3,G4 guard
    class SOFT,RAW,ROUTE warn
```

### The co-pilot's three-layer guardrail

The policy co-pilot answers questions like *"top 3 unaddressed road issues in my district, and are they funded?"* using Gemini **function calling** over real data. It is built so it cannot invent a number.

```mermaid
flowchart LR
    Q(["💬 Officer's question<br/>any of 11 languages"]) --> L1
    subgraph L1["Layer 1 · scope"]
        T["🔧 8 tools, pinned to the<br/>officer's jurisdiction"]
    end
    L1 --> GEM["✨ Gemini plans<br/>and calls tools<br/>(≤ 5 rounds)"]
    GEM <--> T
    GEM --> DRAFT["📝 Draft answer"]
    DRAFT --> L2
    subgraph L2["Layer 2 · verify"]
        V{"Every number<br/>found in a<br/>tool result?"}
    end
    V -->|yes| OK(["✅ Answer with citations<br/>streamed to the officer"])
    V -->|no| REGEN["🔁 Regenerate once<br/>with the evidence"]
    REGEN -->|"now verified"| OK
    REGEN -->|"still untraceable"| L3
    subgraph L3["Layer 3 · strip or refuse"]
        S["✂️ Drop sentences with<br/>untraceable figures"]
        R["🙅 Refuse if nothing<br/>verifiable is left"]
    end
    S --> OK
    R --> AUD[("🗒️ Audit: unverified<br/>claims recorded")]
```

### What each stage does

| Stage | What Gemini does | Guardrail |
|---|---|---|
| **Understand** | Classifies the report (category, sub-category, severity), writes an English summary, detects the language and translates non-English reports for officers. | Structured-output schema with a stricter retry; if the model still fails, a raw-text fallback, so **a report is never dropped**. A citizen's personal emergency is routed out, not ranked. |
| **See and hear** | Reads photos (does it show a real infrastructure problem?) and transcribes voice notes in the speaker's language. | A photo that doesn't match is flagged for review, never auto-rejected. |
| **Photo to report** | While the citizen is still filling the form, Gemini Vision looks at their photo and drafts the description in their language, with category, severity and whether it is a safety hazard. | Only photos the app itself stored can be read; the draft only fills an empty box and the citizen can edit it; if the model is unavailable, the citizen simply types. |
| **Deduplicate** | `gemini-embedding-001` embeds each summary; reports within the same area whose embeddings are similar (cosine ≥ 0.72, tuned on real Hindi/English pairs) merge into one issue. | Distinct *reporters* feed demand, not raw reports, so one person filing twelve times is one unit of demand. |
| **Co-pilot** | Answers officers' questions with **function calling** over 8 tools: `query_fused_data`, `check_investment_status`, `get_priority_scores`, `simulate_priority`, `generate_brief`, `list_available_data`, `get_risk_forecasts`, `get_equity_audit`. | Three layers: tools only see the officer's jurisdiction; every number in the answer must appear in a tool result; any sentence with an untraceable number is dropped, and unanswerable questions are refused. |
| **Briefs** | Project briefs and the **weekly briefing** in 11 languages. | Every figure is computed first. The model only rephrases, and the same numeric check removes any invented figure. If the model is down, a template briefing is served instead. |
| **Resilience** | A **model pool** tries a chain of Gemini models, skips ones that are hanging or overloaded, and leads with whichever answered last. | Per-call timeouts and overall deadlines, so a slow model never freezes a citizen or an officer. |

## 📐 How a score is built

```
priority = (0.40 × demand + 0.30 × vulnerability + 0.30 × gap) × duplication × efficacy
```

```mermaid
flowchart LR
    subgraph IN["Inputs"]
        D["🧑‍🤝‍🧑 demand<br/>distinct reporters,<br/>log-scaled to the p95"]
        V["🏚️ vulnerability<br/>literacy · water · health<br/>poverty · roads"]
        G["⏳ gap<br/>years since the last<br/>investment here"]
    end
    D -->|"× 0.40"| B(("base<br/>score"))
    V -->|"× 0.30"| B
    G -->|"× 0.30"| B
    B --> DUP["× duplication<br/>money sanctioned<br/>in the last 2 FYs?"]
    DUP --> EFF["× efficacy<br/>did past fixes here<br/>satisfy citizens?"]
    EFF --> P(["🎯 priority<br/>with a full, public<br/>breakdown"])
    P --> KN["🎒 0/1 knapsack<br/>value = score × reach<br/>cost = budget estimate"]
    KN --> EQ["⚖️ equity reserve<br/>spent first on<br/>vulnerable areas"]
    EQ --> PLAN(["📋 Budget plan<br/>+60% people reached"])
```

| Component | Meaning | Source |
|---|---|---|
| **demand** | How many *distinct* people reported it, relative to the country's 95th percentile (log-scaled) | Merged reports |
| **vulnerability** | How under-served the area is (literacy, water access, health facilities, poverty, roads), walked up the region tree if a district has no data | Reference indices |
| **gap** | Years since the last relevant investment in that category and region | Investment records |
| **duplication** | Penalty if money for this was sanctioned in the last two fiscal years | Investment records |
| **efficacy** | How well past fixes of this kind worked here, as confirmed by citizens | Impact records |

Every issue shows its full breakdown, the weights, and any data it had to substitute. Weights are configurable per deployment, and the **weights lab** lets a policymaker see how the ranking would change, without touching the official scores.

**Budget optimiser.** Each eligible issue is worth `score × reach`, and costs its indicative budget. An **exact 0/1 knapsack** picks the set with the highest total value that fits the budget, with a guaranteed reserve spent first on high-vulnerability areas. It is shown next to the obvious alternative, funding by report volume. On the demo data at ₹1 Cr it reaches **28.7 lakh people vs 17.9 lakh (+60%)**, with more of the money going to vulnerable areas.

**Need vs spend.** Every district gets a *need* rank (half official deprivation indices, half distinct people with unresolved reports per 100,000 residents) and a *spend* rank (investment per person over the last four fiscal years), both as percentiles within the country. High need with low spend is **underserved**. The correlation between the two says, in one number, whether money follows need. Publicly, report counts are withheld for districts with fewer than 5 open issues.

**Scheme impact ledger.** Every project records the national scheme paying for it (the best match automatically; a collector can correct it, audited). Per scheme: money committed and the central share, projects delivered, days to fix, cost per person reached, and the share of reporters who confirmed the fix. A scheme is flagged **slow** above 90 days, or with **quality concerns** below 70% citizen confirmation.

**Deadlines.** Open issues get a response deadline by priority (emergency 2 days, high 7, medium 21, low 45). A missed deadline escalates to the **district collector**; missing it by a further full window escalates to the **state administrator** (the CPGRAMS pattern).

---

## 🔐 Roles and access control

Enforced **on the server, on every request**. The web app only hides what you couldn't use anyway.

| Capability | Citizen | Field officer | District collector | State / national admin |
|---|:-:|:-:|:-:|:-:|
| Report, track, confirm fixes, export or erase own data | ✅ | | | |
| View the console for their jurisdiction | | ✅ | ✅ | ✅ |
| Internal notes | | ✅ | ✅ | ✅ |
| Verify / dispute, emergency override, assign | | | ✅ | ✅ |
| Recommend and run projects, plan and approve budgets | | | ✅ | ✅ |
| Equity audit, officer accounts, states, audit log | | | | ✅ |

Jurisdiction is a **region tree** (country → state → district). An officer can only see or act on issues at or below their region. A Pune collector gets `403 JURISDICTION_MISMATCH` on a Delhi issue, and the co-pilot's tools are pinned to the same scope.

---

## 🧰 Tech stack

| Layer | Technology | Why |
|---|---|---|
| <img src="https://cdn.simpleicons.org/react" width="16" height="16" alt="" /> **Frontend** | React 19, React Router 7, Vite 8, Tailwind CSS 4 | Fast, typed, code-split per area (a citizen never downloads the officer console) |
| <img src="https://cdn.simpleicons.org/leaflet" width="16" height="16" alt="" /> **Maps** | Leaflet + OpenStreetMap | Free, no API key, works everywhere |
| 📊 **Charts, icons** | Hand-built SVG components | Zero chart dependencies; accessible and printable |
| <img src="https://cdn.simpleicons.org/pwa" width="16" height="16" alt="" /> **Offline** | Service worker + offline queue (reports, photos and voice notes upload when the connection returns) | Rural connectivity |
| 🗣️ **i18n** | 11 languages loaded on demand; Noto Indic fonts, non-blocking | Reach without bloat |
| <img src="https://cdn.simpleicons.org/fastify/000000" width="16" height="16" alt="" /> **Backend** | Node 20, Fastify 5, Zod | Two stateless services: `api-gateway` and `worker-ai-pipeline` |
| <img src="https://cdn.simpleicons.org/googlegemini" width="16" height="16" alt="" /> **AI** | Gemini (`@google/genai`): text, vision, audio, function calling; `gemini-embedding-001` | One API for every AI task; Vertex AI on Cloud Run |
| <img src="https://cdn.simpleicons.org/firebase" width="16" height="16" alt="" /> **Data** | Firestore (+ BigQuery option for reference data) | Serverless, free tier, scales |
| 🔐 **Auth** | Firebase Authentication with custom claims (`role`, `region_id`, `country_code`) | Email, phone OTP; claims drive RBAC |
| <img src="https://cdn.simpleicons.org/turborepo" width="16" height="16" alt="" /> **Monorepo** | pnpm workspaces + Turborepo; shared `shared-types`, `shared-utils`, `ai-prompts` packages | One contract across apps |
| <img src="https://cdn.simpleicons.org/vitest" width="16" height="16" alt="" /> **Testing** | Vitest + Testing Library; Playwright for UI tours; an end-to-end smoke test on the Firebase emulators | Fast unit tests plus a real-stack proof |
| <img src="https://cdn.simpleicons.org/render/000000" width="16" height="16" alt="" /> **Hosting** | Render (free blueprint) or Cloud Run; GitHub Actions for CI and scheduled jobs | Free to pilot, clear path to scale |
| 💻 **Local dev** | Firebase emulators (Firestore + Auth) | Runs with **no cloud account** |

---

## 📁 Repository layout

```
.
├── apps/
│   ├── web/                    React app: public site, citizen portal, officer console (30 pages)
│   │   └── src/{pages,components,ui,i18n,api,auth,hooks}
│   ├── api-gateway/            Fastify: auth/RBAC, ingest, console, planner, schemes, co-pilot, public, jobs
│   │   └── src/{routes,services,agent,insights,store,lib,data}
│   └── worker-ai-pipeline/     Fastify: understand → deduplicate → score
├── packages/
│   ├── shared-types/           The data contract (Issue, Submission, Project, ImpactRecord, CountryProfile...)
│   ├── shared-utils/           Scoring maths, geohash, PII scrubbing, model fallback pool
│   └── ai-prompts/             Versioned prompts and response schemas
├── scripts/
│   ├── seed-demo-data/         Reference geography (36 states/UTs + Brazil), multilingual demo dataset
│   ├── smoke-emulator.ts       69-check end-to-end test against the real worker and Gemini
│   ├── translate-i18n.ts       Gemini translation of UI strings, placeholder-safe
│   └── create-officer.ts       Officer account tooling
├── docs/                       PRD, architecture, data model, AI pipeline, API spec, security, deployment
├── infra/gcp/                  Cloud Run / Cloud Build setup
├── render.yaml                 One-click free deployment blueprint
└── .github/workflows/          CI (typecheck, test, build) and the 15-minute scheduled jobs
```

## 🔌 API overview

63 gateway routes under `/v1` (full spec: [`docs/API_SPEC.md`](docs/API_SPEC.md)). Highlights:

| Area | Examples |
|---|---|
| **Ingest** | `POST /submissions` (idempotent), `POST /media`, `POST /assist/photo` (Gemini Vision draft), `POST /webhooks/whatsapp`, `POST /webhooks/sms` (report, or `STATUS <code>`) |
| **Citizen** | `GET /my-reports`, `GET /notifications`, `POST /projects/:id/confirm-resolution`, `POST /issues/:id/support` |
| **Console** | `GET /issues`, `GET /issues/:id`, `POST /issues/:id/status`, `POST /issues/:id/assign`, `POST /issues/:id/comments`, `GET /activity` |
| **Funding** | `GET /issues/:id/schemes`, `GET /schemes/alignment`, `POST /planner/optimize`, `POST /planner/plans/:id/approve`, `POST /planner/simulate-weights`, `GET /analytics/need-vs-spend`, `GET /schemes/performance`, `POST /projects/:id/scheme` |
| **Intelligence** | `POST /agent/sessions/:id/messages` (co-pilot, streamed), `GET /reports/briefing`, `GET /analytics/impact`, `GET /forecasts`, `GET /equity-audit` |
| **Public** (no login) | `GET /public/track/:code`, `POST /public/track/:code/confirm`, `GET /public/nearby`, `GET /public/scorecards`, `GET /public/impact`, `GET /public/need-vs-spend`, `GET /public/schemes/performance`, `POST /public/demo/message` (channel simulator), `GET /public/opendata/issues.csv` |
| **Jobs** (shared secret) | `POST /jobs/escalations` (gateway), `POST /jobs/sweep`, `POST /jobs/score` (worker) |

## 🛡 Security, privacy and trust

- **RBAC and jurisdiction on the server** for every route; disabled officers are revoked.
- **Privacy by design (DPDP Act 2023 / LGPD):** consent recorded per report; phone numbers hashed; PII scrubbed before any AI call; officers see report content, never reporter identity; citizens can **export or erase** their data; public numbers are **k-anonymous** (withheld under 5 issues; open-data cells under 3 suppressed); the public map shows location only to about 1 km.
- **Anti-gaming:** idempotency keys; per-IP and per-citizen rate limits; burst and geofence detection; photo plausibility check; "I'm affected too" never feeds the score; one confirmation vote per reporter per round.
- **Hardened API:** webhooks **fail closed** without a secret and compare secrets in constant time; only media URLs the app issued are accepted; security headers (CSP, HSTS, `nosniff`, frame denial); request ids on every response; real 4xx errors.
- **Audit log** of every officer action, with who and why.
- **Grounded AI:** figures computed before the model speaks; untraceable numbers removed; refusals preferred over guesses.

## ✅ Quality: how we know it works

| Check | Result |
|---|---|
| Typecheck, all 7 packages | ✅ clean |
| Unit and route tests (Vitest) | ✅ **328 passing**: gateway 207, worker 46, shared utils 39, shared types 15, web 16, scripts 5 |
| **End-to-end smoke test** on the emulators with **real Gemini** | ✅ **69 / 69** |
| Browser sweep: **32 routes × 6 roles × desktop and phone** (Chrome) | ✅ zero console errors, zero failed requests, zero horizontal overflow, zero untranslated strings |
| CI on every pull request | ✅ typecheck + test + build |

The smoke test (`scripts/smoke-emulator.ts`) drives the whole product the way people would:

- three citizens report the same pothole in **Hindi and English**, and the worker merges them into **one issue**;
- anyone tracks a report with just its code, and the tracker never exposes text or identity;
- an officer from another state and a field officer are **refused**; a collector verifies, assigns, notes, matches a scheme, optimises a budget and generates the briefing;
- the project is funded, completed and **confirmed by the citizens**; three confirmations alone do **not** resolve it until an officer signs off;
- an **anonymous** reporter confirms by code, a **"not fixed"** vote **reopens** the work and alerts the officer, and one code gets one vote;
- an issue 53 days past a 7-day deadline **escalates to the state admin**, and escalation is not repeated;
- the WhatsApp webhook rejects callers without the provider secret, and an SMS `STATUS <code>` is answered from live data;
- need vs spend ranks districts and refuses other jurisdictions, the public version withholds small counts, and the scheme ledger credits the finished project to its scheme (which only a collector may correct).

---

## 🚀 Run it locally in 10 minutes

No cloud account and no service-account key needed: everything runs on the **Firebase emulators**. You need **Node 20+**, **pnpm 9**, **Java 17+** (for the Firestore emulator) and a free **Gemini API key** from <https://aistudio.google.com/apikey>.

```bash
# 0. Install and configure
pnpm install
cp .env.example .env          # then put your GEMINI_API_KEY in .env

# 1. Emulators (two terminals)
java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-v*.jar --host=127.0.0.1 --port=8085
npx firebase-tools@13.35.1 emulators:start --only auth --project pramaan-a0c00

# 2. Services (every terminal below needs these three variables)
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIREBASE_PROJECT_ID=pramaan-a0c00

cd apps/worker-ai-pipeline && PORT=8081 WORKER_SHARED_SECRET=localsecret ./node_modules/.bin/tsx src/index.ts
cd apps/api-gateway && PORT=8080 WORKER_URL=http://localhost:8081 WORKER_SHARED_SECRET=localsecret WEBHOOK_SHARED_SECRET=localsecret DEMO_CHANNEL_SIMULATOR=true ./node_modules/.bin/tsx src/index.ts
cd apps/web && VITE_API_BASE_URL=http://localhost:8080/v1 VITE_FIREBASE_API_KEY=fake VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099 ./node_modules/.bin/vite --port 5173 --strictPort

# 3. Seed (from scripts/, with the worker running; it prints the demo logins)
WORKER_URL=http://127.0.0.1:8081 WORKER_SHARED_SECRET=localsecret ./node_modules/.bin/tsx seed-demo-data/seedFirestoreReference.ts
WORKER_URL=http://127.0.0.1:8081 WORKER_SHARED_SECRET=localsecret ./node_modules/.bin/tsx seed-demo-data/seedDemoData.ts

# 4. Open http://localhost:5173, then prove it end to end:
WORKER_SHARED_SECRET=localsecret ./node_modules/.bin/tsx smoke-emulator.ts      # 69 checks
```

The first time you use the Firestore emulator, run `npx firebase-tools@13.35.1 emulators:start --only firestore` once to download the jar. Full guide and Windows notes: [`docs/LOCAL_DEVELOPMENT.md`](docs/LOCAL_DEVELOPMENT.md).

```bash
pnpm turbo run lint test build     # typecheck, all unit tests, production build
```

## ☁️ Deploy

| Path | Guide |
|---|---|
| **Free** (Firebase Spark + Render + Gemini API key) | [`docs/FREE_DEPLOYMENT_GUIDE.md`](docs/FREE_DEPLOYMENT_GUIDE.md) and the steps below; everything is declared in [`render.yaml`](render.yaml) |
| **Scale** (Cloud Run + Pub/Sub + BigQuery + Vertex AI) | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md), [`docs/GCP_SETUP_GUIDE.md`](docs/GCP_SETUP_GUIDE.md), [`infra/gcp/`](infra/gcp) |

### The free deployment, step by step

```mermaid
flowchart LR
  U[Browser] --> W["pramaan-web<br/>Render static site"]
  W -->|/v1| A["pramaan-api<br/>Render web service"]
  A -->|new report| K["pramaan-worker<br/>Render web service"]
  A & K --> F[("Firebase<br/>Firestore + Auth")]
  A & K --> G["Gemini API"]
  C["GitHub Actions cron<br/>every 15 min"] -->|sweep, score, escalate| K & A
```

| # | Step | Where | Time |
|---|---|---|---|
| 1 | Generate a service-account key (Project settings → Service accounts → Generate new private key). Email/password sign-in is already on. | Firebase console | 2 min |
| 2 | **New → Blueprint →** this repo → **Apply**. `render.yaml` creates `pramaan-api`, `pramaan-worker` and `pramaan-web`. | Render (sign in with GitHub) | 3 min |
| 3 | Paste each service's variables with **Environment → Add from .env** (one block per service; see the table in the guide). Redeploy `pramaan-web` once the API URL is known. | Render | 5 min |
| 4 | Seed reference data and the labelled demo dataset into Firestore, pointed at the deployed worker. | Your machine | 10 min |
| 5 | Add the web domain to **Authentication → Settings → Authorized domains**. | Firebase console | 1 min |
| 6 | Set `WORKER_URL`, `API_URL`, `WORKER_SHARED_SECRET` and `SCHEDULED_JOBS_ENABLED=true` for the 15-minute job. | GitHub (`gh secret set`) | 1 min |
| 7 | Check `/healthz` on both services, sign in as `national@pramaan.demo`, file a report, text `STATUS <code>` on `/channels`. | Browser | 5 min |

Production variables: `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON` (base64 key), `FIREBASE_WEB_API_KEY`, `GEMINI_API_KEY`, `WORKER_URL`, `WORKER_SHARED_SECRET` (same on API and worker), `WEBHOOK_SHARED_SECRET` (WhatsApp/SMS), `DEMO_CHANNEL_SIMULATOR` (live phone on `/channels`), `CORS_ORIGINS` (the web URL); on the web: `VITE_API_BASE_URL`, `VITE_FIREBASE_API_KEY`.

**Free-tier notes.** Render services sleep after 15 idle minutes (the first request then takes 30–60 s), so open the site two minutes before a demo. If someone arrives cold anyway, the app says it is waking the server instead of looking broken, and the API wakes the worker at the same moment so both boot in parallel. Firestore's free plan allows 50,000 reads a day; the API caches whole-collection scans for 30 seconds (`STORE_SCAN_CACHE_MS`) so a room of judges does not exhaust it. No composite Firestore indexes are needed.

---

## 🎬 5-minute demo script

| Time | Show | Say |
|---|---|---|
| 0:00 | Landing page | "The same pothole is reported ten times in five languages, and money still goes to whoever shouts loudest. Pramaan fixes the whole chain." |
| 0:30 | `/report`: add a photo, then speak in Hindi | **Gemini writes the report from the photo** and flags the safety hazard. Get a tracking code, no account needed. |
| 0:50 | `/channels` live phone | Send an SMS, get a code; text `STATUS <code>`, get the answer. The whole loop works on a feature phone. |
| 1:00 | Issue detail | Gemini classified it, translated it and **merged 8 reports from 8 people** into one issue. The score is fully explained. |
| 1:45 | Budget planner (`national@`) at ₹1 Cr, 30% reserve | "**60% more people reached** than funding the loudest issues, and more of it in vulnerable areas." Then the weights lab. |
| 2:15 | Need vs spend (`national@`) | "Need and investment correlate at **0.02**: money is not following need. 8 districts, 2.4 crore people, are underserved." |
| 2:30 | National schemes + ledger | "About half of this work (51%) could be paid by central schemes. And the ledger shows which schemes actually deliver, as confirmed by citizens." |
| 3:00 | Co-pilot, then the weekly briefing in Tamil | Grounded answers; numbers it cannot trace are removed. |
| 3:40 | Project → mark complete → `/track` → "not fixed" | A "not fixed" vote **reopens the work**. Only citizens plus an officer sign-off close it. |
| 4:20 | Scorecards, open data | Every district graded in public, and every number downloadable. |
| 4:45 | Architecture | Free-tier today, Cloud Run tomorrow. 11 languages, 36 states, India and Brazil on one codebase. |

Longer walkthrough: [`docs/advanced-features/DEMO_SCRIPT.md`](docs/advanced-features/DEMO_SCRIPT.md).

## 🗺 Roadmap

- **IVR phone line** for people with no data connection at all.
- **Learned ranking** trained on real scheme outcomes, alongside the hand-tuned formula.
- **Live government data**: LGD region codes, PFMS / scheme dashboards for sanctioned amounts.
- **India Stack**: DigiLocker for officer identity; optional Aadhaar-based verification for high-trust reports.
- **National aggregation** over state-level deployments.
- Native-speaker review of all 10 Indian-language translations.

## 📊 Data honesty

The reference data (district populations and centroids are approximate Census 2011 values; the other indices are illustrative, derived from literacy), the investment records and every demo issue are **illustrative samples** generated by [`scripts/seed-demo-data/`](scripts/seed-demo-data). They are marked **"Illustrative sample data"** wherever they appear in the app and the API. Scheme sharing ratios are typical published patterns and are shown with a reminder to confirm against the current guidelines. UI translations were generated with Gemini and validated for placeholder integrity; they still need a native-speaker review.

## 👥 Team

| Name | Role | GitHub |
|---|---|---|
| *Add name* | *Add role* | [@im-rk](https://github.com/im-rk) |
| *Add name* | *Add role* | *Add handle* |

## 📄 License

*Add a licence before submission. An OSI-approved open-source licence (for example MIT or Apache-2.0) is required for recognition as a Digital Public Good.*

---

<div align="center">

**Pramaan** (प्रमाण): *proof*. Proof that a citizen was heard, proof of where the money went, proof that it worked.

</div>
