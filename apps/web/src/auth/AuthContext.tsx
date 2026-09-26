import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, type Me } from "../api/api.js";
import { setTokenGetter } from "../api/http.js";

const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY ?? "";
// Local dev against the Firebase Auth emulator: set VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
const EMULATOR_URL = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? "";
const IDENTITY_BASE = EMULATOR_URL ? `${EMULATOR_URL}/identitytoolkit.googleapis.com` : "https://identitytoolkit.googleapis.com";
const SECURETOKEN_BASE = EMULATOR_URL ? `${EMULATOR_URL}/securetoken.googleapis.com` : "https://securetoken.googleapis.com";
const STORAGE_KEY = "pramaan.session";

interface Session {
  idToken: string;
  refreshToken: string | null;
  expiresAt: number;
  uid: string;
  email: string | null;
}

export class AuthError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

async function identity(endpoint: string, body: object) {
  const response = await fetch(`${IDENTITY_BASE}/v1/accounts:${endpoint}?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as Record<string, any>;
  if (!response.ok) {
    // Firebase reports e.g. "EMAIL_EXISTS", "INVALID_LOGIN_CREDENTIALS", "WEAK_PASSWORD : Password should be at least 6 characters".
    throw new AuthError(String(json.error?.message ?? "UNKNOWN").split(" ")[0]);
  }
  return json;
}

function decodeUid(idToken: string): string {
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload.user_id ?? payload.sub ?? "");
  } catch {
    return "";
  }
}

function toSession(json: Record<string, any>, email: string | null): Session {
  return {
    idToken: json.idToken ?? json.id_token,
    refreshToken: json.refreshToken ?? json.refresh_token ?? null,
    expiresAt: Date.now() + Number(json.expiresIn ?? json.expires_in ?? 3600) * 1000,
    uid: decodeUid(json.idToken ?? json.id_token),
    email,
  };
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: the session simply will not survive a reload */
  }
}

interface AuthValue {
  status: "loading" | "anonymous" | "authenticated";
  me: Me | null;
  email: string | null;
  signIn: (email: string, password: string) => Promise<Me>;
  signUp: (email: string, password: string, profile?: { preferred_language?: string; country_code?: string }) => Promise<Me>;
  /** Phone OTP result: a ready idToken from the API (no refresh token, valid ~1h). */
  signInWithToken: (idToken: string) => Promise<Me>;
  signOut: () => void;
  can: (permission: keyof Me["permissions"]) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthValue["status"]>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const sessionRef = useRef<Session | null>(loadSession());

  // The one place a token is produced: refresh it a minute before expiry so no request ever
  // carries a token that is about to die.
  const getToken = useCallback(async (): Promise<string | null> => {
    const s = sessionRef.current;
    if (!s) return null;
    if (Date.now() < s.expiresAt - 60_000) return s.idToken;
    if (!s.refreshToken) return s.idToken;
    try {
      const response = await fetch(`${SECURETOKEN_BASE}/v1/token?key=${FIREBASE_API_KEY}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`,
      });
      if (!response.ok) throw new Error("refresh failed");
      sessionRef.current = toSession(await response.json(), s.email);
      saveSession(sessionRef.current);
      return sessionRef.current.idToken;
    } catch {
      sessionRef.current = null;
      saveSession(null);
      setMe(null);
      setStatus("anonymous");
      return null;
    }
  }, []);

  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  const loadMe = useCallback(async (profile?: { preferred_language?: string; country_code?: string }): Promise<Me> => {
    let profileOfMe = await api.me();
    if (profileOfMe.kind === "citizen") {
      // First sign-in of an email account: create the citizen record (idempotent on the server).
      await api.ensureCitizenSession(profile ?? {}).catch(() => undefined);
      profileOfMe = await api.me();
    }
    setMe(profileOfMe);
    setStatus("authenticated");
    return profileOfMe;
  }, []);

  useEffect(() => {
    if (!sessionRef.current) {
      setStatus("anonymous");
      return;
    }
    loadMe().catch(() => {
      sessionRef.current = null;
      saveSession(null);
      setStatus("anonymous");
    });
  }, [loadMe]);

  const establish = useCallback(
    async (json: Record<string, any>, email: string | null, profile?: { preferred_language?: string; country_code?: string }) => {
      sessionRef.current = toSession(json, email);
      saveSession(sessionRef.current);
      return loadMe(profile);
    },
    [loadMe],
  );

  const value = useMemo<AuthValue>(
    () => ({
      status,
      me,
      email: sessionRef.current?.email ?? null,
      signIn: async (email, password) =>
        establish(await identity("signInWithPassword", { email, password, returnSecureToken: true }), email),
      signUp: async (email, password, profile) =>
        establish(await identity("signUp", { email, password, returnSecureToken: true }), email, profile),
      signInWithToken: async (idToken) => establish({ idToken, expiresIn: 3600 }, null),
      signOut: () => {
        sessionRef.current = null;
        saveSession(null);
        setMe(null);
        setStatus("anonymous");
      },
      can: (permission) => Boolean(me?.permissions[permission]),
    }),
    [status, me, establish],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/** Human-readable text for the Firebase auth error codes a user can actually hit. */
export function authErrorKey(code: string): string {
  const known: Record<string, string> = {
    EMAIL_EXISTS: "auth.err.emailExists",
    INVALID_LOGIN_CREDENTIALS: "auth.err.invalid",
    INVALID_PASSWORD: "auth.err.invalid",
    EMAIL_NOT_FOUND: "auth.err.invalid",
    WEAK_PASSWORD: "auth.err.weak",
    INVALID_EMAIL: "auth.err.email",
    USER_DISABLED: "auth.err.disabled",
    TOO_MANY_ATTEMPTS_TRY_LATER: "auth.err.tooMany",
  };
  return known[code] ?? "auth.err.generic";
}
