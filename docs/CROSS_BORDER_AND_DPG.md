# Cross-Border Applicability & Digital Public Good Positioning

**This document exists because hackathon Rule 04 requires it and no other Pramaan doc addresses it.**

> Rule 04: *"Solutions should be designed with cross-border applicability in mind — built for one context but scalable to others across BRICS nations."*

The problem statement also specifies the platform be *"designed as a Digital Public Good."* Between **Depth & Reach (20%)** and **Deployability (20%)** this touches 40% of the score, and the implementation cost is roughly half a day because the schema was already close — see `DATA_MODEL.md`'s `CountryProfile` entity.

---

## 1. What actually has to change to run Pramaan in Brazil

The honest test of a portability claim is: name the file you edit. Here is the list.

| Concern | India | Brazil | Where it lives |
|---|---|---|---|
| Admin hierarchy | state → district → block → ward | estado → município → distrito → bairro | `CountryProfile.admin_levels` |
| Region code authority | LGD codes | IBGE codes | `CountryProfile.region_code_authority` |
| Boundary geometry | LGD / Survey of India | IBGE malhas territoriais | `CountryProfile.boundary_dataset_uri` |
| Languages | hi, ta, bn, mr, te, en | pt-BR | `CountryProfile.official_languages` |
| Citizen auth | phone OTP | phone OTP | `CountryProfile.citizen_auth_method` |
| Policy corpus for RAG | PMGSY, AMRUT, Jal Jeevan | PAC, Minha Casa Minha Vida | `CountryProfile.policy_corpus_id` |
| Privacy regime | DPDP 2023 | LGPD | `CountryProfile.privacy_regime` |
| Currency | INR | BRL | `CountryProfile.currency` |
| Data residency | `asia-south1` | `southamerica-east1` | `CountryProfile.data_residency_region` |

**Zero application code changes.** One document insert, one boundary dataset load, one policy corpus ingest.

That is a claim you can make on a slide *and defend*, which is the difference between it scoring and it sounding like padding.

### What genuinely does not port
Be explicit about this — a judge trusts a portability claim more when it comes with limits:

- **Category taxonomy.** "Health infrastructure" means a PHC in India and a UBS in Brazil. The enum is configurable per profile but the mapping requires domain input.
- **Vulnerability index semantics.** `poverty_index` is not comparable across countries. `normalised_value` is a within-country percentile by design — cross-country score comparison is meaningless and the system should refuse it rather than compute it.
- **WhatsApp penetration.** Very high in India and Brazil, near-zero in Russia (Telegram/VK dominate). The channel adapter interface is pluggable; the adapters themselves are per-market work.

## 2. Why BRICS specifically is a coherent target

Not a stretch — the problem shape genuinely recurs:

- **Brazil** — municipal infrastructure demand fragmented across 5,570 municípios; `Fala.BR` exists as a federal complaint channel with no prioritisation layer.
- **South Africa** — municipal service-delivery complaints are a live political issue; existing systems are intake-only.
- **India** — the stated problem statement.

The common structure: a multilingual population, a federated administrative hierarchy, a public-investment record that exists but is not joined to citizen demand, and no outcome measurement. Pramaan targets the join and the loop, not the complaint form — which is exactly why it ports.

Two-sentence version for the pitch deck: *"Pramaan solves the join between citizen demand and public investment, not the complaint form. Any federated state with multilingual citizens and published investment records has the same gap, which is why adding Brazil is a config file rather than a fork."*

## 3. Digital Public Good positioning

The problem statement says "designed as a Digital Public Good." The [DPG Standard](https://digitalpublicgoods.net/standard/) has nine indicators. Pramaan can credibly claim seven within the hackathon:

| # | Indicator | Status | Action |
|---|---|---|---|
| 1 | Relevance to SDGs | ✅ | SDG 9 (infrastructure), 11 (sustainable cities), 16 (institutions). Name them on the deck |
| 2 | Open licence | ✅ | **Apache 2.0** on the repo. Do this on Day 1 — a missing LICENSE file is a trivially avoidable miss |
| 3 | Clear ownership | ✅ | Team + institution in README |
| 4 | Platform independence | ⚠️ | Deep GCP coupling. Be honest: state that Firestore/BigQuery/Vertex are swappable behind the repository and AI-provider interfaces, and that the interfaces exist. Do not claim more |
| 5 | Documentation | ✅ | This doc set is already past the bar |
| 6 | Data extraction mechanism | ✅ | `GET /privacy/my-data` (`API_SPEC.md` §7) + a documented BigQuery export path |
| 7 | Privacy & applicable laws | ✅ | DPDP section, per-country `privacy_regime` |
| 8 | Standards & best practices | ✅ | LGD codes, OpenAPI 3.1 spec, geohash, OAuth2 |
| 9 | Do No Harm by design | ✅ | Anti-fraud never auto-rejects; refusal guardrail; PII minimisation; personal-emergency routing |

Indicator 4 is the honest weak point. Say so. Claiming nine out of nine on a GCP-native hackathon build invites a question you cannot win; claiming seven with a named gap and a stated mitigation reads as engineering judgement.

## 4. Build cost

| Task | Time |
|---|---|
| `CountryProfile` collection + loader | 1h |
| Replace hardcoded `"IN"` / `"INR"` / `"en"` with profile lookups | 2h |
| Seed a second profile (`BR`) with 3 synthetic municípios | 1h |
| Demo: switch profile, show the UI in pt-BR with Brazilian regions | 30m |

**~4.5 hours.** Scheduled in `docs/phases/phase-8-fraud-impact-crossborder.md`.

## 5. The 20 seconds of demo video this buys you

Toggle the country profile on screen. The admin hierarchy relabels itself, the language switches, the region picker repopulates with Brazilian municípios, the same agent answers the same question in Portuguese against Brazilian reference data.

No other team will do this. It is the cheapest differentiator in the entire build and it directly answers a numbered rule that most submissions will silently skip.
