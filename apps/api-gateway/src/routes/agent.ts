import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AgentSession } from "@jansetu/shared-types";
import type { Deps } from "../deps.js";
import { requireOfficer } from "../middleware/auth.js";
import { createSessionSchema, postMessageSchema } from "../schemas/agent.js";
import { isWithinScope } from "../agent/scopeGuard.js";
import { runAgentTurn } from "../agent/orchestrator.js";

export function registerAgentRoutes(app: FastifyInstance, deps: Deps) {
  app.post(
    "/agent/sessions",
    { preHandler: [requireOfficer(deps.authVerifier)] },
    async (request, reply) => {
      const parsed = createSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
        });
      }

      const officer = request.officer!;
      if (!officer.regionId) {
        return reply.code(403).send({
          error: { code: "JURISDICTION_MISMATCH", message: "Officer has no assigned region." },
        });
      }

      // Session scope can never be wider than the officer's own jurisdiction —
      // this is validated once here and then trusted as the pinned scope for
      // every tool call in the session (docs/API_SPEC.md §5).
      const requested = parsed.data.region_scope;
      const allowed =
        requested === officer.regionId || (await isWithinScope(deps.bigqueryAgent, requested, officer.regionId));
      if (!allowed) {
        return reply.code(403).send({
          error: {
            code: "JURISDICTION_MISMATCH",
            message: `${requested} is outside your assigned jurisdiction (${officer.regionId}).`,
          },
        });
      }

      const session: AgentSession = {
        session_id: `sess_${randomUUID().slice(0, 8)}`,
        officer_id: request.citizenId ?? "unknown-officer",
        country_code: officer.countryCode ?? "IN",
        state_id: "UNRESOLVED",
        region_scope: requested,
        started_at: new Date().toISOString(),
        turn_count: 0,
      };
      await deps.store.putAgentSession(session);
      return reply.code(201).send({ session_id: session.session_id });
    },
  );

  app.get(
    "/agent/sessions/:sessionId",
    { preHandler: [requireOfficer(deps.authVerifier)] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const session = await deps.store.getAgentSession(sessionId);
      if (!session) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Session not found." } });
      }
      const turns = await deps.store.getAgentTurns(sessionId);
      return reply.code(200).send({ session, turns });
    },
  );

  app.post(
    "/agent/sessions/:sessionId/messages",
    { preHandler: [requireOfficer(deps.authVerifier)] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const session = await deps.store.getAgentSession(sessionId);
      if (!session) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Session not found." } });
      }

      const parsed = postMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
        });
      }

      reply.hijack();
      // reply.hijack() bypasses Fastify's header pipeline, so carry over what plugins
      // (notably CORS) already set; otherwise the browser blocks the stream cross-origin.
      reply.raw.writeHead(200, {
        ...(reply.getHeaders() as Record<string, string | string[]>),
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });

      // Tool-call events land before any token event, by construction — the
      // orchestrator only emits "token" once the whole answer is ready
      // (docs/phases/phase-6-agent-rag.md acceptance criteria).
      const sse = (event: string, data: unknown) =>
        reply.raw.write(["event: " + event, "data: " + JSON.stringify(data), "", ""].join("\n"));
      try {
        await runAgentTurn(deps, session, parsed.data.text, (e) => sse(e.event, e.data));
      } catch (err) {
        // After hijack() nothing else will answer this request: without an explicit error event
        // and end(), the browser waits forever on a stream that never closes.
        request.log.error({ err }, "agent turn failed");
        sse("error", { message: "The assistant could not complete this request. Please try again." });
      }

      reply.raw.end();
      return reply;
    },
  );

  app.get(
    "/audit/agent-turns",
    { preHandler: [requireOfficer(deps.authVerifier)] },
    async (request, reply) => {
      if (request.officer?.role !== "state_admin") {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "This endpoint requires the state_admin role." },
        });
      }
      const query = request.query as { officer_id?: string; from?: string; to?: string; refused?: string };
      const turns = await deps.store.queryAgentTurns({
        officerId: query.officer_id,
        from: query.from,
        to: query.to,
        refused: query.refused === undefined ? undefined : query.refused === "true",
      });
      return reply.code(200).send({ turns });
    },
  );
}
