// Creates (or updates) an officer login in Firebase Auth and sets the custom claims the API
// reads. Free on the Spark plan.
//
// Run: FIREBASE_SERVICE_ACCOUNT_JSON=<json|base64> pnpm --filter @jansetu/scripts create-officer \
//        officer@example.com 'Str0ngPassw0rd' state_admin IN-DL IN
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [email, password, role, regionId, countryCode = "IN"] = process.argv.slice(2);
if (!email || !password || !role || !regionId) {
  console.error("usage: create-officer <email> <password> <role> <region_id> [country_code]");
  process.exit(1);
}
if (!["state_admin", "district_collector", "field_officer"].includes(role)) {
  console.error("role must be state_admin, district_collector or field_officer");
  process.exit(1);
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
initializeApp({
  credential: raw
    ? cert(JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")))
    : applicationDefault(),
  projectId: process.env.GCP_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID,
});

const auth = getAuth();
const user = await auth.getUserByEmail(email).catch(() => auth.createUser({ email, password, emailVerified: true }));
await auth.setCustomUserClaims(user.uid, { role, region_id: regionId, country_code: countryCode });
console.log(`officer ${email} ready (uid ${user.uid}, role ${role}, region ${regionId})`);
