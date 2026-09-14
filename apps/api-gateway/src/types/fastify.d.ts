import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    citizenId?: string;
    // Role/jurisdiction claim handling is stubbed here; enforced in Phase 7.
    officer?: { role: string; jurisdiction: unknown };
  }
}
