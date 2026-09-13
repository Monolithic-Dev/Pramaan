# Goal Description

The goal is to analyze the `JanSetu/docs` repository, identify flaws or areas of improvement by comparing it against the `Ideas/Sonnet5 Max - Code for Communities` (Pramaan) documentation, and integrate the superior elements from Pramaan into JanSetu.

### Flaws Identified in JanSetu:
1. **Static Dashboard Paradigm:** JanSetu's policymaker dashboard is static. Officers see a pre-computed ranked list and pre-generated briefs, but cannot interact with the data or ask follow-up questions.
2. **Underutilized AI Potential:** JanSetu uses AI primarily for extraction, deduplication, and a one-time RAG brief generation. It misses out on the highly-valued "Agentic AI" (Function Calling/Tool Use) which is a major differentiator in technical hackathons.
3. **Limited RAG Context:** JanSetu's brief generation only uses demand and investment data. It doesn't ground recommendations in actual government policy or scheme documents.
4. **Opaque "Why":** While the formula is explainable, officers can't dynamically interrogate the system about *why* a project is funded or cross-reference it against specific demographic cuts on the fly.

### Improvements from Pramaan to Integrate:
1. **Conversational Agent Orchestration:** Replace the static dashboard with a conversational AI agent (Gemini with Function Calling) that allows officers to ask natural language questions (e.g., "What are the top 3 unaddressed road issues in Ward 14, and are they already funded?").
2. **Explicit Data-Fusing Tools:** Equip the agent with tools (`query_fused_data`, `check_investment_status`, `score_priority`, `generate_brief`) that execute real-time queries against BigQuery.
3. **Strict Grounding & Refusal:** Implement structural grounding where the agent is forced to cite tool-returned evidence and explicitly refuse to answer ("I don't have enough information") if the data doesn't support a confident response.
4. **Policy-Grounded Brief Generation:** Enhance the brief generation to include RAG over actual government scheme documents (e.g., PMGSY guidelines), ensuring projects are recommended with a plausible funding mechanism.
5. **Session & Audit Logging:** Add a robust audit trail for agent conversations to ensure every AI-generated recommendation is traceable back to source data.

## User Review Required

> [!IMPORTANT]
> This plan shifts JanSetu's officer UI from a traditional dashboard to a Chat/Agent-driven interface with supplementary data panels. This will change the frontend requirements in `TECH_STACK_AND_REPO.md`. Are you comfortable moving to a conversational primary interface for the officers?

## Proposed Changes

### JanSetu Documentation

#### [MODIFY] [PRD.md](file:///C:/Users/mahakisore/Skills/Hackathons/Ongoing/Code%20for%20Communities/JanSetu/docs/PRD.md)
- **Objective / Vision**: Update to highlight the conversational, interrogatable nature of the policymaker interface.
- **User Stories**: Add stories for natural language querying, on-demand brief generation, and explicit refusal for ungrounded answers.
- **Success Metrics**: Add metrics around Agent latency and tool-calling accuracy.

#### [MODIFY] [ARCHITECTURE.md](file:///C:/Users/mahakisore/Skills/Hackathons/Ongoing/Code%20for%20Communities/JanSetu/docs/ARCHITECTURE.md)
- **High-level Diagram**: Update the Mermaid diagram to introduce the `AI Agent Layer (Gemini + Function Calling)` between the Dashboard API and the Data Layer.
- **Component Responsibilities**: Add definitions for the Agent Orchestrator and its associated tools.

#### [MODIFY] [AI_PIPELINE.md](file:///C:/Users/mahakisore/Skills/Hackathons/Ongoing/Code%20for%20Communities/JanSetu/docs/AI_PIPELINE.md)
- **Agent Reasoning Loop**: Add a dedicated section detailing how Gemini parses questions, calls tools (`query_fused_data`, `check_investment_status`, etc.), and synthesizes cited answers.
- **Policy-Grounded RAG**: Update Stage 6 to include document retrieval over government scheme policies, not just structured data.
- **Responsible AI**: Emphasize the refusal-to-hallucinate guardrail.

#### [MODIFY] [DATA_MODEL.md](file:///C:/Users/mahakisore/Skills/Hackathons/Ongoing/Code%20for%20Communities/JanSetu/docs/DATA_MODEL.md)
- **AgentSession / AuditLog**: Add a new entity to track conversation history, queries, and the exact tool-returned evidence used for each answer, ensuring full traceability.

#### [MODIFY] [TECH_STACK_AND_REPO.md](file:///C:/Users/mahakisore/Skills/Hackathons/Ongoing/Code%20for%20Communities/JanSetu/docs/TECH_STACK_AND_REPO.md)
- **Frontend Layer**: Update to specify a Chat UI alongside the map/dashboard views.
- **AI Worker Layer**: Clarify that the backend will host tool schemas for Gemini Function Calling.

## Verification Plan

### Manual Verification
- Review the modified markdown files to ensure the Pramaan concepts (Conversational Agent, Tool Calling, Policy RAG, Refusal guardrails, Audit logging) are seamlessly integrated into the JanSetu context without losing JanSetu's strengths (like the geospatial deduplication and multi-channel intake).
