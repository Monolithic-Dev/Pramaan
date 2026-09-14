import { withRetry } from "@jansetu/shared-utils";
import { env } from "./env.js";

// Google Identity Platform's phone-auth REST API — the server-side equivalent
// of what the Firebase client SDK normally does with reCAPTCHA in-browser.
// https://cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/sendVerificationCode
export interface IdentityToolkit {
  sendVerificationCode(phone: string): Promise<{ sessionInfo: string }>;
  verifyPhoneNumber(
    sessionInfo: string,
    code: string,
  ): Promise<{ idToken: string; localId: string; phoneNumber: string }>;
}

const BASE_URL = "https://identitytoolkit.googleapis.com/v1";

async function callIdentityToolkit<T>(path: string, body: unknown): Promise<T> {
  return withRetry(async () => {
    const response = await fetch(`${BASE_URL}/${path}?key=${env.firebaseWebApiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Identity Toolkit ${path} failed: ${response.status} ${detail}`);
    }
    return response.json() as Promise<T>;
  });
}

export function createIdentityToolkit(): IdentityToolkit {
  return {
    async sendVerificationCode(phone) {
      return callIdentityToolkit("accounts:sendVerificationCode", {
        phoneNumber: phone,
      });
    },
    async verifyPhoneNumber(sessionInfo, code) {
      return callIdentityToolkit("accounts:signInWithPhoneNumber", {
        sessionInfo,
        code,
      });
    },
  };
}
