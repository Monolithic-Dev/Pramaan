# JanSetu — AI-Powered Citizen Demand → Infrastructure Priority Platform

**Track:** AI for Digital Public Infrastructure & Governance
**Hackathon:** Build with AI: Code for Communities — Second Edition (Google Cloud)
**Status:** Hackathon MVP spec — documents in this folder are meant to be handed to a human team or an AI coding agent to scaffold the actual codebase.

## One-line pitch
JanSetu turns millions of raw, multilingual citizen infrastructure complaints into a small number of deduplicated, verified, and explainable "priority projects" that a state government can actually fund and track to completion — closing the loop the original problem statement calls out ("no way to measure the impact of large-scale digital public infrastructure initiatives").

## The gap in the obvious solution
The default approach to this problem statement is: citizen complaint form → Gemini tags it → heatmap. That solves *intake*, but skips the two hardest and most valuable parts of the brief:

1. The same real-world issue gets reported dozens of times, in different words, different languages, different channels. Something has to resolve that into *one issue* before "demand" means anything — otherwise your "hotspots" are just noise plus population density.
2. The brief explicitly names impact measurement as unsolved today. A system that only ingests and never verifies outcomes hasn't actually solved the stated problem — it's just a nicer complaint box.

JanSetu is architected around those two gaps, not around the complaint form.

## Core differentiators
- **Multi-channel ingestion** — web, voice, WhatsApp/SMS — normalized into one schema before anything else happens.
- **Semantic + geospatial deduplication** — collapses thousands of raw reports into canonical `Issues` using embeddings + location clustering, not keyword matching.
- **Explainable, multi-factor prioritization** — demand density, vulnerability indices, existing infra gaps, and already-committed investment (to avoid double-funding), producing a transparent score a government official can actually defend.
- **Lightweight anti-fraud / verification layer** — geofencing, duplicate/burst detection, optional photo cross-check. A public-facing government tool that isn't defended against gaming won't survive a real pilot.
- **RAG-grounded policymaker briefs** — Gemini writes the justification for each recommended project, but every number it cites comes from real data passed into the prompt, not from memory — this directly defuses the hallucination concern judges will probe for.
- **Closed impact loop** — citizens confirm resolution; realized vs. promised impact feeds back into future scoring. This is the part of the brief almost every competing team will skip entirely.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend (citizen + officer) | React + Tailwind, installable PWA | One codebase, works on patchy connectivity |
| Voice input | In-app voice recording + Cloud Speech-to-Text (MVP); Dialogflow CX IVR phone line (stretch) | Voice-note upload gets you the "voice support" requirement without a telephony integration; true IVR is a strong stretch goal |
| Messaging | WhatsApp Business API (via Gupshup or Twilio) | Where most citizens already are |
| Translation | Cloud Translation API | Normalizes all input to a working language before processing, translates responses back |
| AI/ML | Gemini API (Vertex AI), Vertex AI Embeddings, Vertex AI AutoML (optional stretch) | Categorization, deduplication, scoring, generation |
| Backend | Node.js (Fastify) or Python (FastAPI) microservices on Cloud Run | Stateless, scales to zero, cheap for a hackathon budget |
| Data | Firestore (operational), BigQuery (analytics/scoring/joins with public datasets), Cloud Storage (photos/audio) | Firestore for low-latency writes, BigQuery for the heavy joins against demographic/infra index data |
| Geospatial | Google Maps Platform, BigQuery GIS | Clustering, officer dashboard heatmap |
| Async pipeline | Pub/Sub + Cloud Functions/Cloud Run jobs | Dedup/scoring shouldn't block the citizen's submission response |
| Auth | Firebase Auth (phone OTP) for citizens, Identity Platform/SSO for officers | Different trust levels need different auth |
| CI/CD | GitHub Actions → Cloud Build → Cloud Run | Standard, fast to stand up |

## Repo / doc structure
```
/jansetu-docs
  README.md              ← you are here
  PRD.md                 ← what we're building, for whom, and why
  ARCHITECTURE.md        ← how the system is put together
  DATA_MODEL.md          ← schemas and entity relationships
  API_SPEC.md            ← endpoint contracts
  AI_PIPELINE.md         ← every place Gemini/Vertex AI is used, with prompts
  SECURITY_PRIVACY.md    ← auth, PII, fraud prevention, DPDP Act notes
  DEPLOYMENT.md          ← infra, environments, CI/CD, scaling, federation model
  EDGE_CASES.md          ← what breaks and how we handle it
  ROADMAP.md             ← day-by-day build plan for the remaining hackathon window
  TESTING.md             ← test strategy and demo-day QA checklist
```

## Attribution
Built during Build with AI: Code for Communities (Google Cloud hackathon). Any third-party datasets, libraries, or open-source components used should be cited in `ARCHITECTURE.md` and in code comments per hackathon Rule 03 (original code or properly licensed/cited open-source).
