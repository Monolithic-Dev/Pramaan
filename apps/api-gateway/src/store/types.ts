import type { Citizen, Submission } from "@jansetu/shared-types";

// Narrow seam over Firestore so routes/middleware never import the admin SDK
// directly — this is what lets tests run against an in-memory fake instead of
// needing live Firestore credentials.
export interface Store {
  getCitizen(citizenId: string): Promise<Citizen | null>;
  putCitizen(citizen: Citizen): Promise<void>;
  putSubmission(submission: Submission): Promise<void>;
  getSubmission(submissionId: string): Promise<Submission | null>;
  /** Increments the rolling counter for `key` and returns the new count within `windowMs`. */
  incrementRateLimit(key: string, windowMs: number): Promise<number>;
}
