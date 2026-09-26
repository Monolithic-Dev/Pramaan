// One-time setup script: writes then deletes a dummy doc in each collection to
// confirm the service account can write (firestore.rules denies client access,
// but this script runs with admin credentials via Application Default Credentials).
// Run: GOOGLE_CLOUD_PROJECT=<project-id> pnpm --filter @pramaan/scripts init-firestore-collections
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const COLLECTIONS = ["citizens", "submissions", "issues", "geoClusters", "officerUsers"];

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function main() {
  for (const collection of COLLECTIONS) {
    const ref = db.collection(collection).doc("__init__");
    await ref.set({ initialized_at: new Date().toISOString() });
    await ref.delete();
    console.log(`ok: ${collection}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
