import type { AuthVerifier, DecodedAuth } from "../lib/authVerifier.js";
import type { IdentityToolkit } from "../lib/identityToolkit.js";
import type { Publisher } from "../lib/pubsub.js";
import { createInMemoryStore } from "../store/inMemoryStore.js";
import type { Deps } from "../deps.js";

export interface FakeDeps extends Omit<Deps, "store"> {
  store: ReturnType<typeof createInMemoryStore>;
  publishedMessages: unknown[];
  /** Maps a fake token string to the decoded identity it should resolve to. */
  tokens: Map<string, DecodedAuth>;
  /** Maps a fake sessionInfo/OTP pair to the phone number and verified UID. */
  otpSessions: Map<string, { phone: string; code: string; uid: string }>;
}

export function createFakeDeps(): FakeDeps {
  const publishedMessages: unknown[] = [];
  const tokens = new Map<string, DecodedAuth>();
  const otpSessions = new Map<string, { phone: string; code: string; uid: string }>();

  const authVerifier: AuthVerifier = {
    async verifyIdToken(token) {
      const decoded = tokens.get(token);
      if (!decoded) throw new Error("invalid token");
      return decoded;
    },
  };

  const publisher: Publisher = {
    async publishRawSubmission(payload) {
      publishedMessages.push(payload);
    },
  };

  const identityToolkit: IdentityToolkit = {
    async sendVerificationCode(phone) {
      const sessionInfo = `session_${otpSessions.size}`;
      otpSessions.set(sessionInfo, { phone, code: "111111", uid: `uid_${phone}` });
      return { sessionInfo };
    },
    async verifyPhoneNumber(sessionInfo, code) {
      const session = otpSessions.get(sessionInfo);
      if (!session || session.code !== code) throw new Error("invalid otp");
      return { idToken: `token_${session.uid}`, localId: session.uid, phoneNumber: session.phone };
    },
  };

  return {
    store: createInMemoryStore(),
    publisher,
    identityToolkit,
    authVerifier,
    publishedMessages,
    tokens,
    otpSessions,
  };
}
