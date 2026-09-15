import type { Citizen, ConsentRecord, Submission } from "@jansetu/shared-types";
import type { IdempotencyRecord, Store } from "./types.js";

// Used by tests, and as a same-process fallback if no Firestore project is
// configured — never used for a real deploy (state doesn't survive a restart).
export function createInMemoryStore(): Store {
  const citizens = new Map<string, Citizen>();
  const submissions = new Map<string, Submission>();
  const rateLimits = new Map<string, { count: number; windowStart: number }>();
  const idempotencyKeys = new Map<string, IdempotencyRecord>();
  const consentRecords = new Map<string, ConsentRecord>();

  return {
    async getCitizen(citizenId) {
      return citizens.get(citizenId) ?? null;
    },
    async putCitizen(citizen) {
      citizens.set(citizen.citizen_id, citizen);
    },
    async putSubmission(submission) {
      submissions.set(submission.submission_id, submission);
    },
    async getSubmission(submissionId) {
      return submissions.get(submissionId) ?? null;
    },
    async incrementRateLimit(key, windowMs) {
      const now = Date.now();
      const existing = rateLimits.get(key);
      if (!existing || now - existing.windowStart >= windowMs) {
        rateLimits.set(key, { count: 1, windowStart: now });
        return 1;
      }
      existing.count += 1;
      return existing.count;
    },
    async getIdempotencyRecord(key) {
      return idempotencyKeys.get(key) ?? null;
    },
    async putIdempotencyRecord(key, record) {
      idempotencyKeys.set(key, record);
    },
    async putConsentRecord(record) {
      consentRecords.set(record.consent_id, record);
    },
  };
}
