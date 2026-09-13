# JanSetu Claude Code Skills

Project-specific skills for coding agents working on JanSetu, generated from the spec set in `/docs`.

## Portability note
`.claude/skills/` with `SKILL.md` YAML frontmatter is Claude Code's specific auto-discovery convention — Claude Code reads a skill's `description` automatically and pulls in the rest of the file (and its `references/`) only when relevant. A few other agent tools are adopting compatible conventions, but most won't auto-trigger on this folder as-is. That said, every file here is plain, well-organized markdown: point any other agent, or a human teammate, directly at the relevant `SKILL.md` and it's just as useful as prose documentation — nothing here depends on the auto-discovery mechanism to be readable or correct.

## Skill set (12)

| Skill | Covers |
|---|---|
| `senior-architect` | Structural/service-boundary decisions, the Option A→B federation path |
| `gcp-cloud-architect` | Cloud Run/Firestore/BigQuery/Pub/Sub provisioning, CI/CD, IAM, cost |
| `senior-frontend` | `apps/web` — citizen report flow + officer/policymaker dashboard |
| `senior-backend` | `apps/api-gateway` + `apps/worker-ai-pipeline` |
| `senior-database` | Firestore/BigQuery schema, multi-tenancy partitioning |
| `senior-prompt-engineer` | Gemini/Vertex AI prompts, embeddings, dedup, grounded generation |
| `senior-security` | Auth, RBAC/jurisdiction, secrets, DPDP Act 2023 compliance |
| `ai-security` | Specifically the citizen-data-into-third-party-AI-API boundary |
| `threat-detection` | Anti-fraud/anti-gaming for the public prioritization system |
| `senior-qa` | Test strategy, prompt regression, demo-day QA |
| `code-reviewer` | Cross-cutting PR review checklist pulling from every skill above |
| `localization-voice-ux` | Guardian for the multilingual/voice judging requirement |

## Updating this set
This is a snapshot of what the project needs *now*, not a one-time artifact — re-generate or hand-edit individual skills as the stack changes. If skills already exist here from a previous run, update per-skill rather than replacing the whole folder.

See `/docs` at the repo root (`README.md`, `PRD.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `API_SPEC.md`, `AI_PIPELINE.md`, `SECURITY_PRIVACY.md`, `DEPLOYMENT.md`, `EDGE_CASES.md`, `TECH_STACK_AND_REPO.md`) and `/docs/phases` for the full spec and build-sequence set these skills are built from — skills point to those docs rather than duplicating them.
