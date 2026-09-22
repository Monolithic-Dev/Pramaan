import { getAuth } from "firebase-admin/auth";
import { ensureFirebaseApp } from "./firebaseAdmin.js";

export type OfficerRoleName = "field_officer" | "district_collector" | "state_admin";

export interface OfficerAccount {
  uid: string;
  email: string;
  role: OfficerRoleName;
  region_id: string;
  country_code: string;
  disabled: boolean;
  created_at: string | null;
  last_sign_in: string | null;
}

// Seam over Firebase Auth's admin API: officers are Firebase users whose custom claims
// (role, region_id, country_code) are what every jurisdiction check reads. Keeping it behind an
// interface lets user-management routes be tested without a live project.
export interface OfficerAdmin {
  list(): Promise<OfficerAccount[]>;
  create(input: {
    email: string;
    password: string;
    role: OfficerRoleName;
    regionId: string;
    countryCode: string;
  }): Promise<OfficerAccount>;
  setDisabled(uid: string, disabled: boolean): Promise<OfficerAccount | null>;
}

function toAccount(user: import("firebase-admin/auth").UserRecord): OfficerAccount | null {
  const claims = (user.customClaims ?? {}) as Record<string, unknown>;
  if (typeof claims.role !== "string") return null; // a citizen account, not an officer
  return {
    uid: user.uid,
    email: user.email ?? "",
    role: claims.role as OfficerRoleName,
    region_id: typeof claims.region_id === "string" ? claims.region_id : "",
    country_code: typeof claims.country_code === "string" ? claims.country_code : "IN",
    disabled: user.disabled,
    created_at: user.metadata.creationTime ?? null,
    last_sign_in: user.metadata.lastSignInTime ?? null,
  };
}

export function createFirebaseOfficerAdmin(): OfficerAdmin {
  const auth = () => {
    ensureFirebaseApp();
    return getAuth();
  };
  return {
    async list() {
      const out: OfficerAccount[] = [];
      let token: string | undefined;
      do {
        const page = await auth().listUsers(1000, token);
        for (const user of page.users) {
          const account = toAccount(user);
          if (account) out.push(account);
        }
        token = page.pageToken;
      } while (token);
      return out;
    },
    async create({ email, password, role, regionId, countryCode }) {
      const user = await auth().createUser({ email, password, emailVerified: true });
      await auth().setCustomUserClaims(user.uid, { role, region_id: regionId, country_code: countryCode });
      return toAccount(await auth().getUser(user.uid))!;
    },
    async setDisabled(uid, disabled) {
      await auth().updateUser(uid, { disabled });
      return toAccount(await auth().getUser(uid));
    },
  };
}
