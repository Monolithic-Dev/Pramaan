import { ApiClientError } from "./client.js";

// Officer sign-in via Firebase Auth's REST API (email/password): free on the Spark plan, no SDK.
const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY ?? "";

export async function signInOfficer(
  email: string,
  password: string,
): Promise<{ token: string; regionId: string }> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!response.ok) throw new ApiClientError(response.status, "SIGN_IN_FAILED", "Sign-in failed.");
  const { idToken } = (await response.json()) as { idToken: string };
  // The JWT claims carry the officer jurisdiction; the server re-verifies them on every call.
  const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
    region_id?: string;
  };
  return { token: idToken, regionId: payload.region_id ?? "" };
}
