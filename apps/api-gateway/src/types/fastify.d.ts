import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    citizenId?: string;
    // Role-hierarchy enforcement ("role >= collector") is stubbed here,
    // completed in Phase 7; regionId is used now to pin agent session scope (Phase 6).
    officer?: { role: string; regionId: string | null; countryCode: string | null };
  }
}
